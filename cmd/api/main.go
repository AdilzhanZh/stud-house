package main

import (
	"context"
	"log"

	"student-house/internal/config"
	apihttp "student-house/internal/http"
	"student-house/internal/http/handler"
	"student-house/internal/repository/postgres"
	"student-house/internal/service"
	"student-house/internal/service/notifier"
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
	studentBenefitRepo := postgres.NewStudentBenefitRepo(pool)
	refreshTokenRepo := postgres.NewRefreshTokenRepo(pool)
	applicationRepo := postgres.NewApplicationRepo(pool)
	applicationDocumentRepo := postgres.NewApplicationDocumentRepo(pool)
	notificationRepo := postgres.NewNotificationRepo(pool)
	reportTemplateRepo := postgres.NewReportTemplateRepo(pool)
	reportRepo := postgres.NewReportRepo(pool)

	authService := service.NewAuthService(userRepo, refreshTokenRepo, cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	userService := service.NewUserService(userRepo, studentProfileRepo)
	dormitoryService := service.NewDormitoryService(dormitoryRepo)
	roomService := service.NewRoomService(roomRepo, dormitoryRepo, userRepo, studentProfileRepo, studentBenefitRepo)
	benefitService := service.NewBenefitService(benefitRepo, userRepo, studentBenefitRepo)
	notifierService := notifier.New(notificationRepo)
	applicationService := service.NewApplicationService(applicationRepo, applicationDocumentRepo, dormitoryRepo, roomRepo, roomService, notifierService)
	notificationService := service.NewNotificationService(notificationRepo)
	reportService := service.NewReportService(reportTemplateRepo, reportRepo, applicationRepo, userRepo, notifierService)

	handlers := apihttp.Handlers{
		Auth:         handler.NewAuthHandler(authService),
		User:         handler.NewUserHandler(userService),
		Dormitory:    handler.NewDormitoryHandler(dormitoryService),
		Room:         handler.NewRoomHandler(roomService),
		Benefit:      handler.NewBenefitHandler(benefitService),
		Application:  handler.NewApplicationHandler(applicationService),
		Notification: handler.NewNotificationHandler(notificationService),
		Report:       handler.NewReportHandler(reportService),
	}

	router := apihttp.NewRouter(cfg.JWTSecret, handlers)

	log.Printf("listening on :%s", cfg.ServerPort)
	if err := router.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
