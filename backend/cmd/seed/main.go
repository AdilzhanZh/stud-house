// seed is a one-off CLI to create (or update) the system's single admin
// user directly via the repository layer, bypassing UserService.CreateUser's
// "only one admin allowed" check — this is precisely how that one admin
// gets in on a fresh database. Safe to re-run with a different email:
// instead of creating a second admin, it repoints the existing one's login
// (email + password) at the new values.
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"sort"

	"student-house/internal/config"
	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/repository/postgres"
	"student-house/pkg/hasher"
)

func main() {
	email := flag.String("email", "studhouse@korkyt.kz", "admin login email")
	password := flag.String("password", "Admin123", "admin password")
	fullName := flag.String("full-name", "Админ", "admin full name (only used when creating)")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx := context.Background()
	pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	passwordHash, err := hasher.HashPassword(*password)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}

	users := postgres.NewUserRepo(pool)

	admins, err := users.ListByRole(ctx, domain.RoleAdmin)
	if err != nil {
		log.Fatalf("failed to list existing admins: %v", err)
	}

	if len(admins) == 0 {
		user := &domain.User{
			FullName:       *fullName,
			Email:          *email,
			PasswordHash:   passwordHash,
			Role:           domain.RoleAdmin,
			ApprovalStatus: domain.ApprovalApproved,
		}
		if err := users.Create(ctx, user); err != nil {
			log.Fatalf("failed to create admin: %v", err)
		}
		log.Printf("created admin user %s (%s)", user.ID, *email)
		return
	}

	// The system is only ever meant to have one admin. If more than one
	// exists (e.g. leftover fixture data from before this rule was
	// enforced), keep the oldest — most likely to have real data attached
	// via created_by foreign keys — and fold every later one into it.
	// Extras are removed *before* repointing the primary's email: one of
	// them may already hold the target email (e.g. a previous seed run
	// created a fresh admin instead of updating), which would otherwise
	// collide with the primary's email update below.
	sort.Slice(admins, func(i, j int) bool { return admins[i].CreatedAt.Before(admins[j].CreatedAt) })
	primary := admins[0]

	for _, extra := range admins[1:] {
		if err := users.Delete(ctx, extra.ID); err != nil {
			if errors.Is(err, repository.ErrConflict) {
				log.Printf(
					"warning: extra admin %s (%s) has linked data and could not be removed automatically — reassign or clean up manually",
					extra.ID, extra.Email,
				)
				continue
			}
			log.Printf("warning: failed to remove extra admin %s (%s): %v", extra.ID, extra.Email, err)
			continue
		}
		log.Printf("removed extra admin %s (%s)", extra.ID, extra.Email)
	}

	if primary.Email != *email {
		if err := users.UpdateEmail(ctx, primary.ID, *email); err != nil {
			if errors.Is(err, repository.ErrConflict) {
				log.Fatalf("cannot set admin email to %s: another user already has this email", *email)
			}
			log.Fatalf("failed to update admin email: %v", err)
		}
	}
	if err := users.UpdatePassword(ctx, primary.ID, passwordHash); err != nil {
		log.Fatalf("failed to update admin password: %v", err)
	}
	log.Printf("updated admin user %s to email %s with the given password", primary.ID, *email)
}
