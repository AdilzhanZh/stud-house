package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type RoomHandler struct {
	rooms *service.RoomService
}

func NewRoomHandler(rooms *service.RoomService) *RoomHandler {
	return &RoomHandler{rooms: rooms}
}

// roomRequest is shared by create/update.
type roomRequest struct {
	RoomNumber string `json:"room_number" binding:"required"`
	Capacity   int    `json:"capacity" binding:"required"`
	Floor      *int   `json:"floor"`
	Category   string `json:"category"`
}

func (req roomRequest) toInput() service.RoomInput {
	return service.RoomInput{
		RoomNumber: req.RoomNumber,
		Capacity:   req.Capacity,
		Floor:      req.Floor,
		Category:   req.Category,
	}
}

func (h *RoomHandler) Create(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	var req roomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	room, err := h.rooms.Create(c.Request.Context(), dormitoryID, req.toInput())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, roomDTO(room))
}

func (h *RoomHandler) ListByDormitory(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	rooms, err := h.rooms.ListByDormitory(c.Request.Context(), dormitoryID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomsDTO(rooms))
}

// ListAvailability is like ListByDormitory but includes each room's current
// resident and hold counts in one response, so the student-facing room
// picker doesn't need to fetch residents per room to know which rooms are
// still pickable.
func (h *RoomHandler) ListAvailability(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	rooms, err := h.rooms.ListAvailabilityByDormitory(c.Request.Context(), dormitoryID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomsAvailabilityDTO(rooms))
}

func (h *RoomHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("roomId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("бөлме идентификаторы дұрыс емес"))
		return
	}
	room, err := h.rooms.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomDTO(room))
}

func (h *RoomHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("roomId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("бөлме идентификаторы дұрыс емес"))
		return
	}
	var req roomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	room, err := h.rooms.Update(c.Request.Context(), id, req.toInput())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomDTO(room))
}

func (h *RoomHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("roomId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("бөлме идентификаторы дұрыс емес"))
		return
	}
	if err := h.rooms.Delete(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type updateRestrictionsRequest struct {
	Gender     *domain.Gender          `json:"gender"`
	Courses    []int16                 `json:"courses"`
	Degrees    []domain.AcademicDegree `json:"degrees"`
	BenefitIDs []uuid.UUID             `json:"benefit_ids"`
}

// UpdateRestrictions rejects the change (409) if any current resident would
// violate the new restrictions.
func (h *RoomHandler) UpdateRestrictions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("roomId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("бөлме идентификаторы дұрыс емес"))
		return
	}
	var req updateRestrictionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	for _, d := range req.Degrees {
		if !d.Valid() {
			response.Error(c, apperror.BadRequest("жарамсыз оқу деңгейі: "+string(d)))
			return
		}
	}
	restrictions := domain.RoomRestrictions{Gender: req.Gender, Courses: req.Courses, Degrees: req.Degrees, BenefitIDs: req.BenefitIDs}
	room, err := h.rooms.UpdateRestrictions(c.Request.Context(), id, restrictions)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomDTO(room))
}

type addResidentRequest struct {
	StudentID uuid.UUID `json:"student_id" binding:"required"`
}

func (h *RoomHandler) AddResident(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("roomId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("бөлме идентификаторы дұрыс емес"))
		return
	}
	var req addResidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	resident, err := h.rooms.AddResident(c.Request.Context(), roomID, req.StudentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, roomResidentDTO(resident))
}

func (h *RoomHandler) ListActiveResidents(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("roomId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("бөлме идентификаторы дұрыс емес"))
		return
	}
	residents, err := h.rooms.ListActiveResidents(c.Request.Context(), roomID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomResidentsDTO(residents))
}

type residenceResponse struct {
	RoomID      uuid.UUID `json:"room_id"`
	DormitoryID uuid.UUID `json:"dormitory_id"`
	RoomNumber  string    `json:"room_number"`
	Capacity    int       `json:"capacity"`
	MovedInAt   time.Time `json:"moved_in_at"`
}

// GetMyResidence is available to the owning student or admin/manager
// (reuses canAccessStudentResource from user_handler.go): the current active
// room + its dormitory, or 404 if the student has none.
func (h *RoomHandler) GetMyResidence(c *gin.Context) {
	studentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("студент идентификаторы дұрыс емес"))
		return
	}
	if !canAccessStudentResource(c, studentID) {
		response.Error(c, apperror.Forbidden("тек өз тұрғылықты жеріңізді ғана көре аласыз"))
		return
	}
	resident, room, err := h.rooms.GetActiveResidence(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, residenceResponse{
		RoomID:      room.ID,
		DormitoryID: room.DormitoryID,
		RoomNumber:  room.RoomNumber,
		Capacity:    room.Capacity,
		MovedInAt:   resident.MovedInAt,
	})
}

func (h *RoomHandler) MoveOutResident(c *gin.Context) {
	residentRowID, err := uuid.Parse(c.Param("residentId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("тұрғын идентификаторы дұрыс емес"))
		return
	}
	if err := h.rooms.MoveOutResident(c.Request.Context(), residentRowID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type transferResidentRequest struct {
	RoomID uuid.UUID `json:"room_id" binding:"required"`
}

func (h *RoomHandler) TransferResident(c *gin.Context) {
	residentRowID, err := uuid.Parse(c.Param("residentId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("тұрғын идентификаторы дұрыс емес"))
		return
	}
	var req transferResidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	resident, err := h.rooms.TransferResident(c.Request.Context(), residentRowID, req.RoomID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomResidentDTO(resident))
}
