package handler

import (
	"github.com/gin-gonic/gin"

	"student-house/internal/service"
	"student-house/pkg/response"
)

type AcademicYearHandler struct {
	academicYear *service.AcademicYearService
}

func NewAcademicYearHandler(academicYear *service.AcademicYearService) *AcademicYearHandler {
	return &AcademicYearHandler{academicYear: academicYear}
}

// Rollover is admin-only: manually runs the same July-30 course-advance/
// graduation check the background ticker performs, for cron-less
// environments and manual verification. A no-op (empty results) most of
// the year — it only actually mutates data once per academic year.
func (h *AcademicYearHandler) Rollover(c *gin.Context) {
	results, err := h.academicYear.Run(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]gin.H, 0, len(results))
	for _, r := range results {
		out = append(out, gin.H{"year": r.Year, "graduated_count": r.Graduated, "advanced_count": r.Advanced})
	}
	response.OK(c, gin.H{"applied": out})
}
