package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type config struct {
	Port           string
	LogLevel       string
	PlatformAPIURL string
}

func main() {
	cfg := loadConfig()
	logger := log.New(os.Stdout, "", 0)

	mux := http.NewServeMux()
	mux.HandleFunc("/health/live", func(writer http.ResponseWriter, request *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]any{"ok": true, "service": "realtime-gateway", "status": "live"})
	})
	mux.HandleFunc("/health/ready", func(writer http.ResponseWriter, request *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]any{
			"ok":           true,
			"service":      "realtime-gateway",
			"status":       "ready",
			"platformApiUrl": cfg.PlatformAPIURL,
		})
	})

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           loggingMiddleware(logger, mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Printf(`{"level":"info","service":"realtime-gateway","message":"starting","port":"%s"}`, cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf(`{"level":"error","service":"realtime-gateway","message":"listen failed","error":"%s"}`, err.Error())
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	logger.Printf(`{"level":"info","service":"realtime-gateway","message":"shutting down"}`)
	_ = server.Shutdown(shutdownCtx)
}

func loadConfig() config {
	return config{
		Port:           envOrDefault("PORT", "8081"),
		LogLevel:       envOrDefault("LOG_LEVEL", "info"),
		PlatformAPIURL: envOrDefault("PLATFORM_API_URL", "http://platform-api:3000"),
	}
}

func envOrDefault(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(payload)
}

func loggingMiddleware(logger *log.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		logger.Printf(`{"level":"info","service":"realtime-gateway","method":"%s","path":"%s"}`, request.Method, request.URL.Path)
		next.ServeHTTP(writer, request)
	})
}