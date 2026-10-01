package contracts

import "encoding/json"

type CommandEnvelope struct {
	ProtocolVersion string          `json:"protocolVersion"`
	Kind            string          `json:"kind"`
	Type            string          `json:"type"`
	MessageID       string          `json:"messageId"`
	Timestamp       string          `json:"timestamp"`
	CorrelationID   string          `json:"correlationId,omitempty"`
	Payload         json.RawMessage `json:"payload"`
}

type AckEnvelope struct {
	ProtocolVersion string     `json:"protocolVersion"`
	Kind            string     `json:"kind"`
	Type            string     `json:"type"`
	MessageID       string     `json:"messageId"`
	Timestamp       string     `json:"timestamp"`
	CorrelationID   string     `json:"correlationId,omitempty"`
	Payload         AckPayload `json:"payload"`
}

type AckPayload struct {
	Status  string         `json:"status"`
	Details map[string]any `json:"details,omitempty"`
}

type ErrorEnvelope struct {
	ProtocolVersion string       `json:"protocolVersion"`
	Kind            string       `json:"kind"`
	Type            string       `json:"type"`
	MessageID       string       `json:"messageId"`
	Timestamp       string       `json:"timestamp"`
	CorrelationID   string       `json:"correlationId,omitempty"`
	Payload         ErrorPayload `json:"payload"`
}

type ErrorPayload struct {
	Code       string         `json:"code"`
	MessageKey string         `json:"messageKey"`
	Details    map[string]any `json:"details,omitempty"`
}

type EventEnvelope struct {
	ProtocolVersion string          `json:"protocolVersion"`
	Kind            string          `json:"kind"`
	Type            string          `json:"type"`
	MessageID       string          `json:"messageId"`
	Timestamp       string          `json:"timestamp"`
	CorrelationID   string          `json:"correlationId,omitempty"`
	Payload         json.RawMessage `json:"payload"`
}

type HandshakePayload struct {
	ProtocolVersion string `json:"protocolVersion"`
	PlayerID        string `json:"playerId"`
	ClientType      string `json:"clientType"`
	ClientVersion   string `json:"clientVersion"`
	Platform        string `json:"platform"`
}

type SubscriptionTarget struct {
	Kind      string `json:"kind"`
	LobbyID   string `json:"lobbyId,omitempty"`
	RequestID string `json:"requestId,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
}

type SubscribePayload struct {
	Target SubscriptionTarget `json:"target"`
}

type ResolveIdentityRequest struct {
	PlayerID string `json:"playerId"`
}

type ResolveIdentityResponse struct {
	PlayerID string `json:"playerId"`
}

type AuthorizeSubscriptionRequest struct {
	PlayerID string             `json:"playerId"`
	Target   SubscriptionTarget `json:"target"`
}

type AuthorizeSubscriptionResponse struct {
	Allowed bool   `json:"allowed"`
	Channel string `json:"channel"`
}

type PlatformRealtimeEvent struct {
	ProtocolVersion string          `json:"protocolVersion"`
	EventType       string          `json:"eventType"`
	MessageID       string          `json:"messageId"`
	OccurredAt      string          `json:"occurredAt"`
	Channels        []string        `json:"channels"`
	Payload         json.RawMessage `json:"payload"`
}