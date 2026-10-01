package runtime

import (
	"sync"
	"time"
)

type ConnectionSnapshot struct {
	ConnectionID       string
	PlayerID           string
	GatewayNodeID      string
	ProtocolVersion    string
	ClientType         string
	ClientVersion      string
	Platform           string
	State              string
	ConnectedAt        time.Time
	LastHeartbeatAt    time.Time
	RemoteAddr         string
	SubscribedChannels []string
	Send               chan []byte
	Closed             <-chan struct{}
	CloseSlowConsumer  func()
}

type LocalRegistry struct {
	mu           sync.RWMutex
	connections  map[string]*ConnectionSnapshot
	playerIndex  map[string]map[string]*ConnectionSnapshot
	channelIndex map[string]map[string]*ConnectionSnapshot
}

func NewLocalRegistry() *LocalRegistry {
	return &LocalRegistry{
		connections:  make(map[string]*ConnectionSnapshot),
		playerIndex:  make(map[string]map[string]*ConnectionSnapshot),
		channelIndex: make(map[string]map[string]*ConnectionSnapshot),
	}
}

func (registry *LocalRegistry) Register(snapshot *ConnectionSnapshot) {
	registry.mu.Lock()
	defer registry.mu.Unlock()

	registry.connections[snapshot.ConnectionID] = snapshot
	if _, ok := registry.playerIndex[snapshot.PlayerID]; !ok {
		registry.playerIndex[snapshot.PlayerID] = make(map[string]*ConnectionSnapshot)
	}
	registry.playerIndex[snapshot.PlayerID][snapshot.ConnectionID] = snapshot
	for _, channel := range snapshot.SubscribedChannels {
		if _, ok := registry.channelIndex[channel]; !ok {
			registry.channelIndex[channel] = make(map[string]*ConnectionSnapshot)
		}
		registry.channelIndex[channel][snapshot.ConnectionID] = snapshot
	}
}

func (registry *LocalRegistry) Unregister(connectionID string) *ConnectionSnapshot {
	registry.mu.Lock()
	defer registry.mu.Unlock()

	snapshot, ok := registry.connections[connectionID]
	if !ok {
		return nil
	}

	delete(registry.connections, connectionID)
	if playerConnections, ok := registry.playerIndex[snapshot.PlayerID]; ok {
		delete(playerConnections, connectionID)
		if len(playerConnections) == 0 {
			delete(registry.playerIndex, snapshot.PlayerID)
		}
	}
	for _, channel := range snapshot.SubscribedChannels {
		if channelConnections, ok := registry.channelIndex[channel]; ok {
			delete(channelConnections, connectionID)
			if len(channelConnections) == 0 {
				delete(registry.channelIndex, channel)
			}
		}
	}

	return snapshot
}

func (registry *LocalRegistry) AddSubscription(connectionID string, channel string) bool {
	registry.mu.Lock()
	defer registry.mu.Unlock()

	snapshot, ok := registry.connections[connectionID]
	if !ok {
		return false
	}
	for _, current := range snapshot.SubscribedChannels {
		if current == channel {
			return true
		}
	}

	snapshot.SubscribedChannels = append(snapshot.SubscribedChannels, channel)
	if _, ok := registry.channelIndex[channel]; !ok {
		registry.channelIndex[channel] = make(map[string]*ConnectionSnapshot)
	}
	registry.channelIndex[channel][connectionID] = snapshot
	return true
}

func (registry *LocalRegistry) RemoveSubscription(connectionID string, channel string) *ConnectionSnapshot {
	registry.mu.Lock()
	defer registry.mu.Unlock()

	snapshot, ok := registry.connections[connectionID]
	if !ok {
		return nil
	}

	filtered := snapshot.SubscribedChannels[:0]
	for _, current := range snapshot.SubscribedChannels {
		if current != channel {
			filtered = append(filtered, current)
		}
	}
	snapshot.SubscribedChannels = filtered

	if channelConnections, ok := registry.channelIndex[channel]; ok {
		delete(channelConnections, connectionID)
		if len(channelConnections) == 0 {
			delete(registry.channelIndex, channel)
		}
	}

	return snapshot
}

func (registry *LocalRegistry) TouchHeartbeat(connectionID string, at time.Time) *ConnectionSnapshot {
	registry.mu.Lock()
	defer registry.mu.Unlock()

	snapshot, ok := registry.connections[connectionID]
	if !ok {
		return nil
	}
	snapshot.LastHeartbeatAt = at
	return snapshot
}

func (registry *LocalRegistry) Snapshot() []*ConnectionSnapshot {
	registry.mu.RLock()
	defer registry.mu.RUnlock()

	result := make([]*ConnectionSnapshot, 0, len(registry.connections))
	for _, current := range registry.connections {
		clone := *current
		clone.SubscribedChannels = append([]string{}, current.SubscribedChannels...)
		result = append(result, &clone)
	}

	return result
}

func (registry *LocalRegistry) Recipients(channels []string) []*ConnectionSnapshot {
	registry.mu.RLock()
	defer registry.mu.RUnlock()

	seen := make(map[string]*ConnectionSnapshot)
	for _, channel := range channels {
		for connectionID, connection := range registry.channelIndex[channel] {
			seen[connectionID] = connection
		}
	}

	result := make([]*ConnectionSnapshot, 0, len(seen))
	for _, connection := range seen {
		result = append(result, connection)
	}

	return result
}