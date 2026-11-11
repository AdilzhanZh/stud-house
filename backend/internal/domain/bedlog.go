package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// BedBasisType is the kind of document behind a change of a bed place's
// status (see BedStatusChange and migration 000101).
type BedBasisType string

const (
	BedBasisApplication     BedBasisType = "application"      // заявление на заселение
	BedBasisReservation     BedBasisType = "reservation"      // бронь
	BedBasisContract        BedBasisType = "contract"         // договор
	BedBasisExitRequest     BedBasisType = "exit_request"     // заявление на выселение
	BedBasisTransferRequest BedBasisType = "transfer_request" // заявление на перевод
	BedBasisAct             BedBasisType = "act"              // акт
)

// BedAct is the act (акт) a manager cites when taking a bed out of service
// or returning it.
type BedAct struct {
	Number  string
	Date    time.Time
	FileURL *string
}

// BedLogContext is what the bed status log needs to know about the current
// request: who acts and, when the caller knows better than the database,
// which document is the basis. The connection pool hands it to the database
// (postgres.NewPool), where the logging triggers read it.
type BedLogContext struct {
	ActorID   *uuid.UUID
	BasisType BedBasisType
	BasisID   *uuid.UUID
	Act       *BedAct
}

type bedLogKey struct{}

// BedLogFrom returns the request's bed log context, nil if none.
func BedLogFrom(ctx context.Context) *BedLogContext {
	c, _ := ctx.Value(bedLogKey{}).(*BedLogContext)
	return c
}

func withBedLog(ctx context.Context, change func(*BedLogContext)) context.Context {
	next := BedLogContext{}
	if cur := BedLogFrom(ctx); cur != nil {
		next = *cur
	}
	change(&next)
	return context.WithValue(ctx, bedLogKey{}, &next)
}

// WithBedActor records who makes the request's bed status changes.
func WithBedActor(ctx context.Context, actorID uuid.UUID) context.Context {
	return withBedLog(ctx, func(c *BedLogContext) { c.ActorID = &actorID })
}

// WithBedBasis names the document behind the request's bed status changes.
func WithBedBasis(ctx context.Context, basis BedBasisType, basisID uuid.UUID) context.Context {
	return withBedLog(ctx, func(c *BedLogContext) {
		c.BasisType = basis
		c.BasisID = &basisID
		c.Act = nil
	})
}

// WithBedAct makes act the basis of the request's bed status changes.
func WithBedAct(ctx context.Context, act BedAct) context.Context {
	return withBedLog(ctx, func(c *BedLogContext) {
		c.BasisType = BedBasisAct
		c.BasisID = nil
		c.Act = &act
	})
}
