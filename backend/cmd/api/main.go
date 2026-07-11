package main

import (
	"context"
	"log"
	"time"

	"student-house/internal/config"
	apihttp "student-house/internal/http"
	"student-house/internal/http/handler"
	"student-house/internal/repository/postgres"
	"student-house/internal/service"
	"student-house/internal/service/notifier"
	"student-house/pkg/mailer"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	ctx := context.Background()
	pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	userRepo := postgres.NewUserRepo(pool)
	studentProfileRepo := postgres.NewStudentProfileRepo(pool)
	dormitoryRepo := postgres.NewDormitoryRepo(pool)
	roomRepo := postgres.NewRoomRepo(pool)
	benefitRepo := postgres.NewBenefitRepo(pool)
	requiredDocumentRepo := postgres.NewRequiredDocumentRepo(pool)
	studentBenefitRepo := postgres.NewStudentBenefitRepo(pool)
	refreshTokenRepo := postgres.NewRefreshTokenRepo(pool)
	applicationRepo := postgres.NewApplicationRepo(pool)
	applicationDocumentRepo := postgres.NewApplicationDocumentRepo(pool)
	notificationRepo := postgres.NewNotificationRepo(pool)
	reportTemplateRepo := postgres.NewReportTemplateRepo(pool)
	reportRepo := postgres.NewReportRepo(pool)
	contractRepo := postgres.NewContractRepo(pool)
	paymentRepo := postgres.NewPaymentRepo(pool)
	exitRequestRepo := postgres.NewExitRequestRepo(pool)
	transferRequestRepo := postgres.NewTransferRequestRepo(pool)

	mailerService := mailer.New(mailer.Config{
		Host:     cfg.SMTPHost,
		Port:     cfg.SMTPPort,
		Username: cfg.SMTPUsername,
		Password: cfg.SMTPPassword,
		From:     cfg.SMTPFrom,
	})
	if !mailerService.Enabled() {
		log.Print("SMTP not configured (SMTP_USERNAME/SMTP_PASSWORD empty) — approval emails will be skipped")
	}

	authService := service.NewAuthService(userRepo, studentProfileRepo, refreshTokenRepo, mailerService, cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	userService := service.NewUserService(userRepo, studentProfileRepo, mailerService)
	dormitoryService := service.NewDormitoryService(dormitoryRepo, applicationRepo)
	roomService := service.NewRoomService(roomRepo, dormitoryRepo, userRepo, studentProfileRepo, studentBenefitRepo)
	benefitService := service.NewBenefitService(benefitRepo, userRepo, studentBenefitRepo)
	documentService := service.NewDocumentService(requiredDocumentRepo)
	notifierService := notifier.New(notificationRepo)
	applicationService := service.NewApplicationService(applicationRepo, applicationDocumentRepo, dormitoryRepo, roomRepo, roomService, userRepo, notifierService, mailerService)
	notificationService := service.NewNotificationService(notificationRepo)
	reportService := service.NewReportService(reportTemplateRepo, reportRepo, applicationRepo, userRepo, notifierService)
	contractService := service.NewContractService(contractRepo, applicationRepo, reportRepo, reportTemplateRepo, userRepo, notifierService, mailerService, cfg.ContractResponseDeadline, cfg.ContractReminderWindow, cfg.PaymentDeadline)
	paymentService := service.NewPaymentService(paymentRepo, contractRepo, applicationRepo, userRepo, notifierService, mailerService, cfg.ContractReminderWindow, cfg.PaymentReapplyBlock)
	exitRequestService := service.NewExitRequestService(exitRequestRepo, roomRepo, userRepo, notifierService, mailerService)
	transferRequestService := service.NewTransferRequestService(transferRequestRepo, applicationRepo, roomRepo, roomService, userRepo, notifierService, mailerService)

	// Phase 4 hook into phase 3's vote tally: once a report is approved,
	// auto-generate contracts for its applications.
	reportService.SetOnApproved(contractService.OnReportApproved)

	handlers := apihttp.Handlers{
		Auth:            handler.NewAuthHandler(authService),
		User:            handler.NewUserHandler(userService),
		Dormitory:       handler.NewDormitoryHandler(dormitoryService),
		Room:            handler.NewRoomHandler(roomService),
		Benefit:         handler.NewBenefitHandler(benefitService),
		Document:        handler.NewDocumentHandler(documentService),
		Application:     handler.NewApplicationHandler(applicationService),
		Notification:    handler.NewNotificationHandler(notificationService),
		Report:          handler.NewReportHandler(reportService),
		Contract:        handler.NewContractHandler(contractService, applicationService),
		Payment:         handler.NewPaymentHandler(paymentService, contractService, applicationService),
		ExitRequest:     handler.NewExitRequestHandler(exitRequestService),
		TransferRequest: handler.NewTransferRequestHandler(transferRequestService),
		Upload:          handler.NewUploadHandler(cfg.UploadDir),
	}

	router := apihttp.NewRouter(cfg.JWTSecret, cfg.UploadDir, handlers)

	stopExpiryChecker := startContractExpiryChecker(contractService, cfg.ContractExpiryCheckInterval)
	defer stopExpiryChecker()

	stopPaymentExpiryChecker := startPaymentExpiryChecker(paymentService, cfg.ContractExpiryCheckInterval)
	defer stopPaymentExpiryChecker()

	log.Printf("listening on :%s", cfg.ServerPort)
	if err := router.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

// startContractExpiryChecker runs ContractService.FlagOverdueContracts and
// RemindApproachingDeadline on a ticker, so contracts don't need a client to
// call POST /admin/contracts/expire-check. Flagging never rejects an
// application by itself — only ContractService.ManagerDecision does that.
// Returns a stop func.
func startContractExpiryChecker(contracts *service.ContractService, interval time.Duration) func() {
	ticker := time.NewTicker(interval)
	done := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				ctx := context.Background()
				if n, err := contracts.FlagOverdueContracts(ctx); err != nil {
					log.Printf("contract overdue flagging failed: %v", err)
				} else if n > 0 {
					log.Printf("flagged %d overdue contract(s) for manager decision", n)
				}
				if n, err := contracts.RemindApproachingDeadline(ctx); err != nil {
					log.Printf("contract deadline reminder failed: %v", err)
				} else if n > 0 {
					log.Printf("sent %d contract deadline reminder(s)", n)
				}
			case <-done:
				return
			}
		}
	}()
	return func() {
		ticker.Stop()
		close(done)
	}
}

// startPaymentExpiryChecker runs PaymentService.FlagOverduePayments and
// RemindApproachingPaymentDeadline on a ticker, mirroring
// startContractExpiryChecker. Flagging never rejects an application by
// itself — only PaymentService.ManagerDecision does that. Returns a stop func.
func startPaymentExpiryChecker(payments *service.PaymentService, interval time.Duration) func() {
	ticker := time.NewTicker(interval)
	done := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				ctx := context.Background()
				if n, err := payments.FlagOverduePayments(ctx); err != nil {
					log.Printf("payment overdue flagging failed: %v", err)
				} else if n > 0 {
					log.Printf("flagged %d overdue payment(s) for manager decision", n)
				}
				if n, err := payments.RemindApproachingPaymentDeadline(ctx); err != nil {
					log.Printf("payment deadline reminder failed: %v", err)
				} else if n > 0 {
					log.Printf("sent %d payment deadline reminder(s)", n)
				}
			case <-done:
				return
			}
		}
	}()
	return func() {
		ticker.Stop()
		close(done)
	}
}
