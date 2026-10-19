package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
)

// keySealer encrypts the admin-set AI API key for storage (AES-256-GCM),
// so a database dump or backup alone doesn't reveal it. Its key is derived
// from a server secret (SETTINGS_ENCRYPTION_KEY, else JWT_SECRET): if that
// secret changes, a stored key can no longer be opened and the admin has
// to set it again.
type keySealer struct {
	aead cipher.AEAD
}

func newKeySealer(secret string) (*keySealer, error) {
	if secret == "" {
		return nil, errors.New("no secret to derive the API key encryption key from")
	}
	sum := sha256.Sum256([]byte("student-house/ai-api-key/v1:" + secret))
	block, err := aes.NewCipher(sum[:])
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &keySealer{aead: aead}, nil
}

// seal returns nonce || ciphertext.
func (k *keySealer) seal(plaintext string) ([]byte, error) {
	nonce := make([]byte, k.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return k.aead.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

func (k *keySealer) open(sealed []byte) (string, error) {
	n := k.aead.NonceSize()
	if len(sealed) < n {
		return "", errors.New("sealed key too short")
	}
	plain, err := k.aead.Open(nil, sealed[:n], sealed[n:], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
