package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

type DormitoryService struct {
	dormitories repository.DormitoryRepository
}

func NewDormitoryService(dormitories repository.DormitoryRepository) *DormitoryService {
	return &DormitoryService{dormitories: dormitories}
}

func (s *DormitoryService) Create(ctx context.Context, name, address string, totalCapacity int, qrCodeURL *string, createdBy uuid.UUID) (*domain.Dormitory, error) {
	if name == "" || address == "" {
		return nil, apperror.BadRequest("name and address are required")
	}
	if totalCapacity < 0 {
		return nil, apperror.BadRequest("total_capacity cannot be negative")
	}
	d := &domain.Dormitory{
		Name:             name,
		Address:          address,
		TotalCapacity:    totalCapacity,
		PaymentQRCodeURL: qrCodeURL,
		CreatedBy:        createdBy,
	}
	if err := s.dormitories.Create(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *DormitoryService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Dormitory, error) {
	d, err := s.dormitories.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("dormitory not found")
		}
		return nil, err
	}
	return d, nil
}

func (s *DormitoryService) List(ctx context.Context) ([]*domain.Dormitory, error) {
	return s.dormitories.List(ctx)
}

func (s *DormitoryService) Update(ctx context.Context, id uuid.UUID, name, address string, totalCapacity int, qrCodeURL *string) (*domain.Dormitory, error) {
	if name == "" || address == "" {
		return nil, apperror.BadRequest("name and address are required")
	}
	if totalCapacity < 0 {
		return nil, apperror.BadRequest("total_capacity cannot be negative")
	}
	d := &domain.Dormitory{ID: id, Name: name, Address: address, TotalCapacity: totalCapacity, PaymentQRCodeURL: qrCodeURL}
	if err := s.dormitories.Update(ctx, d); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("dormitory not found")
		}
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *DormitoryService) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.dormitories.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("dormitory not found")
		}
		return err
	}
	return nil
}

func (s *DormitoryService) GetCapacity(ctx context.Context, id uuid.UUID) (*domain.DormitoryCapacity, error) {
	c, err := s.dormitories.GetCapacity(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("dormitory not found")
		}
		return nil, err
	}
	return c, nil
}

func (s *DormitoryService) AddImage(ctx context.Context, dormitoryID uuid.UUID, imageURL string) (*domain.DormitoryImage, error) {
	if imageURL == "" {
		return nil, apperror.BadRequest("image_url is required")
	}
	if _, err := s.GetByID(ctx, dormitoryID); err != nil {
		return nil, err
	}
	img := &domain.DormitoryImage{DormitoryID: dormitoryID, ImageURL: imageURL}
	if err := s.dormitories.AddImage(ctx, img); err != nil {
		return nil, err
	}
	return img, nil
}

func (s *DormitoryService) ListImages(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.DormitoryImage, error) {
	return s.dormitories.ListImages(ctx, dormitoryID)
}

func (s *DormitoryService) DeleteImage(ctx context.Context, imageID uuid.UUID) error {
	if err := s.dormitories.DeleteImage(ctx, imageID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("image not found")
		}
		return err
	}
	return nil
}
