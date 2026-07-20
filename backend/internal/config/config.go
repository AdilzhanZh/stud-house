package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort      string
	DatabaseURL     string
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	// UploadDir is where POST /uploads writes files (report template files
	// uploaded from the admin's computer, instead of pasting an external URL).
	UploadDir string

	// SMTP* configure outgoing email (e.g. student registration approval
	// notices). Empty Username/Password disables sending — see pkg/mailer.
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string

	// ContractResponseDeadline is how long a student has to accept/decline a
	// contract before it's eligible to be flagged awaiting_manager_decision
	// (phase 5 fix: passing the deadline never auto-rejects by itself).
	ContractResponseDeadline time.Duration
	// ContractExpiryCheckInterval is how often the background job scans for
	// overdue contracts and deadline reminders; the same work is also
	// exposed as POST /admin/contracts/expire-check for cron-less environments.
	ContractExpiryCheckInterval time.Duration
	// ContractReminderWindow: managers get reminded about a 'sent' contract
	// once its deadline is within this window (phase 5).
	ContractReminderWindow time.Duration
}

func Load() (*Config, error) {
	// .env is optional (e.g. in prod, real env vars are set directly)
	_ = godotenv.Load()

	cfg := &Config{
		ServerPort:   getEnv("SERVER_PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		JWTSecret:    getEnv("JWT_SECRET", ""),
		UploadDir:    getEnv("UPLOAD_DIR", "./uploads"),
		SMTPHost:     getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", getEnv("SMTP_USERNAME", "")),
	}

	accessMinutes, err := strconv.Atoi(getEnv("ACCESS_TOKEN_TTL_MINUTES", "15"))
	if err != nil {
		return nil, err
	}
	cfg.AccessTokenTTL = time.Duration(accessMinutes) * time.Minute

	refreshDays, err := strconv.Atoi(getEnv("REFRESH_TOKEN_TTL_DAYS", "30"))
	if err != nil {
		return nil, err
	}
	cfg.RefreshTokenTTL = time.Duration(refreshDays) * 24 * time.Hour

	contractDeadlineDays, err := strconv.Atoi(getEnv("CONTRACT_RESPONSE_DEADLINE_DAYS", "7"))
	if err != nil {
		return nil, err
	}
	cfg.ContractResponseDeadline = time.Duration(contractDeadlineDays) * 24 * time.Hour

	expiryCheckMinutes, err := strconv.Atoi(getEnv("CONTRACT_EXPIRY_CHECK_INTERVAL_MINUTES", "60"))
	if err != nil {
		return nil, err
	}
	cfg.ContractExpiryCheckInterval = time.Duration(expiryCheckMinutes) * time.Minute

	reminderHours, err := strconv.Atoi(getEnv("CONTRACT_REMINDER_HOURS_BEFORE_DEADLINE", "24"))
	if err != nil {
		return nil, err
	}
	cfg.ContractReminderWindow = time.Duration(reminderHours) * time.Hour

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
