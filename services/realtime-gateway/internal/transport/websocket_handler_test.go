package transport

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/config"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/contracts"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/runtime"
)

func TestHandshakeSuccessRegistersConnection(t *testing.T) {
	harness := newHandlerHarness(t)
	connection := harness.dial(t, "http://allowed.example")
	defer connection.Close()

	harness.writeHandshake(t, connection, contracts.HandshakePayload{
		ProtocolVersion: "realtime.v1",
		PlayerID:        "player-a",
		ClientType:      "web",
		ClientVersion:   "1.0.0",
		Platform:        "web",
	})

	ack := harness.readAck(t, connection)
	if ack.Payload.Status != "accepted" {
		t.Fatalf("expected accepted handshake, got %s", ack.Payload.Status)
	}
	if got := len(harness.local.Snapshot()); got != 1 {
		t.Fatalf("expected 1 registered connection, got %d", got)
	}
	snapshot := harness.local.Snapshot()[0]
	if snapshot.PlayerID != "player-a" {
		t.Fatalf("expected player-a registration, got %s", snapshot.PlayerID)
	}
	if len(harness.redis.registerCalls) != 1 {
		t.Fatalf("expected redis register call, got %d", len(harness.redis.registerCalls))
	}
	if harness.platform.resolveCalls != 1 {
		t.Fatalf("expected one platform identity resolution, got %d", harness.platform.resolveCalls)
	}
}

func TestHandshakeMissingIdentityRejectedBeforeRegistration(t *testing.T) {
	harness := newHandlerHarness(t)
	connection := harness.dial(t, "http://allowed.example")
	defer connection.Close()

	harness.writeHandshake(t, connection, contracts.HandshakePayload{
		ProtocolVersion: "realtime.v1",
		PlayerID:        "   ",
		ClientType:      "web",
		ClientVersion:   "1.0.0",
		Platform:        "web",
	})

	errEnvelope, closeError := harness.readErrorAndClose(t, connection)
	if errEnvelope.Payload.Code != "INVALID_PLAYER_ID" {
		t.Fatalf("expected INVALID_PLAYER_ID, got %s", errEnvelope.Payload.Code)
	}
	var closeFrame *websocket.CloseError
	if !errors.As(closeError, &closeFrame) || closeFrame.Code != websocket.ClosePolicyViolation {
		t.Fatalf("expected policy violation close, got %v", closeError)
	}
	if got := len(harness.local.Snapshot()); got != 0 {
		t.Fatalf("expected no registered connection, got %d", got)
	}
	if harness.platform.resolveCalls != 0 {
		t.Fatalf("expected no platform resolve call, got %d", harness.platform.resolveCalls)
	}
}

func TestHandshakeUnsupportedProtocolRejected(t *testing.T) {
	harness := newHandlerHarness(t)
	connection := harness.dial(t, "http://allowed.example")
	defer connection.Close()

	harness.writeHandshake(t, connection, contracts.HandshakePayload{
		ProtocolVersion: "realtime.v0",
		PlayerID:        "player-a",
		ClientType:      "web",
		ClientVersion:   "1.0.0",
		Platform:        "web",
	})

	errEnvelope, _ := harness.readErrorAndClose(t, connection)
	if errEnvelope.Payload.Code != "UNSUPPORTED_PROTOCOL_VERSION" {
		t.Fatalf("expected unsupported protocol error, got %s", errEnvelope.Payload.Code)
	}
	if got := len(harness.local.Snapshot()); got != 0 {
		t.Fatalf("expected no registration, got %d", got)
	}
	if harness.platform.resolveCalls != 0 {
		t.Fatalf("expected no resolve call, got %d", harness.platform.resolveCalls)
	}
}

func TestHandshakeInvalidClientMetadataRejected(t *testing.T) {
	harness := newHandlerHarness(t)
	connection := harness.dial(t, "http://allowed.example")
	defer connection.Close()

	harness.writeHandshake(t, connection, contracts.HandshakePayload{
		ProtocolVersion: "realtime.v1",
		PlayerID:        "player-a",
		ClientType:      "console",
		ClientVersion:   "",
		Platform:        "arcade-cabinet",
	})

	errEnvelope, _ := harness.readErrorAndClose(t, connection)
	if errEnvelope.Payload.Code != "INVALID_MESSAGE" {
		t.Fatalf("expected invalid message code, got %s", errEnvelope.Payload.Code)
	}
	if got := len(harness.local.Snapshot()); got != 0 {
		t.Fatalf("expected no registration, got %d", got)
	}
}

func TestHandshakeTimeoutClosesWithoutRegistration(t *testing.T) {
	harness := newHandlerHarness(t)
	harness.cfg.HandshakeTimeout = 20 * time.Millisecond
	harness.restartServer(t)

	connection := harness.dial(t, "http://allowed.example")
	defer connection.Close()

	errEnvelope, _ := harness.readErrorAndClose(t, connection)
	if errEnvelope.Payload.Code != "HANDSHAKE_TIMEOUT" {
		t.Fatalf("expected HANDSHAKE_TIMEOUT, got %s", errEnvelope.Payload.Code)
	}
	if got := len(harness.local.Snapshot()); got != 0 {
		t.Fatalf("expected no registration, got %d", got)
	}
}

func TestProtocolInvalidJSONDoesNotLeakConnection(t *testing.T) {
	harness := newHandlerHarness(t)
	connection := harness.connectedClient(t)
	defer connection.Close()

	if err := connection.WriteMessage(websocket.TextMessage, []byte("{")); err != nil {
		t.Fatalf("write invalid json: %v", err)
	}
	errEnvelope := harness.readError(t, connection)
	if errEnvelope.Payload.Code != "INVALID_MESSAGE" {
		t.Fatalf("expected INVALID_MESSAGE, got %s", errEnvelope.Payload.Code)
	}
	if got := len(harness.local.Snapshot()); got != 1 {
		t.Fatalf("expected connection to remain registered after semantic error, got %d", got)
	}
	_ = connection.Close()
	harness.waitForSnapshotCount(t, 0)
}

func TestProtocolUnknownMessageTypeReturnsSemanticError(t *testing.T) {
	harness := newHandlerHarness(t)
	connection := harness.connectedClient(t)
	defer connection.Close()

	harness.writeEnvelope(t, connection, contracts.CommandEnvelope{
		ProtocolVersion: "realtime.v1",
		Kind:            "command",
		Type:            "unknown.command",
		MessageID:       "m1",
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload:         mustJSONRaw(t, map[string]any{}),
	})

	errEnvelope := harness.readError(t, connection)
	if errEnvelope.Payload.Code != "UNKNOWN_MESSAGE_TYPE" {
		t.Fatalf("expected UNKNOWN_MESSAGE_TYPE, got %s", errEnvelope.Payload.Code)
	}
}

func TestOversizedPayloadClosesAndCleansUp(t *testing.T) {
	harness := newHandlerHarness(t)
	harness.cfg.MaxMessageBytes = 1024
	harness.restartServer(t)

	connection := harness.connectedClient(t)
	defer connection.Close()

	oversized := strings.Repeat("x", 8192)
	harness.writeEnvelope(t, connection, contracts.CommandEnvelope{
		ProtocolVersion: "realtime.v1",
		Kind:            "command",
		Type:            "connection.ping",
		MessageID:       "m2",
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload:         mustJSONRaw(t, map[string]any{"blob": oversized}),
	})

	connection.SetReadDeadline(time.Now().Add(time.Second))
	_, _, closeError := connection.ReadMessage()
	var closeFrame *websocket.CloseError
	if !errors.As(closeError, &closeFrame) || closeFrame.Code != websocket.CloseMessageTooBig {
		t.Fatalf("expected message-too-big close, got %v", closeError)
	}
	harness.waitForSnapshotCount(t, 0)
}

func TestSubscribeDuplicateAndUnsubscribeCleanup(t *testing.T) {
	harness := newHandlerHarness(t)
	harness.platform.authorizeResponse = contracts.AuthorizeSubscriptionResponse{Allowed: true, Channel: "lobby:lobby-1"}
	connection := harness.connectedClient(t)
	defer connection.Close()

	harness.subscribe(t, connection, contracts.SubscriptionTarget{Kind: "lobby", LobbyID: "lobby-1"}, "sub-1")
	harness.subscribe(t, connection, contracts.SubscriptionTarget{Kind: "lobby", LobbyID: "lobby-1"}, "sub-2")

	snapshot := harness.local.Snapshot()[0]
	if got := countChannel(snapshot.SubscribedChannels, "lobby:lobby-1"); got != 1 {
		t.Fatalf("expected one subscription entry, got %d", got)
	}

	harness.unsubscribe(t, connection, contracts.SubscriptionTarget{Kind: "lobby", LobbyID: "lobby-1"}, "sub-3")
	snapshot = harness.local.Snapshot()[0]
	if got := countChannel(snapshot.SubscribedChannels, "lobby:lobby-1"); got != 0 {
		t.Fatalf("expected subscription removed, got %d", got)
	}
}

func TestUnauthorizedPrivatePlayerChannelDeniedAndSocketRemainsUsable(t *testing.T) {
	harness := newHandlerHarness(t)
	harness.platform.authorizeResponse = contracts.AuthorizeSubscriptionResponse{Allowed: false, Channel: "player:player-b"}
	connection := harness.connectedClient(t)
	defer connection.Close()

	harness.writeEnvelope(t, connection, contracts.CommandEnvelope{
		ProtocolVersion: "realtime.v1",
		Kind:            "command",
		Type:            "subscription.subscribe",
		MessageID:       "sub-denied",
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload:         mustJSONRaw(t, contracts.SubscribePayload{Target: contracts.SubscriptionTarget{Kind: "player"}}),
	})
	errEnvelope := harness.readError(t, connection)
	if errEnvelope.Payload.Code != "SUBSCRIPTION_DENIED" {
		t.Fatalf("expected SUBSCRIPTION_DENIED, got %s", errEnvelope.Payload.Code)
	}

	harness.ping(t, connection, "ping-after-denied")
}

func TestPlatformUnavailableOnSubscribeDoesNotInsertSubscription(t *testing.T) {
	harness := newHandlerHarness(t)
	harness.platform.authorizeError = errors.New("platform down")
	connection := harness.connectedClient(t)
	defer connection.Close()

	harness.writeEnvelope(t, connection, contracts.CommandEnvelope{
		ProtocolVersion: "realtime.v1",
		Kind:            "command",
		Type:            "subscription.subscribe",
		MessageID:       "sub-outage",
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload:         mustJSONRaw(t, contracts.SubscribePayload{Target: contracts.SubscriptionTarget{Kind: "lobby", LobbyID: "lobby-1"}}),
	})
	errEnvelope := harness.readError(t, connection)
	if errEnvelope.Payload.Code != "REALTIME_UNAVAILABLE" {
		t.Fatalf("expected REALTIME_UNAVAILABLE, got %s", errEnvelope.Payload.Code)
	}
	snapshot := harness.local.Snapshot()[0]
	if countChannel(snapshot.SubscribedChannels, "lobby:lobby-1") != 0 {
		t.Fatalf("expected no lobby subscription recorded")
	}
	harness.ping(t, connection, "ping-after-outage")
}

func TestAllowedAndDisallowedOrigins(t *testing.T) {
	harness := newHandlerHarness(t)
	allowed := harness.dial(t, "http://allowed.example")
	_ = allowed.Close()

	serverURL := "ws" + strings.TrimPrefix(harness.server.URL, "http") + harness.cfg.WebSocketPath
	_, response, err := websocket.DefaultDialer.Dial(serverURL, http.Header{"Origin": []string{"http://blocked.example"}})
	if err == nil {
		t.Fatalf("expected disallowed origin dial to fail")
	}
	if response == nil || response.StatusCode != http.StatusForbidden {
		t.Fatalf("expected forbidden origin response, got %#v", response)
	}
}

type handlerHarness struct {
	t        *testing.T
	cfg      config.Config
	platform *stubPlatformClient
	redis    *stubRuntimeRegistry
	local    *runtime.LocalRegistry
	handler  *WebSocketHandler
	server   *httptest.Server
}

func newHandlerHarness(t *testing.T) *handlerHarness {
	t.Helper()
	h := &handlerHarness{
		t: t,
		cfg: config.Config{
			AllowedOrigins:          []string{"http://allowed.example"},
			ProtocolVersion:         "realtime.v1",
			GatewayNodeID:           "gw-test",
			HandshakeTimeout:        250 * time.Millisecond,
			HeartbeatTimeout:        250 * time.Millisecond,
			HeartbeatInterval:       100 * time.Millisecond,
			WriteTimeout:            250 * time.Millisecond,
			MaxMessageBytes:         64 * 1024,
			MaxOutboundQueue:        4,
			RateLimitMessagesPerSec: 100,
			RateLimitBurst:          100,
			WebSocketPath:           "/realtime/v1/ws",
		},
		platform: &stubPlatformClient{authorizeResponse: contracts.AuthorizeSubscriptionResponse{Allowed: true, Channel: "lobby:lobby-1"}},
		redis:    &stubRuntimeRegistry{},
		local:    runtime.NewLocalRegistry(),
	}
	h.restartServer(t)
	t.Cleanup(func() {
		if h.server != nil {
			h.server.Close()
		}
	})
	return h
}

func (h *handlerHarness) restartServer(t *testing.T) {
	t.Helper()
	if h.server != nil {
		h.server.Close()
	}
	h.local = runtime.NewLocalRegistry()
	h.redis = &stubRuntimeRegistry{}
	h.handler = NewWebSocketHandlerWithDependencies(h.cfg, log.New(io.Discard, "", 0), h.platform, h.local, h.redis)
	h.server = httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != h.cfg.WebSocketPath {
			http.NotFound(writer, request)
			return
		}
		h.handler.ServeHTTP(writer, request)
	}))
}

func (h *handlerHarness) dial(t *testing.T, origin string) *websocket.Conn {
	t.Helper()
	serverURL := "ws" + strings.TrimPrefix(h.server.URL, "http") + h.cfg.WebSocketPath
	connection, response, err := websocket.DefaultDialer.Dial(serverURL, http.Header{"Origin": []string{origin}})
	if err != nil {
		if response != nil {
			response.Body.Close()
		}
		t.Fatalf("dial websocket: %v", err)
	}
	return connection
}

func (h *handlerHarness) connectedClient(t *testing.T) *websocket.Conn {
	t.Helper()
	connection := h.dial(t, "http://allowed.example")
	h.writeHandshake(t, connection, contracts.HandshakePayload{
		ProtocolVersion: "realtime.v1",
		PlayerID:        "player-a",
		ClientType:      "web",
		ClientVersion:   "1.0.0",
		Platform:        "web",
	})
	h.readAck(t, connection)
	return connection
}

func (h *handlerHarness) writeHandshake(t *testing.T, connection *websocket.Conn, payload contracts.HandshakePayload) {
	t.Helper()
	h.writeEnvelope(t, connection, contracts.CommandEnvelope{
		ProtocolVersion: payload.ProtocolVersion,
		Kind:            "command",
		Type:            "connection.handshake",
		MessageID:       "hs-1",
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload:         mustJSONRaw(t, payload),
	})
	}

func (h *handlerHarness) ping(t *testing.T, connection *websocket.Conn, messageID string) {
	t.Helper()
	h.writeEnvelope(t, connection, contracts.CommandEnvelope{
		ProtocolVersion: "realtime.v1",
		Kind:            "command",
		Type:            "connection.ping",
		MessageID:       messageID,
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload:         mustJSONRaw(t, map[string]any{"sentAt": time.Now().UTC().Format(time.RFC3339Nano)}),
	})
	ack := h.readAck(t, connection)
	if ack.CorrelationID != messageID {
		t.Fatalf("expected ping ack correlation %s, got %s", messageID, ack.CorrelationID)
	}
}

func (h *handlerHarness) subscribe(t *testing.T, connection *websocket.Conn, target contracts.SubscriptionTarget, messageID string) {
	t.Helper()
	h.writeEnvelope(t, connection, contracts.CommandEnvelope{
		ProtocolVersion: "realtime.v1",
		Kind:            "command",
		Type:            "subscription.subscribe",
		MessageID:       messageID,
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload:         mustJSONRaw(t, contracts.SubscribePayload{Target: target}),
	})
	h.readAck(t, connection)
}

func (h *handlerHarness) unsubscribe(t *testing.T, connection *websocket.Conn, target contracts.SubscriptionTarget, messageID string) {
	t.Helper()
	h.writeEnvelope(t, connection, contracts.CommandEnvelope{
		ProtocolVersion: "realtime.v1",
		Kind:            "command",
		Type:            "subscription.unsubscribe",
		MessageID:       messageID,
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
		Payload:         mustJSONRaw(t, contracts.SubscribePayload{Target: target}),
	})
	h.readAck(t, connection)
}

func (h *handlerHarness) writeEnvelope(t *testing.T, connection *websocket.Conn, envelope contracts.CommandEnvelope) {
	t.Helper()
	body, err := json.Marshal(envelope)
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}
	if err := connection.WriteMessage(websocket.TextMessage, body); err != nil {
		t.Fatalf("write envelope: %v", err)
	}
}

func (h *handlerHarness) readAck(t *testing.T, connection *websocket.Conn) contracts.AckEnvelope {
	t.Helper()
	connection.SetReadDeadline(time.Now().Add(time.Second))
	_, body, err := connection.ReadMessage()
	if err != nil {
		t.Fatalf("read ack: %v", err)
	}
	var envelope contracts.AckEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatalf("unmarshal ack: %v\nbody=%s", err, string(body))
	}
	return envelope
}

func (h *handlerHarness) readError(t *testing.T, connection *websocket.Conn) contracts.ErrorEnvelope {
	t.Helper()
	connection.SetReadDeadline(time.Now().Add(time.Second))
	_, body, err := connection.ReadMessage()
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	var envelope contracts.ErrorEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatalf("unmarshal error: %v\nbody=%s", err, string(body))
	}
	return envelope
}

func (h *handlerHarness) readClose(t *testing.T, connection *websocket.Conn) (contracts.ErrorEnvelope, error) {
	t.Helper()
	errEnvelope := h.readError(t, connection)
	connection.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err := connection.ReadMessage()
	if err == nil {
		t.Fatalf("expected close after error envelope")
	}
	return errEnvelope, err
}

func (h *handlerHarness) readErrorAndClose(t *testing.T, connection *websocket.Conn) (contracts.ErrorEnvelope, error) {
	t.Helper()
	return h.readClose(t, connection)
}

func (h *handlerHarness) waitForSnapshotCount(t *testing.T, want int) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if len(h.local.Snapshot()) == want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("snapshot count did not reach %d; got %d", want, len(h.local.Snapshot()))
}

type stubPlatformClient struct {
	resolveCalls      int
	authorizeCalls    int
	resolvePlayerID   string
	resolveError      error
	authorizeResponse contracts.AuthorizeSubscriptionResponse
	authorizeError    error
}

func (stub *stubPlatformClient) ResolveIdentity(_ context.Context, playerID string) (string, error) {
	stub.resolveCalls++
	if stub.resolveError != nil {
		return "", stub.resolveError
	}
	if stub.resolvePlayerID != "" {
		return stub.resolvePlayerID, nil
	}
	return playerID, nil
}

func (stub *stubPlatformClient) AuthorizeSubscription(_ context.Context, _ string, _ contracts.SubscriptionTarget) (contracts.AuthorizeSubscriptionResponse, error) {
	stub.authorizeCalls++
	if stub.authorizeError != nil {
		return contracts.AuthorizeSubscriptionResponse{}, stub.authorizeError
	}
	return stub.authorizeResponse, nil
}

type stubRuntimeRegistry struct {
	mu              sync.Mutex
	registerCalls   []runtime.RedisConnectionMetadata
	touchCalls      []runtime.RedisConnectionMetadata
	subscribeCalls  []string
	unsubscribeCalls []string
	unregisterCalls []runtime.RedisConnectionMetadata
	registerError   error
	touchError      error
	subscribeError  error
	unsubscribeError error
	unregisterError error
}

func (stub *stubRuntimeRegistry) RegisterConnection(_ context.Context, metadata runtime.RedisConnectionMetadata, _ []string) error {
	stub.mu.Lock()
	defer stub.mu.Unlock()
	stub.registerCalls = append(stub.registerCalls, metadata)
	return stub.registerError
}

func (stub *stubRuntimeRegistry) TouchConnection(_ context.Context, metadata runtime.RedisConnectionMetadata, _ []string) error {
	stub.mu.Lock()
	defer stub.mu.Unlock()
	stub.touchCalls = append(stub.touchCalls, metadata)
	return stub.touchError
}

func (stub *stubRuntimeRegistry) Subscribe(_ context.Context, _ runtime.RedisConnectionMetadata, channel string, _ []string) error {
	stub.mu.Lock()
	defer stub.mu.Unlock()
	stub.subscribeCalls = append(stub.subscribeCalls, channel)
	return stub.subscribeError
}

func (stub *stubRuntimeRegistry) Unsubscribe(_ context.Context, _ runtime.RedisConnectionMetadata, channel string) error {
	stub.mu.Lock()
	defer stub.mu.Unlock()
	stub.unsubscribeCalls = append(stub.unsubscribeCalls, channel)
	return stub.unsubscribeError
}

func (stub *stubRuntimeRegistry) UnregisterConnection(_ context.Context, metadata runtime.RedisConnectionMetadata, _ []string) error {
	stub.mu.Lock()
	defer stub.mu.Unlock()
	stub.unregisterCalls = append(stub.unregisterCalls, metadata)
	return stub.unregisterError
}

func mustJSONRaw(t *testing.T, value any) json.RawMessage {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal raw payload: %v", err)
	}
	return body
}

func countChannel(channels []string, candidate string) int {
	count := 0
	for _, current := range channels {
		if current == candidate {
			count++
		}
	}
	return count
}

