package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/app"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf(`{"level":"error","service":"realtime-gateway","message":"invalid_config","error":%q}`+"\n", err.Error())
	}

	logger := log.New(os.Stdout, "", 0)
	gateway, err := app.New(cfg, logger)
	if err != nil {
		logger.Fatalf(`{"level":"error","service":"realtime-gateway","message":"bootstrap_failed","error":%q}`+"\n", err.Error())
	}
	defer gateway.Close()

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           gateway.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Printf(`{"level":"info","service":"realtime-gateway","message":"starting","port":%q,"nodeId":%q}`+"\n", cfg.Port, cfg.GatewayNodeID)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf(`{"level":"error","service":"realtime-gateway","message":"listen_failed","error":%q}`+"\n", err.Error())
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	logger.Printf(`{"level":"info","service":"realtime-gateway","message":"shutting_down","nodeId":%q}`+"\n", cfg.GatewayNodeID)
	_ = gateway.Shutdown(shutdownCtx)
	_ = server.Shutdown(shutdownCtx)
}