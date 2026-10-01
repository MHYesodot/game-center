package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisRegistry struct {
	client    *redis.Client
	namespace string
	ttl       time.Duration
}

type RedisConnectionMetadata struct {
	ConnectionID    string    `json:"connectionId"`
	PlayerID        string    `json:"playerId"`
	GatewayNodeID   string    `json:"gatewayNodeId"`
	State           string    `json:"state"`
	ProtocolVersion string    `json:"protocolVersion"`
	ClientType      string    `json:"clientType"`
	ClientVersion   string    `json:"clientVersion"`
	Platform        string    `json:"platform"`
	ConnectedAt     time.Time `json:"connectedAt"`
	LastHeartbeatAt time.Time `json:"lastHeartbeatAt"`
	RemoteAddr      string    `json:"remoteAddress"`
}

type PresenceRecord struct {
	PlayerID        string `json:"playerId"`
	State           string `json:"state"`
	ConnectionCount int64  `json:"connectionCount"`
	LastHeartbeatAt string `json:"lastHeartbeatAt"`
	GatewayNodeID   string `json:"gatewayNodeId"`
}

func NewRedisRegistry(redisURL string, namespace string, ttl time.Duration) (*RedisRegistry, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	return &RedisRegistry{
		client:    redis.NewClient(options),
		namespace: namespace,
		ttl:       ttl,
	}, nil
}

func (registry *RedisRegistry) Close() error {
	return registry.client.Close()
}

func (registry *RedisRegistry) Ping(ctx context.Context) error {
	return registry.client.Ping(ctx).Err()
}

func (registry *RedisRegistry) RegisterConnection(ctx context.Context, metadata RedisConnectionMetadata, channels []string) error {
	return registry.syncConnection(ctx, metadata, channels)
}

func (registry *RedisRegistry) TouchConnection(ctx context.Context, metadata RedisConnectionMetadata, channels []string) error {
	return registry.syncConnection(ctx, metadata, channels)
}

func (registry *RedisRegistry) Subscribe(ctx context.Context, metadata RedisConnectionMetadata, channel string, channels []string) error {
	if err := registry.syncConnection(ctx, metadata, channels); err != nil {
		return err
	}

	expiresAt := float64(time.Now().Add(registry.ttl).UnixMilli())
	pipe := registry.client.TxPipeline()
	pipe.ZAdd(ctx, registry.channelConnectionsKey(channel), redis.Z{Score: expiresAt, Member: metadata.ConnectionID})
	pipe.Expire(ctx, registry.channelConnectionsKey(channel), registry.ttl)
	_, err := pipe.Exec(ctx)
	return err
}

func (registry *RedisRegistry) Unsubscribe(ctx context.Context, metadata RedisConnectionMetadata, channel string) error {
	pipe := registry.client.TxPipeline()
	pipe.ZRem(ctx, registry.channelConnectionsKey(channel), metadata.ConnectionID)
	pipe.SRem(ctx, registry.connectionChannelsKey(metadata.ConnectionID), channel)
	_, err := pipe.Exec(ctx)
	return err
}

func (registry *RedisRegistry) UnregisterConnection(ctx context.Context, metadata RedisConnectionMetadata, channels []string) error {
	pipe := registry.client.TxPipeline()
	pipe.Del(ctx, registry.connectionKey(metadata.ConnectionID))
	pipe.Del(ctx, registry.connectionChannelsKey(metadata.ConnectionID))
	pipe.ZRem(ctx, registry.playerConnectionsKey(metadata.PlayerID), metadata.ConnectionID)
	for _, channel := range channels {
		pipe.ZRem(ctx, registry.channelConnectionsKey(channel), metadata.ConnectionID)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}

	return registry.refreshPresence(ctx, metadata.PlayerID, metadata.GatewayNodeID, metadata.LastHeartbeatAt)
}

func (registry *RedisRegistry) syncConnection(ctx context.Context, metadata RedisConnectionMetadata, channels []string) error {
	payload, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("marshal connection metadata: %w", err)
	}

	expiresAt := float64(time.Now().Add(registry.ttl).UnixMilli())
	pipe := registry.client.TxPipeline()
	pipe.Set(ctx, registry.connectionKey(metadata.ConnectionID), payload, registry.ttl)
	pipe.ZAdd(ctx, registry.playerConnectionsKey(metadata.PlayerID), redis.Z{Score: expiresAt, Member: metadata.ConnectionID})
	pipe.Expire(ctx, registry.playerConnectionsKey(metadata.PlayerID), registry.ttl)
	pipe.Del(ctx, registry.connectionChannelsKey(metadata.ConnectionID))
	if len(channels) > 0 {
		members := make([]any, 0, len(channels))
		for _, channel := range channels {
			members = append(members, channel)
			pipe.ZAdd(ctx, registry.channelConnectionsKey(channel), redis.Z{Score: expiresAt, Member: metadata.ConnectionID})
			pipe.Expire(ctx, registry.channelConnectionsKey(channel), registry.ttl)
		}
		pipe.SAdd(ctx, registry.connectionChannelsKey(metadata.ConnectionID), members...)
	}
	pipe.Expire(ctx, registry.connectionChannelsKey(metadata.ConnectionID), registry.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}

	return registry.refreshPresence(ctx, metadata.PlayerID, metadata.GatewayNodeID, metadata.LastHeartbeatAt)
}

func (registry *RedisRegistry) refreshPresence(ctx context.Context, playerID string, gatewayNodeID string, lastHeartbeatAt time.Time) error {
	now := time.Now().UnixMilli()
	playerKey := registry.playerConnectionsKey(playerID)
	if err := registry.client.ZRemRangeByScore(ctx, playerKey, "-inf", fmt.Sprintf("%d", now-1)).Err(); err != nil {
		return err
	}

	count, err := registry.client.ZCard(ctx, playerKey).Result()
	if err != nil {
		return err
	}

	presenceKey := registry.presenceKey(playerID)
	if count == 0 {
		return registry.client.Del(ctx, presenceKey).Err()
	}

	payload, err := json.Marshal(PresenceRecord{
		PlayerID:        playerID,
		State:           "online",
		ConnectionCount: count,
		LastHeartbeatAt: lastHeartbeatAt.UTC().Format(time.RFC3339Nano),
		GatewayNodeID:   gatewayNodeID,
	})
	if err != nil {
		return err
	}

	return registry.client.Set(ctx, presenceKey, payload, registry.ttl).Err()
}

func (registry *RedisRegistry) connectionKey(connectionID string) string {
	return fmt.Sprintf("%s:connection:%s", registry.namespace, connectionID)
}

func (registry *RedisRegistry) playerConnectionsKey(playerID string) string {
	return fmt.Sprintf("%s:player:%s:connections", registry.namespace, playerID)
}

func (registry *RedisRegistry) connectionChannelsKey(connectionID string) string {
	return fmt.Sprintf("%s:connection:%s:channels", registry.namespace, connectionID)
}

func (registry *RedisRegistry) channelConnectionsKey(channel string) string {
	return fmt.Sprintf("%s:channel:%s:connections", registry.namespace, channel)
}

func (registry *RedisRegistry) presenceKey(playerID string) string {
	return fmt.Sprintf("%s:presence:%s", registry.namespace, playerID)
}