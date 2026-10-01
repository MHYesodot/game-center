package app

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/config"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/events"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/platformapi"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/runtime"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/transport"
)

type Gateway struct {
	config        config.Config
	logger        *log.Logger
	platform      *platformapi.Client
	redis         *runtime.RedisRegistry
	local         *runtime.LocalRegistry
	consumer      *events.Consumer
	handler       *transport.WebSocketHandler
	reconcileStop context.CancelFunc
}

func New(cfg config.Config, logger *log.Logger) (*Gateway, error) {
	platform := platformapi.NewClient(cfg.PlatformAPIURL, cfg.PlatformTimeout, cfg.PlatformAPISharedSecret)
	redisRegistry, err := runtime.NewRedisRegistry(cfg.RedisURL, cfg.RedisNamespace, cfg.ConnectionTTL)
	if err != nil {
		return nil, err
	}
	localRegistry := runtime.NewLocalRegistry()
	natsConnection, err := events.Connect(cfg.NATSURL)
	if err != nil {
		return nil, err
	}
	consumer := events.NewConsumer(natsConnection, logger, localRegistry)
	if err := consumer.Start(); err != nil {
		return nil, err
	}
	handler := transport.NewWebSocketHandler(cfg, logger, platform, localRegistry, redisRegistry)

	reconcileCtx, cancel := context.WithCancel(context.Background())
	gateway := &Gateway{
		config:        cfg,
		logger:        logger,
		platform:      platform,
		redis:         redisRegistry,
		local:         localRegistry,
		consumer:      consumer,
		handler:       handler,
		reconcileStop: cancel,
	}

	go gateway.reconcileLoop(reconcileCtx)
	return gateway, nil
}

func (gateway *Gateway) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health/live", func(writer http.ResponseWriter, request *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]any{"ok": true, "service": "realtime-gateway", "status": "live"})
	})
	mux.HandleFunc("/health/ready", func(writer http.ResponseWriter, request *http.Request) {
		ctx, cancel := context.WithTimeout(request.Context(), gateway.config.ReadinessTimeout)
		defer cancel()

		dependencies := map[string]string{"redis": "up", "nats": "up", "platformApi": "up"}
		statusCode := http.StatusOK
		status := "ready"

		if err := gateway.redis.Ping(ctx); err != nil {
			dependencies["redis"] = "down"
			statusCode = http.StatusServiceUnavailable
			status = "not_ready"
		}
		if err := gateway.consumer.Ready(); err != nil {
			dependencies["nats"] = "down"
			statusCode = http.StatusServiceUnavailable
			status = "not_ready"
		}
		if err := gateway.platform.Ready(ctx); err != nil {
			dependencies["platformApi"] = "down"
			statusCode = http.StatusServiceUnavailable
			status = "not_ready"
		}

		writeJSON(writer, statusCode, map[string]any{
			"ok":            statusCode == http.StatusOK,
			"service":       "realtime-gateway",
			"status":        status,
			"gatewayNodeId": gateway.config.GatewayNodeID,
			"dependencies":  dependencies,
		})
	})
	mux.Handle(gateway.config.WebSocketPath, gateway.handler)

	return loggingMiddleware(gateway.logger, mux)
}

func (gateway *Gateway) Shutdown(_ context.Context) error {
	gateway.reconcileStop()
	gateway.handler.CloseAll("SERVER_SHUTDOWN")
	return gateway.Close()
}

func (gateway *Gateway) Close() error {
	_ = gateway.consumer.Close()
	return gateway.redis.Close()
}

func (gateway *Gateway) reconcileLoop(ctx context.Context) {
	ticker := time.NewTicker(gateway.config.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			gateway.handler.Reconcile(context.Background())
		}
	}
}

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(payload)
}

func loggingMiddleware(logger *log.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		logger.Printf(`{"level":"info","service":"realtime-gateway","method":%q,"path":%q}`+"\n", request.Method, request.URL.Path)
		next.ServeHTTP(writer, request)
	})
}