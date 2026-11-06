package service

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

const (
	// A notice that hasn't reached a phone within a day is stale: the
	// student will have seen it in the app or their email by then.
	pushTTLSeconds        = 24 * 60 * 60
	maxPushEndpointLength = 2048
	maxPushKeyLength      = 256
)

type pushSendFunc func(ctx context.Context, message []byte, s *webpush.Subscription, o *webpush.Options) (*http.Response, error)

// PushService keeps users' push subscriptions and sends Web Push messages to
// them, signed with the server's VAPID keys. It is how Notifier reaches a
// phone; with no keys configured it is disabled and does nothing.
type PushService struct {
	subscriptions repository.PushSubscriptionRepository
	publicKey     string
	privateKey    string
	// subject is the contact push services may use about misbehaving senders.
	subject string
	send    pushSendFunc
}

func NewPushService(subscriptions repository.PushSubscriptionRepository, publicKey, privateKey, subject string) *PushService {
	return &PushService{
		subscriptions: subscriptions,
		publicKey:     publicKey,
		privateKey:    privateKey,
		subject:       subject,
		send:          webpush.SendNotificationWithContext,
	}
}

func (s *PushService) Enabled() bool { return s.publicKey != "" && s.privateKey != "" }

// PublicKey is what a browser needs to subscribe (applicationServerKey).
func (s *PushService) PublicKey() string { return s.publicKey }

func (s *PushService) Subscribe(ctx context.Context, userID uuid.UUID, endpoint, p256dh, auth, userAgent string) error {
	if !s.Enabled() {
		return apperror.BadRequest("push-хабарламалар серверде бапталмаған")
	}
	endpoint, p256dh, auth = strings.TrimSpace(endpoint), strings.TrimSpace(p256dh), strings.TrimSpace(auth)
	// Push services are always HTTPS; anything else is not a browser's endpoint,
	// and the server must not be made to POST to arbitrary addresses.
	if !strings.HasPrefix(endpoint, "https://") || len(endpoint) > maxPushEndpointLength {
		return apperror.BadRequest("push-жазылымның мекенжайы жарамсыз")
	}
	if p256dh == "" || auth == "" || len(p256dh) > maxPushKeyLength || len(auth) > maxPushKeyLength {
		return apperror.BadRequest("push-жазылымның кілттері жарамсыз")
	}
	if len(userAgent) > 512 {
		userAgent = userAgent[:512]
	}
	return s.subscriptions.Save(ctx, &domain.PushSubscription{
		UserID: userID, Endpoint: endpoint, P256dh: p256dh, Auth: auth, UserAgent: userAgent,
	})
}

func (s *PushService) Unsubscribe(ctx context.Context, userID uuid.UUID, endpoint string) error {
	return s.subscriptions.DeleteForUser(ctx, userID, strings.TrimSpace(endpoint))
}

type pushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
}

// Push sends msg to every device the user subscribed. Delivery is best-effort:
// the notification is already stored in the app and maybe emailed, so a failed
// push is only logged. A subscription the push service reports gone (the user
// revoked permission or reinstalled) is deleted so it isn't tried again.
func (s *PushService) Push(ctx context.Context, userID uuid.UUID, msg notifier.PushMessage) {
	if !s.Enabled() {
		return
	}
	subs, err := s.subscriptions.ListByUser(ctx, userID)
	if err != nil {
		log.Printf("failed to list push subscriptions of %s: %v", userID, err)
		return
	}
	if len(subs) == 0 {
		return
	}
	payload, err := json.Marshal(pushPayload(msg))
	if err != nil {
		log.Printf("failed to encode push message: %v", err)
		return
	}
	options := &webpush.Options{
		Subscriber:      s.subject,
		VAPIDPublicKey:  s.publicKey,
		VAPIDPrivateKey: s.privateKey,
		TTL:             pushTTLSeconds,
		Urgency:         webpush.UrgencyNormal,
	}
	for _, sub := range subs {
		resp, err := s.send(ctx, payload, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
		}, options)
		if err != nil {
			log.Printf("push to %s failed: %v", userID, err)
			continue
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		switch {
		case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
			if err := s.subscriptions.DeleteByEndpoint(ctx, sub.Endpoint); err != nil {
				log.Printf("failed to delete expired push subscription: %v", err)
			}
		case resp.StatusCode >= 300:
			log.Printf("push to %s rejected: HTTP %d", userID, resp.StatusCode)
		}
	}
}
