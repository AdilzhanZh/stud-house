package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
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
	// FloorID places the room; Floor (a number) still works too.
	FloorID  *uuid.UUID `json:"floor_id"`
	Floor    *int       `json:"floor"`
	Category string     `json:"category"`

	AreaSqM            *float64 `json:"area_sq_m"`
	Equipment          *string  `json:"equipment"`
	SanitaryConditions *string  `json:"sanitary_conditions"`
	IsAccessible       *bool    `json:"is_accessible"`
	AccessibilityNotes *string  `json:"accessibility_notes"`
	PhotoURLs          []string `json:"photo_urls"`
}

func (req roomRequest) toInput() service.RoomInput {
	return service.RoomInput{
		RoomNumber: req.RoomNumber,
		Capacity:   req.Capacity,
		FloorID:    req.FloorID,
		Floor:      req.Floor,
		Category:   req.Category,

		AreaSqM:            req.AreaSqM,
		Equipment:          req.Equipment,
		SanitaryConditions: req.SanitaryConditions,
		IsAccessible:       req.IsAccessible,
		AccessibilityNotes: req.AccessibilityNotes,
		PhotoURLs:          req.PhotoURLs,
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
	// BedID picks the bed place; omitted = the room's first free bed.
	BedID *uuid.UUID `json:"bed_id"`
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
	resident, err := h.rooms.AddResident(c.Request.Context(), roomID, req.StudentID, req.BedID)
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
	// Students may only see their own room's residents (their roommates);
	// staff may see any room's.
	if role, _ := middleware.Role(c); role == domain.RoleStudent {
		studentID, _ := middleware.UserID(c)
		_, room, err := h.rooms.GetActiveResidence(c.Request.Context(), studentID)
		if err != nil || room.ID != roomID {
			response.Error(c, apperror.Forbidden("тек өз бөлмеңіздің тұрғындарын ғана көре аласыз"))
			return
		}
	}
	residents, err := h.rooms.ListActiveResidents(c.Request.Context(), roomID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomResidentsDTO(residents))
}

type residenceResponse struct {
	RoomID      uuid.UUID  `json:"room_id"`
	DormitoryID uuid.UUID  `json:"dormitory_id"`
	RoomNumber  string     `json:"room_number"`
	Floor       *int       `json:"floor"`
	FloorName   *string    `json:"floor_name"`
	Capacity    int        `json:"capacity"`
	BedID       *uuid.UUID `json:"bed_id"`
	BedLabel    *string    `json:"bed_label"`
	BedCode     *string    `json:"bed_code"`
	MovedInAt   time.Time  `json:"moved_in_at"`
}

// GetMyResidence is available to the owning student or staff
// (reuses canReadStudentResource from user_handler.go): the current active
// room + its dormitory, or 404 if the student has none.
func (h *RoomHandler) GetMyResidence(c *gin.Context) {
	studentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("студент идентификаторы дұрыс емес"))
		return
	}
	if !canReadStudentResource(c, studentID) {
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
		Floor:       room.Floor,
		FloorName:   room.FloorName,
		Capacity:    room.Capacity,
		BedID:       resident.BedID,
		BedLabel:    resident.BedLabel,
		BedCode:     bedCodePtr(resident.BedInventoryNo),
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
	// BedID picks the bed place in RoomID; omitted = its first free bed.
	// Required to move a student to another bed of the same room.
	BedID *uuid.UUID `json:"bed_id"`
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
	resident, err := h.rooms.TransferResident(c.Request.Context(), residentRowID, req.RoomID, req.BedID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, roomResidentDTO(resident))
}

func parseBedID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("bedId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("төсек-орын идентификаторы дұрыс емес"))
		return uuid.Nil, false
	}
	return id, true
}

// ListBeds is staff-only: GET /rooms/:roomId/beds?include_retired=true.
func (h *RoomHandler) ListBeds(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("roomId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("бөлме идентификаторы дұрыс емес"))
		return
	}
	beds, err := h.rooms.ListBeds(c.Request.Context(), roomID, c.Query("include_retired") == "true")
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, bedsDTO(beds))
}

type addBedsRequest struct {
	Count int `json:"count" binding:"required"`
}

func (h *RoomHandler) AddBeds(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("roomId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("бөлме идентификаторы дұрыс емес"))
		return
	}
	var req addBedsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	beds, err := h.rooms.AddBeds(c.Request.Context(), roomID, req.Count)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, bedsDTO(beds))
}

type renameBedRequest struct {
	Label string `json:"label" binding:"required"`
}

func (h *RoomHandler) RenameBed(c *gin.Context) {
	bedID, ok := parseBedID(c)
	if !ok {
		return
	}
	var req renameBedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	bed, err := h.rooms.RenameBed(c.Request.Context(), bedID, req.Label)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, bedDTO(bed))
}

// RetireBed (DELETE /beds/:bedId) never deletes the record: the bed place
// is marked retired and keeps its id and history.
func (h *RoomHandler) RetireBed(c *gin.Context) {
	bedID, ok := parseBedID(c)
	if !ok {
		return
	}
	if err := h.rooms.RetireBed(c.Request.Context(), bedID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type bedStatusRequest struct {
	Status domain.BedServiceStatus `json:"status" binding:"required"`
	Reason *string                 `json:"reason"`
	// Until is the expected date the bed is back in service, YYYY-MM-DD.
	Until *string `json:"until"`
	// The act (акт) behind the change: number and date (YYYY-MM-DD) are
	// required, the uploaded scan optional.
	ActNumber  string  `json:"act_number"`
	ActDate    string  `json:"act_date"`
	ActFileURL *string `json:"act_file_url"`
}

// SetBedStatus (PATCH /beds/:bedId/status) takes a bed out of service
// (repair / unavailable) or returns it to service (in_service).
func (h *RoomHandler) SetBedStatus(c *gin.Context) {
	bedID, ok := parseBedID(c)
	if !ok {
		return
	}
	var req bedStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	var until *time.Time
	if req.Until != nil && *req.Until != "" {
		t, err := time.Parse(time.DateOnly, *req.Until)
		if err != nil {
			response.Error(c, apperror.BadRequest("күн форматы дұрыс емес (ЖЖЖЖ-АА-КК)"))
			return
		}
		until = &t
	}
	act := domain.BedAct{Number: req.ActNumber, FileURL: req.ActFileURL}
	if req.ActDate != "" {
		t, err := time.Parse(time.DateOnly, req.ActDate)
		if err != nil {
			response.Error(c, apperror.BadRequest("күн форматы дұрыс емес (ЖЖЖЖ-АА-КК)"))
			return
		}
		act.Date = t
	}
	actorID, _ := middleware.UserID(c)
	bed, err := h.rooms.SetBedStatus(c.Request.Context(), bedID, req.Status, req.Reason, until, act, actorID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, bedDTO(bed))
}

// BedStatusHistory (GET /beds/:bedId/status-history) lists the bed's
// service-status changes, newest first.
func (h *RoomHandler) BedStatusHistory(c *gin.Context) {
	bedID, ok := parseBedID(c)
	if !ok {
		return
	}
	bed, changes, err := h.rooms.BedStatusHistory(c.Request.Context(), bedID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, bedStatusHistoryDTO(bed, changes))
}

func (h *RoomHandler) BedHistory(c *gin.Context) {
	bedID, ok := parseBedID(c)
	if !ok {
		return
	}
	bed, stays, err := h.rooms.BedHistory(c.Request.Context(), bedID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, bedHistoryResponse{Bed: bedDTO(bed), Stays: roomResidentsDTO(stays)})
}
