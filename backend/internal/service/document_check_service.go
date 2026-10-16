package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/invopop/jsonschema"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

const (
	// documentCheckMaxAttempts: transient API failures are retried this
	// many times in total before a document is marked failed.
	documentCheckMaxAttempts = 3
	// documentCheckBatch is how many documents one pass claims at a time.
	documentCheckBatch = 4
	// documentCheckStaleAfter: a processing claim older than this belongs
	// to a worker that died mid-check and is put back in the queue.
	documentCheckStaleAfter = 10 * time.Minute
	documentCheckTimeout    = 3 * time.Minute

	// API input limits: images are capped per image, PDFs by request size.
	maxImageBytes = 5 << 20
	maxPDFBytes   = 30 << 20

	// uploadURLPrefix is where UploadHandler serves stored files; only files
	// under it are read (from local disk — the checker never fetches URLs).
	uploadURLPrefix = "/api/v1/uploads/"
)

const documentCheckSystemPrompt = `You check documents that students upload with an application for a university dormitory place in Kazakhstan (Korkyt Ata Kyzylorda University). Documents may be in Kazakh, Russian or English, and may be photos, scans or PDFs.

For each document you are told which required document it was uploaded as and the applying student's full name. Report what the document actually shows; dormitory managers make every decision, so describe, don't decide. Be precise about the issue date: it is the date the document was issued or signed, not a birth date or a validity end date. If several dates are present, pick the issue date and leave it empty when unsure rather than guessing.

Only report forgery signs you can point to. Poor photo quality is a readability issue, not a forgery sign.`

// DocumentCheckService reads uploaded required documents with Claude and
// stores what it finds (type, holder, issue date, tampering signs), which
// TriageService then turns into yellow/red triage reasons. Checks run in the
// background (Run) so an upload never waits on the model.
type DocumentCheckService struct {
	documents  repository.ApplicationDocumentRepository
	settings   *AISettingsService
	client     anthropic.Client
	openRouter *openRouterClient
	uploadDir  string
	wake       chan struct{}
}

// NewDocumentCheckService: on/off and the model come from settings, read
// on every check, so an admin's change applies immediately.
func NewDocumentCheckService(documents repository.ApplicationDocumentRepository, settings *AISettingsService, apiKey, uploadDir string) *DocumentCheckService {
	s := &DocumentCheckService{documents: documents, settings: settings, uploadDir: uploadDir, wake: make(chan struct{}, 1)}
	switch settings.Provider() {
	case AIProviderAnthropic:
		s.client = anthropic.NewClient(option.WithAPIKey(apiKey), option.WithRequestTimeout(documentCheckTimeout))
	case AIProviderOpenRouter:
		s.openRouter = newOpenRouterClient(apiKey, documentCheckTimeout)
	}
	return s
}

// Enabled reports whether AI checks run right now: an API key is set and
// an admin hasn't turned them off.
func (s *DocumentCheckService) Enabled() bool {
	return s != nil && s.settings.DocumentChecksActive()
}

// Wake asks the background loop (Start) to look at the queue now instead
// of at its next tick — called right after a document is queued.
func (s *DocumentCheckService) Wake() {
	if !s.Enabled() {
		return
	}
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// Start runs RunOnce at startup, on every tick, and whenever Wake is
// called, until the returned stop func is called. A no-op when disabled.
func (s *DocumentCheckService) Start(interval time.Duration) (stop func()) {
	// Runs whenever a key is present: checks may be switched on later from
	// the admin panel, and RunOnce itself does nothing while they're off.
	if !s.settings.APIKeyPresent() {
		return func() {}
	}
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			if n, err := s.RunOnce(ctx); err != nil {
				log.Printf("document checks failed: %v", err)
			} else if n > 0 {
				log.Printf("checked %d document(s)", n)
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			case <-s.wake:
			}
		}
	}()
	return cancel
}

// RunOnce requeues stale claims, then checks pending documents until the
// queue is empty. Returns how many documents it finished.
func (s *DocumentCheckService) RunOnce(ctx context.Context) (int, error) {
	if !s.Enabled() {
		return 0, nil
	}
	if _, err := s.documents.RequeueStaleChecks(ctx, time.Now().Add(-documentCheckStaleAfter)); err != nil {
		return 0, err
	}
	done := 0
	for {
		batch, err := s.documents.ClaimPendingChecks(ctx, documentCheckBatch)
		if err != nil {
			return done, err
		}
		if len(batch) == 0 {
			return done, nil
		}
		for _, doc := range batch {
			s.checkOne(ctx, doc)
			done++
		}
	}
}

func (s *DocumentCheckService) checkOne(ctx context.Context, doc *domain.PendingDocumentCheck) {
	result, err := s.check(ctx, doc)
	var unsupported *unsupportedDocumentError
	switch {
	case err == nil:
		s.finish(ctx, doc, domain.DocumentCheckDone, result, nil)
	case errors.As(err, &unsupported):
		msg := unsupported.reason
		s.finish(ctx, doc, domain.DocumentCheckUnsupported, nil, &msg)
	default:
		msg := err.Error()
		status := domain.DocumentCheckPending
		if doc.Attempts >= documentCheckMaxAttempts {
			status = domain.DocumentCheckFailed
		}
		log.Printf("document check %s attempt %d failed: %v", doc.DocumentID, doc.Attempts, err)
		s.finish(ctx, doc, status, nil, &msg)
	}
}

func (s *DocumentCheckService) finish(ctx context.Context, doc *domain.PendingDocumentCheck, status domain.DocumentCheckStatus, result *domain.DocumentCheckResult, errMsg *string) {
	if err := s.documents.FinishCheck(ctx, doc.DocumentID, status, result, errMsg); err != nil {
		log.Printf("document check %s: saving result failed: %v", doc.DocumentID, err)
	}
}

// unsupportedDocumentError marks a document the checker can't read at all
// (wrong format, too large, not stored locally) — retrying won't help.
type unsupportedDocumentError struct{ reason string }

func (e *unsupportedDocumentError) Error() string { return e.reason }

func (s *DocumentCheckService) check(ctx context.Context, doc *domain.PendingDocumentCheck) (*domain.DocumentCheckResult, error) {
	data, mime, err := s.readFile(doc.FileURL)
	if err != nil {
		return nil, err
	}
	prompt := fmt.Sprintf(
		"Required document this was uploaded as: %q (Russian: %q).\nApplying student's full name: %q.\nToday's date: %s.",
		doc.ExpectedNameKk, doc.ExpectedNameRu, doc.StudentFullName, time.Now().In(kyzylorda).Format(time.DateOnly),
	)
	if s.openRouter != nil {
		return s.checkOpenRouter(ctx, data, mime, prompt)
	}

	block := fileBlock(data, mime)
	var result domain.DocumentCheckResult
	msg, err := s.client.Beta.Messages.New(ctx, anthropic.BetaMessageNewParams{
		Model:     anthropic.Model(s.settings.Current().DocumentCheckModel),
		MaxTokens: 16000,
		System:    []anthropic.BetaTextBlockParam{{Text: documentCheckSystemPrompt}},
		Messages: []anthropic.BetaMessageParam{
			anthropic.NewBetaUserMessage(block, anthropic.NewBetaTextBlock(prompt)),
		},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Format: anthropic.BetaJSONOutputFormatParam{Schema: &result},
		},
		// A safety-classifier decline is re-served by a fallback model
		// inside the same call instead of just stopping.
		Fallbacks: anthropic.BetaFallbacksParamOfDefault(),
		Betas:     []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
	})
	if err != nil {
		return nil, err
	}
	switch msg.StopReason {
	case anthropic.BetaStopReasonRefusal:
		return nil, fmt.Errorf("model declined to read the document")
	case anthropic.BetaStopReasonMaxTokens:
		return nil, fmt.Errorf("model response was cut off")
	}
	if err := msg.ParseOutput(&result); err != nil {
		return nil, fmt.Errorf("parsing model output: %w", err)
	}
	return &result, nil
}

// readFile loads a stored upload from local disk and checks it is a PDF or
// image the model can read.
func (s *DocumentCheckService) readFile(fileURL string) ([]byte, string, error) {
	u, err := url.Parse(fileURL)
	if err != nil || !strings.HasPrefix(u.Path, uploadURLPrefix) {
		return nil, "", &unsupportedDocumentError{"файл жүйеде сақталмаған (сыртқы сілтеме)"}
	}
	name := path.Base(u.Path)
	data, err := os.ReadFile(filepath.Join(s.uploadDir, name))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, "", &unsupportedDocumentError{"файл табылмады"}
		}
		return nil, "", err
	}

	switch mime := http.DetectContentType(data); mime {
	case "application/pdf":
		if len(data) > maxPDFBytes {
			return nil, "", &unsupportedDocumentError{"PDF файлы тым үлкен"}
		}
		return data, mime, nil
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		if len(data) > maxImageBytes {
			return nil, "", &unsupportedDocumentError{"сурет файлы тым үлкен (5 МБ-тан аспауы керек)"}
		}
		return data, mime, nil
	default:
		return nil, "", &unsupportedDocumentError{"файл пішімі қолдау көрсетілмейді (тек PDF, JPG, PNG, WEBP, GIF)"}
	}
}

// fileBlock wraps a file from readFile as an image or PDF block.
func fileBlock(data []byte, mime string) anthropic.BetaContentBlockParamUnion {
	if mime == "application/pdf" {
		return anthropic.NewBetaDocumentBlock(anthropic.BetaBase64PDFSourceParam{
			Data: base64.StdEncoding.EncodeToString(data),
		})
	}
	return anthropic.NewBetaImageBlock(anthropic.BetaBase64ImageSourceParam{
		Data:      base64.StdEncoding.EncodeToString(data),
		MediaType: anthropic.BetaBase64ImageSourceMediaType(mime),
	})
}

// documentCheckSchema is DocumentCheckResult's JSON schema, for OpenRouter's
// structured output. It's also put in the prompt: not every model honours
// response_format.
var documentCheckSchema = func() map[string]any {
	reflector := jsonschema.Reflector{DoNotReference: true}
	raw, err := json.Marshal(reflector.Reflect(&domain.DocumentCheckResult{}))
	if err != nil {
		panic(err)
	}
	var schema map[string]any
	if err := json.Unmarshal(raw, &schema); err != nil {
		panic(err)
	}
	delete(schema, "$schema")
	delete(schema, "$id")
	return schema
}()

// checkOpenRouter is check for OpenRouter. The model must read images; a
// PDF's text is extracted by OpenRouter's free pdf-text parser, so a
// scanned PDF without a text layer comes back unreadable.
func (s *DocumentCheckService) checkOpenRouter(ctx context.Context, data []byte, mime, prompt string) (*domain.DocumentCheckResult, error) {
	dataURL := "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
	var filePart map[string]any
	var plugins []map[string]any
	if mime == "application/pdf" {
		filePart = map[string]any{"type": "file", "file": map[string]any{"filename": "document.pdf", "file_data": dataURL}}
		plugins = []map[string]any{{"id": "file-parser", "pdf": map[string]any{"engine": "pdf-text"}}}
	} else {
		filePart = map[string]any{"type": "image_url", "image_url": map[string]any{"url": dataURL}}
	}
	schema, err := json.Marshal(documentCheckSchema)
	if err != nil {
		return nil, err
	}
	instructions := prompt + "\n\nAnswer with only a JSON object (no other text) matching this JSON schema:\n" + string(schema)

	var messages []json.RawMessage
	for _, m := range []orMessage{
		{Role: "system", Content: documentCheckSystemPrompt},
		{Role: "user", Content: []any{filePart, map[string]any{"type": "text", "text": instructions}}},
	} {
		raw, err := json.Marshal(m)
		if err != nil {
			return nil, err
		}
		messages = append(messages, raw)
	}
	msg, finish, err := s.openRouter.chat(ctx, orRequest{
		Model:    s.settings.Current().DocumentCheckModel,
		Messages: messages,
		ResponseFormat: map[string]any{
			"type":        "json_schema",
			"json_schema": map[string]any{"name": "document_check", "strict": true, "schema": documentCheckSchema},
		},
		Plugins: plugins,
	})
	if err != nil {
		return nil, err
	}
	if finish == "length" {
		return nil, fmt.Errorf("model response was cut off")
	}
	var result domain.DocumentCheckResult
	if err := json.Unmarshal([]byte(extractJSONObject(msg.textContent())), &result); err != nil {
		return nil, fmt.Errorf("parsing model output: %w", err)
	}
	return &result, nil
}
