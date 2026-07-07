package apperror

import "net/http"

// AppError is a typed error carrying the HTTP status it should map to, so
// handlers don't need to re-derive status codes from service-layer errors.
type AppError struct {
	Status  int
	Code    string
	Message string
}

func (e *AppError) Error() string {
	return e.Message
}

func New(status int, code, message string) *AppError {
	return &AppError{Status: status, Code: code, Message: message}
}

func BadRequest(message string) *AppError {
	return New(http.StatusBadRequest, "bad_request", message)
}

func Unauthorized(message string) *AppError {
	return New(http.StatusUnauthorized, "unauthorized", message)
}

func Forbidden(message string) *AppError {
	return New(http.StatusForbidden, "forbidden", message)
}

func NotFound(message string) *AppError {
	return New(http.StatusNotFound, "not_found", message)
}

func Conflict(message string) *AppError {
	return New(http.StatusConflict, "conflict", message)
}

func Internal(message string) *AppError {
	return New(http.StatusInternalServerError, "internal_error", message)
}
