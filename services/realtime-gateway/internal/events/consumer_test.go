package events

import (
	"encoding/json"
	"io"
	"log"
	"testing"
	"time"

	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/contracts"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/runtime"
	"github.com/nats-io/nats.go"
)

func TestHandleDeliversToSubscribedRecipients(t *testing.T) {
	registry := runtime.NewLocalRegistry()
	send := make(chan []byte, 1)
	closed := make(chan struct{})
	registry.Register(&runtime.ConnectionSnapshot{
		ConnectionID:       "conn-1",
		PlayerID:           "player-a",
		SubscribedChannels: []string{"player:player-a"},
		Send:               send,
		Closed:             closed,
	})

	consumer := NewConsumer(nil, log.New(io.Discard, "", 0), registry)
	payload := mustJSON(t, map[string]any{"marker": "delivered"})
	message := &nats.Msg{Data: mustJSON(t, contracts.PlatformRealtimeEvent{
		ProtocolVersion: "realtime.v1",
		EventType:       "test.injected",
		MessageID:       "evt-1",
		OccurredAt:      time.Now().UTC().Format(time.RFC3339Nano),
		Channels:        []string{"player:player-a"},
		Payload:         payload,
	})}

	consumer.handle(message)

	select {
	case raw := <-send:
		var envelope contracts.EventEnvelope
		if err := json.Unmarshal(raw, &envelope); err != nil {
			t.Fatalf("unmarshal event envelope: %v", err)
		}
		if envelope.Type != "test.injected" {
			t.Fatalf("expected test.injected event type, got %s", envelope.Type)
		}
	case <-time.After(time.Second):
		t.Fatal("expected event delivery to subscribed recipient")
	}
}

func TestHandleSkipsClosedRecipients(t *testing.T) {
	registry := runtime.NewLocalRegistry()
	send := make(chan []byte, 1)
	closed := make(chan struct{})
	close(closed)
	registry.Register(&runtime.ConnectionSnapshot{
		ConnectionID:       "conn-1",
		PlayerID:           "player-a",
		SubscribedChannels: []string{"player:player-a"},
		Send:               send,
		Closed:             closed,
	})

	consumer := NewConsumer(nil, log.New(io.Discard, "", 0), registry)
	message := &nats.Msg{Data: mustJSON(t, contracts.PlatformRealtimeEvent{
		ProtocolVersion: "realtime.v1",
		EventType:       "test.injected",
		MessageID:       "evt-2",
		OccurredAt:      time.Now().UTC().Format(time.RFC3339Nano),
		Channels:        []string{"player:player-a"},
		Payload:         mustJSON(t, map[string]any{"marker": "closed"}),
	})}

	consumer.handle(message)

	select {
	case <-send:
		t.Fatal("did not expect delivery to closed recipient")
	default:
	}
}

func TestHandleClosesSlowConsumerWhenQueueIsFull(t *testing.T) {
	registry := runtime.NewLocalRegistry()
	send := make(chan []byte, 1)
	send <- []byte(`{"kind":"event","type":"queued"}`)
	closed := make(chan struct{})
	closeCalled := false
	registry.Register(&runtime.ConnectionSnapshot{
		ConnectionID:       "conn-1",
		PlayerID:           "player-a",
		SubscribedChannels: []string{"player:player-a"},
		Send:               send,
		Closed:             closed,
		CloseSlowConsumer: func() {
			closeCalled = true
		},
	})

	consumer := NewConsumer(nil, log.New(io.Discard, "", 0), registry)
	message := &nats.Msg{Data: mustJSON(t, contracts.PlatformRealtimeEvent{
		ProtocolVersion: "realtime.v1",
		EventType:       "test.injected",
		MessageID:       "evt-3",
		OccurredAt:      time.Now().UTC().Format(time.RFC3339Nano),
		Channels:        []string{"player:player-a"},
		Payload:         mustJSON(t, map[string]any{"marker": "full"}),
	})}

	consumer.handle(message)

	if !closeCalled {
		t.Fatal("expected slow-consumer policy to trigger when outbound queue is full")
	}
}

func mustJSON(t *testing.T, value any) []byte {
	t.Helper()

	body, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}

	return body
}