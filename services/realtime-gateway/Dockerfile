FROM golang:1.23-alpine AS build

WORKDIR /workspace

COPY services/realtime-gateway ./

RUN go build -o /out/realtime-gateway ./cmd/server

FROM alpine:3.20

WORKDIR /app

COPY --from=build /out/realtime-gateway /app/realtime-gateway

EXPOSE 8081

CMD ["/app/realtime-gateway"]