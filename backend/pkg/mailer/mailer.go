// Package mailer sends plain-text notification emails over SMTP (e.g. Gmail
// with an app password). It's intentionally minimal — one method, no queue,
// no templates — since this codebase only needs it for one event so far
// (student registration approval).
package mailer

import (
	"fmt"
	"log"
	"net/smtp"
)

type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

type Mailer struct {
	cfg Config
}

func New(cfg Config) *Mailer {
	return &Mailer{cfg: cfg}
}

// Enabled reports whether SMTP credentials are configured. Callers should
// treat a disabled mailer as a no-op (e.g. local dev without real
// credentials) rather than an error.
func (m *Mailer) Enabled() bool {
	return m.cfg.Host != "" && m.cfg.Username != "" && m.cfg.Password != ""
}

// Send delivers a plain-text email synchronously. Callers that don't want to
// block on SMTP round-trip latency should call this in a goroutine and just
// log the error, the way notifier.Notifier's in-app notifications already do
// elsewhere in this codebase — a failed email must never fail the action
// that triggered it (e.g. approving a student).
func (m *Mailer) Send(to, subject, body string) error {
	if !m.Enabled() {
		log.Printf("mailer disabled (no SMTP_* configured), skipping email to %s: %s", to, subject)
		return nil
	}

	addr := fmt.Sprintf("%s:%s", m.cfg.Host, m.cfg.Port)
	auth := smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
	msg := []byte("From: " + m.cfg.From + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n" + body + "\r\n")

	return smtp.SendMail(addr, auth, m.cfg.From, []string{to}, msg)
}
