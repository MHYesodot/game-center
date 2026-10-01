package events

import (
	"encoding/json"
	"log"
	"time"

	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/contracts"
	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/runtime"
	"github.com/nats-io/nats.go"
)

const RealtimeEventsSubject = "gc.v1.realtime.events"

type Consumer struct {
	connection   *nats.Conn
	logger       *log.Logger
	registry     *runtime.LocalRegistry
	subscription *nats.Subscription
}

func Connect(url string) (*nats.Conn, error) {
	return nats.Connect(
		url,
		nats.Name("realtime-gateway"),
		nats.ReconnectWait(250*time.Millisecond),
		nats.MaxReconnects(-1),
		nats.RetryOnFailedConnect(true),
	)
}

func NewConsumer(connection *nats.Conn, logger *log.Logger, registry *runtime.LocalRegistry) *Consumer {
	return &Consumer{connection: connection, logger: logger, registry: registry}
}

func (consumer *Consumer) Start() error {
	subscription, err := consumer.connection.Subscribe(RealtimeEventsSubject, consumer.handle)
	if err != nil {
		return err
	}

	consumer.subscription = subscription
	return nil
}

func (consumer *Consumer) Close() error {
	if consumer.connection != nil {
		defer consumer.connection.Close()
	}
	if consumer.subscription != nil {
		return consumer.subscription.Drain()
	}

	return nil
}

func (consumer *Consumer) Ready() error {
	if consumer.connection.Status() != nats.CONNECTED {
		return nats.ErrConnectionClosed
	}

	return consumer.connection.Flush()
}

func (consumer *Consumer) handle(message *nats.Msg) {
	var event contracts.PlatformRealtimeEvent
	if err := json.Unmarshal(message.Data, &event); err != nil {
		consumer.logger.Printf(`{"level":"error","service":"realtime-gateway","message":"event_decode_failed","error":%q}`+"\n", err.Error())
		return
	}

	envelope, err := json.Marshal(contracts.EventEnvelope{
		ProtocolVersion: event.ProtocolVersion,
		Kind:            "event",
		Type:            event.EventType,
		MessageID:       event.MessageID,
		Timestamp:       event.OccurredAt,
		Payload:         event.Payload,
	})
	if err != nil {
		consumer.logger.Printf(`{"level":"error","service":"realtime-gateway","message":"event_encode_failed","error":%q}`+"\n", err.Error())
		return
	}

	for _, connection := range consumer.registry.Recipients(event.Channels) {
		select {
		case <-connection.Closed:
			continue
		default:
		}

		select {
		case connection.Send <- envelope:
		default:
			if connection.CloseSlowConsumer != nil {
				connection.CloseSlowConsumer()
			}
		}
	}
}