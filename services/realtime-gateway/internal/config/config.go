package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                     string
	PlatformAPIURL           string
	RedisURL                 string
	NATSURL                  string
	AllowedOrigins           []string
	ProtocolVersion          string
	GatewayNodeID            string
	HandshakeTimeout         time.Duration
	HeartbeatInterval        time.Duration
	HeartbeatTimeout         time.Duration
	WriteTimeout             time.Duration
	PlatformTimeout          time.Duration
	ReadinessTimeout         time.Duration
	MaxMessageBytes          int64
	MaxOutboundQueue         int
	RateLimitMessagesPerSec  float64
	RateLimitBurst           int
	ConnectionTTL            time.Duration
	RedisNamespace           string
	WebSocketPath            string
}

func Load() (Config, error) {
	gatewayNodeID := os.Getenv("GATEWAY_NODE_ID")
	if strings.TrimSpace(gatewayNodeID) == "" {
		generated, err := randomNodeID()
		if err != nil {
			return Config{}, err
		}
		gatewayNodeID = generated
	}

	handshakeTimeout, err := durationFromEnv("REALTIME_HANDSHAKE_TIMEOUT_MS", 5000)
	if err != nil {
		return Config{}, err
	}
	heartbeatInterval, err := durationFromEnv("REALTIME_HEARTBEAT_INTERVAL_MS", 5000)
	if err != nil {
		return Config{}, err
	}
	heartbeatTimeout, err := durationFromEnv("REALTIME_HEARTBEAT_TIMEOUT_MS", 15000)
	if err != nil {
		return Config{}, err
	}
	writeTimeout, err := durationFromEnv("REALTIME_WRITE_TIMEOUT_MS", 3000)
	if err != nil {
		return Config{}, err
	}
	platformTimeout, err := durationFromEnv("REALTIME_PLATFORM_TIMEOUT_MS", 3000)
	if err != nil {
		return Config{}, err
	}
	readinessTimeout, err := durationFromEnv("REALTIME_READINESS_TIMEOUT_MS", 1000)
	if err != nil {
		return Config{}, err
	}
	maxMessageBytes, err := int64FromEnv("REALTIME_MAX_MESSAGE_BYTES", 65536)
	if err != nil {
		return Config{}, err
	}
	maxOutboundQueue, err := intFromEnv("REALTIME_MAX_OUTBOUND_QUEUE", 64)
	if err != nil {
		return Config{}, err
	}
	rateLimitPerSecond, err := float64FromEnv("REALTIME_RATE_LIMIT_MESSAGES_PER_SECOND", 20)
	if err != nil {
		return Config{}, err
	}
	rateLimitBurst, err := intFromEnv("REALTIME_RATE_LIMIT_BURST", 40)
	if err != nil {
		return Config{}, err
	}
	connectionTTL, err := durationFromEnv("REALTIME_CONNECTION_TTL_MS", 30000)
	if err != nil {
		return Config{}, err
	}

	if heartbeatTimeout <= heartbeatInterval {
		return Config{}, fmt.Errorf("REALTIME_HEARTBEAT_TIMEOUT_MS must be greater than REALTIME_HEARTBEAT_INTERVAL_MS")
	}

	allowedOrigins := parseAllowedOrigins(os.Getenv("REALTIME_ALLOWED_ORIGINS"))
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"http://localhost:8080", "http://127.0.0.1:4273", "http://127.0.0.1:8080"}
	}

	return Config{
		Port:                    envOrDefault("PORT", "8081"),
		PlatformAPIURL:          envOrDefault("PLATFORM_API_URL", "http://platform-api:3000"),
		RedisURL:                envOrDefault("REDIS_URL", "redis://redis:6379"),
		NATSURL:                 envOrDefault("NATS_URL", "nats://nats:4222"),
		AllowedOrigins:          allowedOrigins,
		ProtocolVersion:         envOrDefault("REALTIME_PROTOCOL_VERSION", "realtime.v1"),
		GatewayNodeID:           gatewayNodeID,
		HandshakeTimeout:        handshakeTimeout,
		HeartbeatInterval:       heartbeatInterval,
		HeartbeatTimeout:        heartbeatTimeout,
		WriteTimeout:            writeTimeout,
		PlatformTimeout:         platformTimeout,
		ReadinessTimeout:        readinessTimeout,
		MaxMessageBytes:         maxMessageBytes,
		MaxOutboundQueue:        maxOutboundQueue,
		RateLimitMessagesPerSec: rateLimitPerSecond,
		RateLimitBurst:          rateLimitBurst,
		ConnectionTTL:           connectionTTL,
		RedisNamespace:          envOrDefault("REALTIME_REDIS_NAMESPACE", "gc:v1:rt"),
		WebSocketPath:           envOrDefault("REALTIME_WEBSOCKET_PATH", "/realtime/v1/ws"),
	}, nil
}

func envOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func durationFromEnv(key string, fallbackMs int) (time.Duration, error) {
	value, err := intFromEnv(key, fallbackMs)
	if err != nil {
		return 0, err
	}

	return time.Duration(value) * time.Millisecond, nil
}

func intFromEnv(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", key)
	}

	return parsed, nil
}

func int64FromEnv(key string, fallback int64) (int64, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", key)
	}

	return parsed, nil
}

func float64FromEnv(key string, fallback float64) (float64, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%s must be a positive number", key)
	}

	return parsed, nil
}

func parseAllowedOrigins(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result
}

func randomNodeID() (string, error) {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate gateway node id: %w", err)
	}

	return "gw-" + hex.EncodeToString(bytes), nil
}