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
	Application     *handler.ApplicationHandler
	Notification    *handler.NotificationHandler
	Report          *handler.ReportHandler
	Contract        *handler.ContractHandler
	Payment         *handler.PaymentHandler
	ExitRequest     *handler.ExitRequestHandler
	TransferRequest *handler.TransferRequestHandler
}

func NewRouter(jwtSecret string, h Handlers) *gin.Engine {
	r := gin.Default()

	admin := middleware.RequireRole(domain.RoleAdmin)
	adminOrManager := middleware.RequireRole(domain.RoleAdmin, domain.RoleManager)
	studentOnly := middleware.RequireRole(domain.RoleStudent)
	committeeOnly := middleware.RequireRole(domain.RoleCommitteeMember)
	auth := middleware.RequireAuth(jwtSecret)

	api := r.Group("/api/v1")
	{
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/register", h.Auth.Register)
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
				adminGroup.PATCH("/committee-members/:id/chairperson", h.User.SetChairperson)
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
			protected.GET("/benefits/:id/fields", h.Benefit.ListFields)
			protected.GET("/benefits/:id/documents", h.Benefit.ListRequiredDocuments)
			protected.GET("/students/:id/benefits", h.Benefit.ListStudentBenefits)

			// Self-or-admin/manager: ownership is checked inside the handler.
			protected.PUT("/students/:id/profile", h.User.UpsertStudentProfile)
			protected.GET("/students/:id/profile", h.User.GetStudentProfile)

			// Any authenticated user: their own in-app notifications.
			protected.GET("/notifications", h.Notification.ListMine)
			protected.PATCH("/notifications/:id/read", h.Notification.MarkRead)

			// Any authenticated user: read a report (only committee_member can vote).
			protected.GET("/reports/:id", h.Report.GetDetail)

			// Any authenticated user: ownership (student) or admin/manager is
			// checked inside the handler.
			protected.GET("/applications/:id/contract", h.Contract.GetByApplication)
			protected.GET("/contracts/:id/payment", h.Payment.GetByContract)
			protected.GET("/exit-requests/:id", h.ExitRequest.Get)
			protected.GET("/transfer-requests/:id", h.TransferRequest.Get)

			// Committee-only: chairperson qualifies automatically (a flag on
			// top of committee_member, not a separate role).
			committeeGroup := protected.Group("")
			committeeGroup.Use(committeeOnly)
			{
				committeeGroup.PATCH("/reports/:id/vote", h.Report.Vote)
			}

			// Student-only: submitting and managing their own application.
			studentGroup := protected.Group("")
			studentGroup.Use(studentOnly)
			{
				studentGroup.POST("/applications", h.Application.Create)
				studentGroup.GET("/applications/my", h.Application.ListMine)
				studentGroup.PATCH("/applications/:id", h.Application.Resubmit)
				studentGroup.POST("/applications/:id/documents", h.Application.AddDocument)

				studentGroup.PATCH("/contracts/:id/respond", h.Contract.Respond)
				studentGroup.POST("/payments/:id/submit", h.Payment.Submit)
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

				mgmt.POST("/dormitories/:id/rooms", h.Room.Create)
				mgmt.PATCH("/rooms/:roomId", h.Room.Update)
				mgmt.DELETE("/rooms/:roomId", h.Room.Delete)
				mgmt.PATCH("/rooms/:roomId/restrictions", h.Room.UpdateRestrictions)
				mgmt.POST("/rooms/:roomId/residents", h.Room.AddResident)
				mgmt.DELETE("/room-residents/:residentId", h.Room.MoveOutResident)

				mgmt.POST("/benefits", h.Benefit.Create)
				mgmt.PATCH("/benefits/:id", h.Benefit.Update)
				mgmt.DELETE("/benefits/:id", h.Benefit.Delete)
				mgmt.POST("/benefits/:id/fields", h.Benefit.AddField)
				mgmt.DELETE("/benefit-fields/:fieldId", h.Benefit.DeleteField)
				mgmt.POST("/benefits/:id/documents", h.Benefit.AddRequiredDocument)
				mgmt.DELETE("/benefit-documents/:documentId", h.Benefit.DeleteRequiredDocument)

				mgmt.POST("/students/:id/benefits", h.Benefit.AssignBenefit)
				mgmt.DELETE("/students/:id/benefits/:benefitId", h.Benefit.RevokeBenefit)

				mgmt.GET("/applications", h.Application.List)
				mgmt.GET("/applications/:id", h.Application.GetDetail)
				mgmt.PATCH("/applications/:id/decision", h.Application.Decide)

				mgmt.POST("/report-templates", h.Report.CreateTemplate)
				mgmt.GET("/report-templates", h.Report.ListTemplates)

				mgmt.POST("/reports", h.Report.Create)
				mgmt.GET("/reports", h.Report.List)
				mgmt.POST("/reports/:id/revise", h.Report.Revise)
				mgmt.GET("/reports/:id/export", h.Report.Export)

				mgmt.PATCH("/payments/:id/confirm", h.Payment.Confirm)
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
