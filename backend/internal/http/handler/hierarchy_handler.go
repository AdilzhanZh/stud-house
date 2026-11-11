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

// HierarchyHandler serves objects (above a dormitory building), floors
// (below it) and the full registry.
type HierarchyHandler struct {
	svc *service.HierarchyService
}

func NewHierarchyHandler(svc *service.HierarchyService) *HierarchyHandler {
	return &HierarchyHandler{svc: svc}
}

type objectResponse struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	OwnerName      *string   `json:"owner_name"`
	BIN            *string   `json:"bin"`
	OwnershipForm  *string   `json:"ownership_form"`
	Phone          *string   `json:"phone"`
	DormitoryCount int       `json:"dormitory_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func objectDTO(o *domain.DormObject) objectResponse {
	return objectResponse{
		ID: o.ID, Name: o.Name, OwnerName: o.OwnerName, BIN: o.BIN, OwnershipForm: o.OwnershipForm,
		Phone: o.Phone, DormitoryCount: o.DormitoryCount, CreatedAt: o.CreatedAt, UpdatedAt: o.UpdatedAt,
	}
}

type objectRequest struct {
	Name          string  `json:"name" binding:"required"`
	OwnerName     *string `json:"owner_name"`
	BIN           *string `json:"bin"`
	OwnershipForm *string `json:"ownership_form"`
	Phone         *string `json:"phone"`
}

func (r objectRequest) toInput() service.ObjectInput {
	return service.ObjectInput{Name: r.Name, OwnerName: r.OwnerName, BIN: r.BIN,
		OwnershipForm: r.OwnershipForm, Phone: r.Phone}
}

func parseObjectID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("objectId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("объект идентификаторы дұрыс емес"))
		return uuid.Nil, false
	}
	return id, true
}

func (h *HierarchyHandler) ListObjects(c *gin.Context) {
	list, err := h.svc.ListObjects(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]objectResponse, 0, len(list))
	for _, o := range list {
		out = append(out, objectDTO(o))
	}
	response.OK(c, out)
}

func (h *HierarchyHandler) GetObject(c *gin.Context) {
	id, ok := parseObjectID(c)
	if !ok {
		return
	}
	o, err := h.svc.GetObject(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, objectDTO(o))
}

func (h *HierarchyHandler) CreateObject(c *gin.Context) {
	var req objectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	o, err := h.svc.CreateObject(c.Request.Context(), req.toInput())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, objectDTO(o))
}

func (h *HierarchyHandler) UpdateObject(c *gin.Context) {
	id, ok := parseObjectID(c)
	if !ok {
		return
	}
	var req objectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	o, err := h.svc.UpdateObject(c.Request.Context(), id, req.toInput())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, objectDTO(o))
}

func (h *HierarchyHandler) DeleteObject(c *gin.Context) {
	id, ok := parseObjectID(c)
	if !ok {
		return
	}
	if err := h.svc.DeleteObject(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type moveDormitoriesRequest struct {
	DormitoryIDs []uuid.UUID `json:"dormitory_ids" binding:"required"`
}

// MoveDormitories: POST /dorm-objects/:objectId/dormitories — puts the
// listed buildings into this object (merging their old objects into it).
func (h *HierarchyHandler) MoveDormitories(c *gin.Context) {
	id, ok := parseObjectID(c)
	if !ok {
		return
	}
	var req moveDormitoriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	o, err := h.svc.MoveDormitories(c.Request.Context(), id, req.DormitoryIDs)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, objectDTO(o))
}

type floorResponse struct {
	ID          uuid.UUID  `json:"id"`
	DormitoryID uuid.UUID  `json:"dormitory_id"`
	Number      *int       `json:"number"`
	Name        *string    `json:"name"`
	CreatedAt   time.Time  `json:"created_at"`
	RetiredAt   *time.Time `json:"retired_at"`
	RoomCount   int        `json:"room_count"`
}

func floorDTO(f *domain.Floor) floorResponse {
	return floorResponse{ID: f.ID, DormitoryID: f.DormitoryID, Number: f.Number, Name: f.Name,
		CreatedAt: f.CreatedAt, RetiredAt: f.RetiredAt, RoomCount: f.RoomCount}
}

type floorRequest struct {
	Number *int    `json:"number" binding:"required"`
	Name   *string `json:"name"`
}

func parseFloorID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("floorId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("қабат идентификаторы дұрыс емес"))
		return uuid.Nil, false
	}
	return id, true
}

// ListFloors: GET /dormitories/:id/floors?include_retired=true.
func (h *HierarchyHandler) ListFloors(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	list, err := h.svc.ListFloors(c.Request.Context(), dormitoryID, c.Query("include_retired") == "true")
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]floorResponse, 0, len(list))
	for _, f := range list {
		out = append(out, floorDTO(f))
	}
	response.OK(c, out)
}

func (h *HierarchyHandler) CreateFloor(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	var req floorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	f, err := h.svc.CreateFloor(c.Request.Context(), dormitoryID, service.FloorInput{Number: *req.Number, Name: req.Name})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, floorDTO(f))
}

func (h *HierarchyHandler) UpdateFloor(c *gin.Context) {
	id, ok := parseFloorID(c)
	if !ok {
		return
	}
	var req floorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	f, err := h.svc.UpdateFloor(c.Request.Context(), id, service.FloorInput{Number: *req.Number, Name: req.Name})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, floorDTO(f))
}

func (h *HierarchyHandler) RetireFloor(c *gin.Context) {
	id, ok := parseFloorID(c)
	if !ok {
		return
	}
	if err := h.svc.RetireFloor(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type registryBedResponse struct {
	ID            uuid.UUID        `json:"id"`
	Code          string           `json:"code"`
	Label         string           `json:"label"`
	Occupied      bool             `json:"occupied"`
	Status        domain.BedStatus `json:"status"`
	ServiceReason *string          `json:"service_reason"`
	ServiceUntil  *string          `json:"service_until"`
	// When the bed's status last changed.
	StatusChangedAt *time.Time `json:"status_changed_at"`
}

type registryRoomResponse struct {
	ID         uuid.UUID             `json:"id"`
	RoomNumber string                `json:"room_number"`
	Capacity   int                   `json:"capacity"`
	Beds       []registryBedResponse `json:"beds"`
}

type registryFloorResponse struct {
	ID     uuid.UUID              `json:"id"`
	Number *int                   `json:"number"`
	Name   *string                `json:"name"`
	Rooms  []registryRoomResponse `json:"rooms"`
}

type registryDormitoryResponse struct {
	ID      uuid.UUID               `json:"id"`
	Name    string                  `json:"name"`
	Address string                  `json:"address"`
	Floors  []registryFloorResponse `json:"floors"`
}

type registryObjectResponse struct {
	ID            uuid.UUID                   `json:"id"`
	Name          string                      `json:"name"`
	OwnerName     *string                     `json:"owner_name"`
	OwnershipForm *string                     `json:"ownership_form"`
	Dormitories   []registryDormitoryResponse `json:"dormitories"`
}

func optionalUUIDQuery(c *gin.Context, key string) (*uuid.UUID, bool) {
	v := c.Query(key)
	if v == "" {
		return nil, true
	}
	id, err := uuid.Parse(v)
	if err != nil {
		response.Error(c, apperror.BadRequest("идентификатор дұрыс емес"))
		return nil, false
	}
	return &id, true
}

// Registry: GET /registry?object_id=&dormitory_id= — object → building →
// floor → room → bed.
func (h *HierarchyHandler) Registry(c *gin.Context) {
	objectID, ok := optionalUUIDQuery(c, "object_id")
	if !ok {
		return
	}
	dormitoryID, ok := optionalUUIDQuery(c, "dormitory_id")
	if !ok {
		return
	}
	tree, err := h.svc.Registry(c.Request.Context(), objectID, dormitoryID)
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]registryObjectResponse, 0, len(tree))
	for _, o := range tree {
		ro := registryObjectResponse{ID: o.ID, Name: o.Name, OwnerName: o.OwnerName,
			OwnershipForm: o.OwnershipForm, Dormitories: make([]registryDormitoryResponse, 0, len(o.Dormitories))}
		for _, d := range o.Dormitories {
			rd := registryDormitoryResponse{ID: d.ID, Name: d.Name, Address: d.Address,
				Floors: make([]registryFloorResponse, 0, len(d.Floors))}
			for _, f := range d.Floors {
				rf := registryFloorResponse{ID: f.ID, Number: f.Number, Name: f.Name,
					Rooms: make([]registryRoomResponse, 0, len(f.Rooms))}
				for _, r := range f.Rooms {
					rr := registryRoomResponse{ID: r.ID, RoomNumber: r.RoomNumber, Capacity: r.Capacity,
						Beds: make([]registryBedResponse, 0, len(r.Beds))}
					for _, b := range r.Beds {
						rr.Beds = append(rr.Beds, registryBedResponse{ID: b.ID, Code: domain.BedCode(b.InventoryNo),
							Label: b.Label, Occupied: b.Occupied, Status: b.Status,
							ServiceReason: b.ServiceReason, ServiceUntil: datePtr(b.ServiceUntil),
							StatusChangedAt: b.StatusChangedAt})
					}
					rf.Rooms = append(rf.Rooms, rr)
				}
				rd.Floors = append(rd.Floors, rf)
			}
			ro.Dormitories = append(ro.Dormitories, rd)
		}
		out = append(out, ro)
	}
	response.OK(c, out)
}
