package transport

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/config"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/contracts"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/platformapi"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/runtime"
)

type WebSocketHandler struct {
	config      config.Config
	logger      *log.Logger
	platform    *platformapi.Client
	local       *runtime.LocalRegistry
	redis       *runtime.RedisRegistry
	upgrader    websocket.Upgrader
	connections sync.Map
}

type managedConnection struct {
	id            string
	playerID      string
	remoteAddr    string
	protocol      string
	clientType    string
	clientVersion string
	platform      string
	connectedAt   time.Time
	lastHeartbeat time.Time
	channels      []string
	limiter       *runtime.TokenBucket
	conn          *websocket.Conn
	send          chan []byte
	closed        chan struct{}
	closeOnce     sync.Once
	closeSlow     func()
}

func NewWebSocketHandler(cfg config.Config, logger *log.Logger, platform *platformapi.Client, local *runtime.LocalRegistry, redis *runtime.RedisRegistry) *WebSocketHandler {
	allowedOrigins := make(map[string]struct{}, len(cfg.AllowedOrigins))
	for _, origin := range cfg.AllowedOrigins {
		allowedOrigins[origin] = struct{}{}
	}

	return &WebSocketHandler{
		config:   cfg,
		logger:   logger,
		platform: platform,
		local:    local,
		redis:    redis,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(request *http.Request) bool {
				origin := request.Header.Get("Origin")
				if origin == "" {
					return true
				}

				_, ok := allowedOrigins[origin]
				return ok
			},
		},
	}
}

func (handler *WebSocketHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	connection, err := handler.upgrader.Upgrade(writer, request, nil)
	if err != nil {
		return
	}

	connection.SetReadLimit(handler.config.MaxMessageBytes)
	_ = connection.SetReadDeadline(time.Now().Add(handler.config.HandshakeTimeout))

	command, payload, err := handler.readHandshake(connection)
	if err != nil {
		handler.closeProtocolError(connection, "HANDSHAKE_REQUIRED", "errors.realtime.handshakeRequired")
		return
	}

	resolvedPlayerID, err := handler.platform.ResolveIdentity(request.Context(), strings.TrimSpace(payload.PlayerID))
	if err != nil {
		handler.closeDependencyFailure(connection)
		return
	}

	if payload.ProtocolVersion != handler.config.ProtocolVersion {
		handler.closeUnsupportedProtocol(connection)
		return
	}

	connectionID, err := randomConnectionID()
	if err != nil {
		handler.closeDependencyFailure(connection)
		return
	}

	now := time.Now().UTC()
	managed := &managedConnection{
		id:            connectionID,
		playerID:      resolvedPlayerID,
		remoteAddr:    request.RemoteAddr,
		protocol:      payload.ProtocolVersion,
		clientType:    payload.ClientType,
		clientVersion: payload.ClientVersion,
		platform:      payload.Platform,
		connectedAt:   now,
		lastHeartbeat: now,
		channels:      []string{"player:" + resolvedPlayerID},
		limiter:       runtime.NewTokenBucket(handler.config.RateLimitMessagesPerSec, handler.config.RateLimitBurst),
		conn:          connection,
		send:          make(chan []byte, handler.config.MaxOutboundQueue),
		closed:        make(chan struct{}),
	}
	managed.closeSlow = func() {
		handler.closeManagedConnection(managed, websocket.ClosePolicyViolation, "SLOW_CONSUMER")
	}

	handler.local.Register(&runtime.ConnectionSnapshot{
		ConnectionID:       managed.id,
		PlayerID:           managed.playerID,
		GatewayNodeID:      handler.config.GatewayNodeID,
		ProtocolVersion:    managed.protocol,
		ClientType:         managed.clientType,
		ClientVersion:      managed.clientVersion,
		Platform:           managed.platform,
		State:              "connected",
		ConnectedAt:        managed.connectedAt,
		LastHeartbeatAt:    managed.lastHeartbeat,
		RemoteAddr:         managed.remoteAddr,
		SubscribedChannels: append([]string{}, managed.channels...),
		Send:               managed.send,
		Closed:             managed.closed,
		CloseSlowConsumer:  managed.closeSlow,
	})
	if err := handler.redis.RegisterConnection(request.Context(), handler.metadataFromConnection(managed), managed.channels); err != nil {
		handler.local.Unregister(managed.id)
		handler.closeDependencyFailure(connection)
		return
	}

	handler.connections.Store(managed.id, managed)
	go handler.writeLoop(managed)
	handler.writeAck(managed, command, "accepted", map[string]any{
		"connectionId":        managed.id,
		"playerId":            managed.playerID,
		"gatewayNodeId":       handler.config.GatewayNodeID,
		"heartbeatIntervalMs": handler.config.HeartbeatInterval.Milliseconds(),
		"heartbeatTimeoutMs":  handler.config.HeartbeatTimeout.Milliseconds(),
	})

	handler.readLoop(request.Context(), managed)
}

func (handler *WebSocketHandler) CloseAll(reason string) {
	handler.connections.Range(func(_, value any) bool {
		if managed, ok := value.(*managedConnection); ok {
			handler.closeManagedConnection(managed, websocket.CloseGoingAway, reason)
		}
		return true
	})
}

func (handler *WebSocketHandler) Reconcile(ctx context.Context) {
	for _, snapshot := range handler.local.Snapshot() {
		_ = handler.redis.TouchConnection(ctx, runtime.RedisConnectionMetadata{
			ConnectionID:    snapshot.ConnectionID,
			PlayerID:        snapshot.PlayerID,
			GatewayNodeID:   snapshot.GatewayNodeID,
			State:           snapshot.State,
			ProtocolVersion: snapshot.ProtocolVersion,
			ClientType:      snapshot.ClientType,
			ClientVersion:   snapshot.ClientVersion,
			Platform:        snapshot.Platform,
			ConnectedAt:     snapshot.ConnectedAt,
			LastHeartbeatAt: snapshot.LastHeartbeatAt,
			RemoteAddr:      snapshot.RemoteAddr,
		}, snapshot.SubscribedChannels)
	}
}

func (handler *WebSocketHandler) readHandshake(connection *websocket.Conn) (contracts.CommandEnvelope, contracts.HandshakePayload, error) {
	messageType, body, err := connection.ReadMessage()
	if err != nil || messageType != websocket.TextMessage {
		return contracts.CommandEnvelope{}, contracts.HandshakePayload{}, err
	}

	var command contracts.CommandEnvelope
	if err := json.Unmarshal(body, &command); err != nil {
		return contracts.CommandEnvelope{}, contracts.HandshakePayload{}, err
	}
	if command.Kind != "command" || command.Type != "connection.handshake" {
		return contracts.CommandEnvelope{}, contracts.HandshakePayload{}, websocket.ErrBadHandshake
	}

	var payload contracts.HandshakePayload
	if err := json.Unmarshal(command.Payload, &payload); err != nil {
		return contracts.CommandEnvelope{}, contracts.HandshakePayload{}, err
	}

	return command, payload, nil
}

func (handler *WebSocketHandler) readLoop(ctx context.Context, managed *managedConnection) {
	defer handler.closeManagedConnection(managed, websocket.CloseNormalClosure, "NORMAL")

	for {
		_ = managed.conn.SetReadDeadline(time.Now().Add(handler.config.HeartbeatTimeout))
		messageType, body, err := managed.conn.ReadMessage()
		if err != nil {
			return
		}
		if messageType != websocket.TextMessage {
			handler.sendError(managed, "INVALID_MESSAGE", "errors.realtime.invalidMessage", "")
			continue
		}
		if int64(len(body)) > handler.config.MaxMessageBytes {
			handler.closeManagedConnection(managed, websocket.CloseMessageTooBig, "PAYLOAD_TOO_LARGE")
			return
		}
		if !managed.limiter.Allow() {
			handler.sendError(managed, "RATE_LIMITED", "errors.realtime.rateLimited", "")
			handler.closeManagedConnection(managed, websocket.ClosePolicyViolation, "RATE_LIMITED")
			return
		}

		var command contracts.CommandEnvelope
		if err := json.Unmarshal(body, &command); err != nil {
			handler.sendError(managed, "INVALID_MESSAGE", "errors.realtime.invalidMessage", "")
			continue
		}
		if command.Kind != "command" {
			handler.sendError(managed, "INVALID_MESSAGE", "errors.realtime.invalidMessage", command.MessageID)
			continue
		}

		now := time.Now().UTC()
		managed.lastHeartbeat = now
		handler.local.TouchHeartbeat(managed.id, now)
		_ = handler.redis.TouchConnection(ctx, handler.metadataFromConnection(managed), managed.channels)

		switch command.Type {
		case "connection.ping":
			handler.writeAck(managed, command, "accepted", nil)
		case "subscription.subscribe":
			handler.handleSubscribe(ctx, managed, command)
		case "subscription.unsubscribe":
			handler.handleUnsubscribe(ctx, managed, command)
		default:
			handler.sendError(managed, "UNKNOWN_MESSAGE_TYPE", "errors.realtime.unknownMessageType", command.MessageID)
		}
	}
}

func (handler *WebSocketHandler) handleSubscribe(ctx context.Context, managed *managedConnection, command contracts.CommandEnvelope) {
	var payload contracts.SubscribePayload
	if err := json.Unmarshal(command.Payload, &payload); err != nil {
		handler.sendError(managed, "INVALID_MESSAGE", "errors.realtime.invalidMessage", command.MessageID)
		return
	}

	authorized, err := handler.platform.AuthorizeSubscription(ctx, managed.playerID, payload.Target)
	if err != nil {
		handler.sendError(managed, "REALTIME_UNAVAILABLE", "errors.realtime.unavailable", command.MessageID)
		return
	}
	if !authorized.Allowed || strings.TrimSpace(authorized.Channel) == "" {
		handler.sendError(managed, "SUBSCRIPTION_DENIED", "errors.realtime.subscriptionDenied", command.MessageID)
		return
	}

	if handler.local.AddSubscription(managed.id, authorized.Channel) {
		managed.channels = appendChannel(managed.channels, authorized.Channel)
		_ = handler.redis.Subscribe(ctx, handler.metadataFromConnection(managed), authorized.Channel, managed.channels)
	}
	handler.writeAck(managed, command, "accepted", map[string]any{"channel": authorized.Channel})
}

func (handler *WebSocketHandler) handleUnsubscribe(ctx context.Context, managed *managedConnection, command contracts.CommandEnvelope) {
	var payload contracts.SubscribePayload
	if err := json.Unmarshal(command.Payload, &payload); err != nil {
		handler.sendError(managed, "INVALID_MESSAGE", "errors.realtime.invalidMessage", command.MessageID)
		return
	}

	authorized, err := handler.platform.AuthorizeSubscription(ctx, managed.playerID, payload.Target)
	if err != nil {
		handler.sendError(managed, "REALTIME_UNAVAILABLE", "errors.realtime.unavailable", command.MessageID)
		return
	}
	if strings.TrimSpace(authorized.Channel) != "" {
		handler.local.RemoveSubscription(managed.id, authorized.Channel)
		managed.channels = removeChannel(managed.channels, authorized.Channel)
		_ = handler.redis.Unsubscribe(ctx, handler.metadataFromConnection(managed), authorized.Channel)
	}
	handler.writeAck(managed, command, "accepted", map[string]any{"channel": authorized.Channel})
}

func (handler *WebSocketHandler) metadataFromConnection(managed *managedConnection) runtime.RedisConnectionMetadata {
	return runtime.RedisConnectionMetadata{
		ConnectionID:    managed.id,
		PlayerID:        managed.playerID,
		GatewayNodeID:   handler.config.GatewayNodeID,
		State:           "connected",
		ProtocolVersion: managed.protocol,
		ClientType:      managed.clientType,
		ClientVersion:   managed.clientVersion,
		Platform:        managed.platform,
		ConnectedAt:     managed.connectedAt,
		LastHeartbeatAt: managed.lastHeartbeat,
		RemoteAddr:      managed.remoteAddr,
	}
}

func (handler *WebSocketHandler) writeLoop(managed *managedConnection) {
	for {
		select {
		case <-managed.closed:
			return
		case message := <-managed.send:
			_ = managed.conn.SetWriteDeadline(time.Now().Add(handler.config.WriteTimeout))
			if err := managed.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		}
	}
}

func (handler *WebSocketHandler) writeJSON(managed *managedConnection, payload any) {
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	select {
	case managed.send <- body:
	default:
		handler.closeManagedConnection(managed, websocket.ClosePolicyViolation, "SLOW_CONSUMER")
	}
}

func (handler *WebSocketHandler) writeAck(managed *managedConnection, command contracts.CommandEnvelope, status string, details map[string]any) {
	handler.writeJSON(managed, contracts.AckEnvelope{
		ProtocolVersion: handler.config.ProtocolVersion,
		Kind:            "ack",
		Type:            command.Type,
		MessageID:       newMessageID(),
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		CorrelationID:   command.MessageID,
		Payload: contracts.AckPayload{
			Status:  status,
			Details: details,
		},
	})
}

func (handler *WebSocketHandler) sendError(managed *managedConnection, code string, messageKey string, correlationID string) {
	handler.writeJSON(managed, contracts.ErrorEnvelope{
		ProtocolVersion: handler.config.ProtocolVersion,
		Kind:            "error",
		Type:            "error",
		MessageID:       newMessageID(),
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		CorrelationID:   correlationID,
		Payload: contracts.ErrorPayload{
			Code:       code,
			MessageKey: messageKey,
		},
	})
}

func (handler *WebSocketHandler) closeManagedConnection(managed *managedConnection, code int, reason string) {
	managed.closeOnce.Do(func() {
		handler.connections.Delete(managed.id)
		closed := handler.local.Unregister(managed.id)
		channels := managed.channels
		if closed != nil {
			channels = closed.SubscribedChannels
		}
		_ = handler.redis.UnregisterConnection(context.Background(), handler.metadataFromConnection(managed), channels)
		close(managed.closed)
		_ = managed.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), time.Now().Add(handler.config.WriteTimeout))
		_ = managed.conn.Close()
	})
}

func (handler *WebSocketHandler) closeProtocolError(connection *websocket.Conn, code string, messageKey string) {
	body, _ := json.Marshal(contracts.ErrorEnvelope{
		ProtocolVersion: handler.config.ProtocolVersion,
		Kind:            "error",
		Type:            "error",
		MessageID:       newMessageID(),
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload: contracts.ErrorPayload{Code: code, MessageKey: messageKey},
	})
	_ = connection.WriteMessage(websocket.TextMessage, body)
	_ = connection.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, code), time.Now().Add(handler.config.WriteTimeout))
	_ = connection.Close()
}

func (handler *WebSocketHandler) closeUnsupportedProtocol(connection *websocket.Conn) {
	handler.closeProtocolError(connection, "UNSUPPORTED_PROTOCOL_VERSION", "errors.realtime.unsupportedProtocolVersion")
}

func (handler *WebSocketHandler) closeDependencyFailure(connection *websocket.Conn) {
	handler.closeProtocolError(connection, "REALTIME_UNAVAILABLE", "errors.realtime.unavailable")
}

func appendChannel(channels []string, candidate string) []string {
	for _, current := range channels {
		if current == candidate {
			return channels
		}
	}

	return append(channels, candidate)
}

func removeChannel(channels []string, candidate string) []string {
	filtered := channels[:0]
	for _, current := range channels {
		if current != candidate {
			filtered = append(filtered, current)
		}
	}

	return filtered
}

func randomConnectionID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return "conn-" + hex.EncodeToString(bytes), nil
}

func newMessageID() string {
	id, err := randomConnectionID()
	if err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}

	return id
}