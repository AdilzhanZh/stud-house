# --- build stage ---
FROM golang:1.25-alpine AS build
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/hashpw ./cmd/hashpw

# --- final stage ---
FROM alpine:latest
WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=build /app/server ./server
COPY --from=build /app/hashpw ./hashpw
COPY migrations ./migrations

EXPOSE 8080
ENTRYPOINT ["./server"]
