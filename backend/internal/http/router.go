package http

import (
	"github.com/gin-gonic/gin"

	"student-house/internal/domain"
	"student-house/internal/http/handler"
	"student-house/internal/http/middleware"
)

type Handlers struct {
	Auth            *handler.AuthHandler
	User            *handler.UserHandler
	Dormitory       *handler.DormitoryHandler
	Room            *handler.RoomHandler
	Benefit         *handler.BenefitHandler
	Document        *handler.DocumentHandler
	Application     *handler.ApplicationHandler
	Notification    *handler.NotificationHandler
	Report          *handler.ReportHandler
	Contract        *handler.ContractHandler
	ExitRequest     *handler.ExitRequestHandler
	TransferRequest *handler.TransferRequestHandler
	Upload          *handler.UploadHandler
}

func NewRouter(jwtSecret string, uploadDir string, h Handlers) *gin.Engine {
	r := gin.Default()
	r.Use(middleware.DetectLanguage())

	admin := middleware.RequireRole(domain.RoleAdmin)
	adminOrManager := middleware.RequireRole(domain.RoleAdmin, domain.RoleManager)
	studentOnly := middleware.RequireRole(domain.RoleStudent)
	committeeOnly := middleware.RequireCommitteeMember()
	auth := middleware.RequireAuth(jwtSecret)

	api := r.Group("/api/v1")
	{
		// Publicly readable (files are only linked from admin-authored report
		// templates, same trust level as the plain external URLs this replaces).
		api.Static("/uploads", uploadDir)

		authGroup := api.Group("/auth")
		{
			authGroup.POST("/register", h.Auth.Register)
			authGroup.POST("/verify-email", h.Auth.VerifyEmail)
			authGroup.POST("/resend-verification", h.Auth.ResendVerification)
			authGroup.POST("/login", h.Auth.Login)
			authGroup.POST("/refresh", h.Auth.Refresh)
			authGroup.POST("/logout", h.Auth.Logout)
		}

		protected := api.Group("")
		protected.Use(auth)
		{
			// Admin-only: registering non-student users and assigning roles/chairperson.
			adminGroup := protected.Group("/admin")
			adminGroup.Use(admin)
			{
				adminGroup.POST("/users", h.User.CreateUser)
				adminGroup.PATCH("/users/:id/role", h.User.UpdateRole)
				adminGroup.PATCH("/users/:id/committee-member", h.User.SetCommitteeMember)
				adminGroup.PATCH("/committee-members/:id/chairperson", h.User.SetChairperson)
				adminGroup.DELETE("/users/:id", h.User.DeleteUser)
				adminGroup.PATCH("/users/:id/password", h.User.SetPassword)
			}

			// Read-only for any authenticated role.
			protected.GET("/admin/committee-members", h.User.ListCommitteeMembers)

			protected.GET("/dormitories", h.Dormitory.List)
			protected.GET("/dormitories/:id", h.Dormitory.Get)
			protected.GET("/dormitories/:id/capacity", h.Dormitory.GetCapacity)
			protected.GET("/dormitories/:id/images", h.Dormitory.ListImages)
			protected.GET("/dormitories/:id/rooms", h.Room.ListByDormitory)
			protected.GET("/rooms/:roomId", h.Room.Get)
			protected.GET("/rooms/:roomId/residents", h.Room.ListActiveResidents)
			protected.GET("/benefits", h.Benefit.List)
			protected.GET("/benefits/:id", h.Benefit.Get)
			protected.GET("/dormitories/:id/documents", h.Dormitory.ListRequiredDocuments)
			protected.GET("/benefits/:id/documents", h.Benefit.ListRequiredDocuments)
			protected.GET("/students/:id/benefits", h.Benefit.ListStudentBenefits)

			// Self-or-admin/manager: ownership is checked inside the handler.
			protected.PUT("/students/:id/profile", h.User.UpsertStudentProfile)
			protected.GET("/students/:id/profile", h.User.GetStudentProfile)
			protected.GET("/students/:id/residence", h.Room.GetMyResidence)
			protected.PATCH("/users/:id/avatar", h.User.UpdateAvatar)

			// Any authenticated user: their own password.
			protected.PATCH("/users/me/password", h.User.ChangeOwnPassword)

			// Any authenticated user: their own in-app notifications.
			protected.GET("/notifications", h.Notification.ListMine)
			protected.PATCH("/notifications/:id/read", h.Notification.MarkRead)
			protected.DELETE("/notifications/:id", h.Notification.Delete)
			protected.DELETE("/notifications", h.Notification.ClearAll)

			// Any authenticated user: students upload application documents,
			// admins/managers upload dormitory images and report
			// templates — all through the same generic file-storage endpoint.
			protected.POST("/uploads", h.Upload.Upload)

			// Any authenticated user: read a report (only a committee member
			// — is_committee_member=true — can vote).
			protected.GET("/reports/:id", h.Report.GetDetail)

			// Any authenticated user: ownership (student) or admin/manager is
			// checked inside the handler.
			protected.GET("/applications/:id", h.Application.GetDetail)
			protected.GET("/applications/:id/contract", h.Contract.GetByApplication)
			protected.GET("/exit-requests/:id", h.ExitRequest.Get)
			protected.GET("/transfer-requests/:id", h.TransferRequest.Get)

			// Committee-only: is_committee_member=true, an admin-toggled flag on
			// a manager (chairperson is a further flag on top of that).
			committeeGroup := protected.Group("")
			committeeGroup.Use(committeeOnly)
			{
				committeeGroup.PATCH("/reports/:id/vote", h.Report.Vote)
			}

			// Student-only: submitting and managing their own application.
			studentGroup := protected.Group("")
			studentGroup.Use(studentOnly)
			{
				studentGroup.POST("/students/me/benefits", h.Benefit.AssignOwnBenefit)

				studentGroup.POST("/applications", h.Application.Create)
				studentGroup.GET("/applications/my", h.Application.ListMine)
				studentGroup.PATCH("/applications/:id", h.Application.Resubmit)
				studentGroup.DELETE("/applications/:id", h.Application.Delete)
				studentGroup.POST("/applications/:id/documents", h.Application.AddDocument)

				studentGroup.GET("/contracts/my", h.Contract.ListMine)
				studentGroup.PATCH("/contracts/:id/respond", h.Contract.Respond)
				studentGroup.POST("/exit-requests", h.ExitRequest.Create)
				studentGroup.GET("/exit-requests/my", h.ExitRequest.ListMine)
				studentGroup.POST("/transfer-requests", h.TransferRequest.Create)
				studentGroup.GET("/transfer-requests/my", h.TransferRequest.ListMine)
			}

			// Admin+Manager: dormitory/room/benefit management.
			mgmt := protected.Group("")
			mgmt.Use(adminOrManager)
			{
				mgmt.POST("/dormitories", h.Dormitory.Create)
				mgmt.PATCH("/dormitories/:id", h.Dormitory.Update)
				mgmt.DELETE("/dormitories/:id", h.Dormitory.Delete)
				mgmt.POST("/dormitories/:id/images", h.Dormitory.AddImage)
				mgmt.DELETE("/dormitories/:id/images/:imageId", h.Dormitory.DeleteImage)
				mgmt.POST("/dormitories/:id/documents", h.Dormitory.AddRequiredDocument)
				mgmt.DELETE("/dormitory-documents/:documentId", h.Dormitory.DeleteRequiredDocument)

				mgmt.POST("/dormitories/:id/rooms", h.Room.Create)
				mgmt.PATCH("/rooms/:roomId", h.Room.Update)
				mgmt.DELETE("/rooms/:roomId", h.Room.Delete)
				mgmt.PATCH("/rooms/:roomId/restrictions", h.Room.UpdateRestrictions)
				mgmt.POST("/rooms/:roomId/residents", h.Room.AddResident)
				mgmt.DELETE("/room-residents/:residentId", h.Room.MoveOutResident)

				mgmt.POST("/benefits", h.Benefit.Create)
				mgmt.PATCH("/benefits/:id", h.Benefit.Update)
				mgmt.DELETE("/benefits/:id", h.Benefit.Delete)
				mgmt.POST("/benefits/:id/documents", h.Benefit.AddRequiredDocument)
				mgmt.DELETE("/benefit-documents/:documentId", h.Benefit.DeleteRequiredDocument)

				mgmt.POST("/documents", h.Document.Create)
				mgmt.GET("/documents", h.Document.List)
				mgmt.DELETE("/documents/:id", h.Document.Delete)

				mgmt.POST("/students/:id/benefits", h.Benefit.AssignBenefit)
				mgmt.DELETE("/students/:id/benefits/:benefitId", h.Benefit.RevokeBenefit)

				mgmt.GET("/admin/users", h.User.List)
				mgmt.GET("/admin/students/pending", h.User.ListPendingStudents)
				mgmt.PATCH("/admin/students/:id/approval", h.User.DecideStudentApproval)

				mgmt.GET("/applications", h.Application.List)
				mgmt.PATCH("/applications/:id/decision", h.Application.Decide)

				mgmt.POST("/notifications/broadcast", h.Notification.Broadcast)

				mgmt.POST("/report-templates", h.Report.CreateTemplate)
				mgmt.GET("/report-templates", h.Report.ListTemplates)
				mgmt.DELETE("/report-templates/:id", h.Report.DeleteTemplate)

				mgmt.GET("/reports", h.Report.List)
				mgmt.POST("/reports", h.Report.Create)
				mgmt.POST("/reports/:id/revise", h.Report.Revise)
				mgmt.GET("/reports/:id/export", h.Report.Export)
				mgmt.DELETE("/reports/:id", h.Report.Delete)

				mgmt.POST("/admin/contracts/expire-check", h.Contract.ExpireCheck)
				mgmt.GET("/contracts", h.Contract.List)
				mgmt.PATCH("/contracts/:id/manager-decision", h.Contract.ManagerDecision)

				mgmt.GET("/exit-requests", h.ExitRequest.List)
				mgmt.PATCH("/exit-requests/:id/decision", h.ExitRequest.Decide)

				mgmt.GET("/transfer-requests", h.TransferRequest.List)
				mgmt.PATCH("/transfer-requests/:id/decision", h.TransferRequest.Decide)
			}
		}
	}

	return r
}
