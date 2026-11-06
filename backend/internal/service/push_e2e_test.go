package service

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/service/notifier"
)

// TestPushReachesABrowser plays the browser and its push service: it holds a
// subscription's private keys, receives what PushService really sends over
// HTTPS, and decrypts it the way a browser does (RFC 8291, aes128gcm). So it
// checks the bytes a real push service would accept and a phone could read,
// not just that a send function was called.
func TestPushReachesABrowser(t *testing.T) {
	browserKey, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	authSecret := make([]byte, 16)
	_, _ = rand.Read(authSecret)

	var body []byte
	var headers http.Header
	pushService := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ = io.ReadAll(r.Body)
		headers = r.Header.Clone()
		w.WriteHeader(http.StatusCreated)
	}))
	defer pushService.Close()

	vapidPrivate, vapidPublic, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	b64 := base64.RawURLEncoding
	repo := &memPushRepo{subs: []*domain.PushSubscription{{
		Endpoint: pushService.URL + "/send/abc",
		P256dh:   b64.EncodeToString(browserKey.PublicKey().Bytes()),
		Auth:     b64.EncodeToString(authSecret),
	}}}
	s := NewPushService(repo, vapidPublic, vapidPrivate, "https://korkyt.edu.kz")
	s.send = func(ctx context.Context, m []byte, sub *webpush.Subscription, o *webpush.Options) (*http.Response, error) {
		o.HTTPClient = pushService.Client()
		return webpush.SendNotificationWithContext(ctx, m, sub, o)
	}

	s.Push(context.Background(), uuid.New(), notifier.PushMessage{
		Title: "Өтінішіңіз мақұлданды", Body: "Шартқа қол қойыңыз", URL: "/applications/42",
	})

	if body == nil {
		t.Fatal("nothing reached the push service")
	}
	if got := headers.Get("Content-Encoding"); got != "aes128gcm" {
		t.Errorf("Content-Encoding = %q", got)
	}
	if headers.Get("TTL") != "86400" {
		t.Errorf("TTL = %q", headers.Get("TTL"))
	}
	// VAPID: "vapid t=<JWT>, k=<our public key>", so the push service knows
	// which server signed it.
	if auth := headers.Get("Authorization"); !strings.HasPrefix(auth, "vapid t=") || !strings.Contains(auth, "k="+vapidPublic) {
		t.Errorf("Authorization = %q", auth)
	}

	var got pushPayload
	if err := json.Unmarshal(decryptAES128GCM(t, body, browserKey, authSecret), &got); err != nil {
		t.Fatal(err)
	}
	want := pushPayload{Title: "Өтінішіңіз мақұлданды", Body: "Шартқа қол қойыңыз", URL: "/applications/42"}
	if got != want {
		t.Errorf("decrypted %+v, want %+v", got, want)
	}
}

// decryptAES128GCM undoes RFC 8291 message encryption as the receiving
// browser does: header (salt, record size, sender key), then ECDH + HKDF to
// the content key and nonce, then AES-GCM and padding removal.
func decryptAES128GCM(t *testing.T, body []byte, receiver *ecdh.PrivateKey, authSecret []byte) []byte {
	t.Helper()
	salt := body[:16]
	_ = binary.BigEndian.Uint32(body[16:20]) // record size
	keyLen := int(body[20])
	senderPublic, err := ecdh.P256().NewPublicKey(body[21 : 21+keyLen])
	if err != nil {
		t.Fatal(err)
	}
	ciphertext := body[21+keyLen:]

	shared, err := receiver.ECDH(senderPublic)
	if err != nil {
		t.Fatal(err)
	}
	keyInfo := append(append([]byte("WebPush: info\x00"), receiver.PublicKey().Bytes()...), senderPublic.Bytes()...)
	ikm, err := hkdf.Key(sha256.New, shared, authSecret, string(keyInfo), 32)
	if err != nil {
		t.Fatal(err)
	}
	cek, _ := hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: aes128gcm\x00", 16)
	nonce, _ := hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: nonce\x00", 12)

	block, _ := aes.NewCipher(cek)
	gcm, _ := cipher.NewGCM(block)
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	// The last record ends with a 0x02 delimiter, then zero padding.
	if i := bytes.LastIndexByte(plain, 0x02); i >= 0 {
		return plain[:i]
	}
	t.Fatal("no padding delimiter")
	return nil
}
