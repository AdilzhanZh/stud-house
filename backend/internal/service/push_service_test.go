package service

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

type memPushRepo struct {
	repository.PushSubscriptionRepository
	subs    []*domain.PushSubscription
	saved   []*domain.PushSubscription
	deleted []string
}

func (r *memPushRepo) Save(_ context.Context, s *domain.PushSubscription) error {
	r.saved = append(r.saved, s)
	return nil
}

func (r *memPushRepo) ListByUser(context.Context, uuid.UUID) ([]*domain.PushSubscription, error) {
	return r.subs, nil
}

func (r *memPushRepo) DeleteByEndpoint(_ context.Context, endpoint string) error {
	r.deleted = append(r.deleted, endpoint)
	return nil
}

func newTestPushService(repo *memPushRepo, status map[string]int) (*PushService, *[]string) {
	s := NewPushService(repo, "public", "private", "https://korkyt.edu.kz")
	var sent []string
	s.send = func(_ context.Context, message []byte, sub *webpush.Subscription, o *webpush.Options) (*http.Response, error) {
		if o.TTL != pushTTLSeconds || o.VAPIDPublicKey != "public" || o.VAPIDPrivateKey != "private" {
			return nil, errors.New("unexpected options")
		}
		var p pushPayload
		if err := json.Unmarshal(message, &p); err != nil {
			return nil, err
		}
		sent = append(sent, sub.Endpoint+" "+p.Title+" "+p.URL)
		code, ok := status[sub.Endpoint]
		if !ok {
			code = http.StatusCreated
		}
		return &http.Response{StatusCode: code, Body: io.NopCloser(strings.NewReader(""))}, nil
	}
	return s, &sent
}

func TestPushSendsToEveryDeviceAndDropsGoneOnes(t *testing.T) {
	repo := &memPushRepo{subs: []*domain.PushSubscription{
		{Endpoint: "https://push.example/live", P256dh: "k", Auth: "a"},
		{Endpoint: "https://push.example/gone", P256dh: "k", Auth: "a"},
		{Endpoint: "https://push.example/broken", P256dh: "k", Auth: "a"},
	}}
	s, sent := newTestPushService(repo, map[string]int{
		"https://push.example/gone":   http.StatusGone,
		"https://push.example/broken": http.StatusInternalServerError,
	})

	s.Push(context.Background(), uuid.New(), notifier.PushMessage{Title: "Мақұлданды", URL: "/applications/1"})

	if len(*sent) != 3 || (*sent)[0] != "https://push.example/live Мақұлданды /applications/1" {
		t.Errorf("sent = %v", *sent)
	}
	if len(repo.deleted) != 1 || repo.deleted[0] != "https://push.example/gone" {
		t.Errorf("only the gone subscription should be deleted, got %v", repo.deleted)
	}
}

func TestPushDoesNothingWithoutKeys(t *testing.T) {
	repo := &memPushRepo{subs: []*domain.PushSubscription{{Endpoint: "https://push.example/a"}}}
	s := NewPushService(repo, "", "", "")
	s.send = func(context.Context, []byte, *webpush.Subscription, *webpush.Options) (*http.Response, error) {
		t.Fatal("must not send without keys")
		return nil, nil
	}
	s.Push(context.Background(), uuid.New(), notifier.PushMessage{Title: "x"})
	if s.Enabled() {
		t.Error("Enabled() with no keys")
	}
}

func TestPushSubscribeValidates(t *testing.T) {
	for name, tc := range map[string]struct {
		endpoint, p256dh, auth string
	}{
		"plain http":     {"http://push.example/a", "k", "a"},
		"not a URL":      {"push.example/a", "k", "a"},
		"too long":       {"https://push.example/" + strings.Repeat("a", maxPushEndpointLength), "k", "a"},
		"no p256dh key":  {"https://push.example/a", " ", "a"},
		"no auth secret": {"https://push.example/a", "k", ""},
	} {
		repo := &memPushRepo{}
		s, _ := newTestPushService(repo, nil)
		err := s.Subscribe(context.Background(), uuid.New(), tc.endpoint, tc.p256dh, tc.auth, "")
		var appErr *apperror.AppError
		if !errors.As(err, &appErr) || appErr.Status != http.StatusBadRequest {
			t.Errorf("%s: want 400, got %v", name, err)
		}
		if len(repo.saved) != 0 {
			t.Errorf("%s: must not be saved", name)
		}
	}
}

func TestPushSubscribeSaves(t *testing.T) {
	repo := &memPushRepo{}
	s, _ := newTestPushService(repo, nil)
	userID := uuid.New()
	if err := s.Subscribe(context.Background(), userID, " https://push.example/a ", "k", "a", "Mozilla/5.0"); err != nil {
		t.Fatal(err)
	}
	if len(repo.saved) != 1 || repo.saved[0].UserID != userID || repo.saved[0].Endpoint != "https://push.example/a" {
		t.Errorf("saved = %+v", repo.saved)
	}
}

func TestPushSubscribeRefusedWhenDisabled(t *testing.T) {
	s := NewPushService(&memPushRepo{}, "", "", "")
	if err := s.Subscribe(context.Background(), uuid.New(), "https://push.example/a", "k", "a", ""); err == nil {
		t.Fatal("want an error when push isn't configured")
	}
}
