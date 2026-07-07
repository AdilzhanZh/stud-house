package http

import (
	"github.com/gin-gonic/gin"

	"student-house/internal/domain"
	"student-house/internal/http/handler"
	"student-house/internal/http/middleware"
)

type Handlers struct {
	Auth      *handler.AuthHandler
	User      *handler.UserHandler
	Dormitory *handler.DormitoryHandler
	Room      *handler.RoomHandler
	Benefit   *handler.BenefitHandler
}

func NewRouter(jwtSecret string, h Handlers) *gin.Engine {
	r := gin.Default()

	admin := middleware.RequireRole(domain.RoleAdmin)
	adminOrManager := middleware.RequireRole(domain.RoleAdmin, domain.RoleManager)
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
			}
		}
	}

	return r
}
