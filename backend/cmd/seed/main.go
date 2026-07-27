// seed is a one-off CLI to create (or update) the system's admin user
// directly via the repository layer, bypassing UserService.CreateUser's
// "only one admin allowed" check — this is precisely how that one admin
// gets in on a fresh database. Safe to re-run: if the email already exists,
// its password and role are just updated instead of failing.
package main

import (
	"context"
	"errors"
	"flag"
	"log"

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

	existing, err := users.GetByEmail(ctx, *email)
	switch {
	case err == nil:
		if err := users.UpdatePassword(ctx, existing.ID, passwordHash); err != nil {
			log.Fatalf("failed to update admin password: %v", err)
		}
		if existing.Role != domain.RoleAdmin {
			if err := users.UpdateRole(ctx, existing.ID, domain.RoleAdmin); err != nil {
				log.Fatalf("failed to update admin role: %v", err)
			}
		}
		log.Printf("updated existing user %s (%s) to admin with the given password", existing.ID, *email)
	case errors.Is(err, repository.ErrNotFound):
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
	default:
		log.Fatalf("failed to look up admin by email: %v", err)
	}
}
