package runtime

import "testing"

func TestRegisterIndexesPreseededChannels(t *testing.T) {
	registry := NewLocalRegistry()
	snapshot := &ConnectionSnapshot{
		ConnectionID:       "conn-1",
		PlayerID:           "player-a",
		SubscribedChannels: []string{"player:player-a", "lobby:lobby-1"},
	}

	registry.Register(snapshot)

	recipients := registry.Recipients([]string{"player:player-a", "lobby:lobby-1"})
	if len(recipients) != 1 {
		t.Fatalf("expected one recipient, got %d", len(recipients))
	}
	if recipients[0].ConnectionID != snapshot.ConnectionID {
		t.Fatalf("expected connection %s, got %s", snapshot.ConnectionID, recipients[0].ConnectionID)
	}

	if !registry.AddSubscription(snapshot.ConnectionID, "player:player-a") {
		t.Fatalf("expected duplicate subscription add to succeed")
	}
	recipients = registry.Recipients([]string{"player:player-a"})
	if len(recipients) != 1 {
		t.Fatalf("expected player channel to remain indexed after duplicate add, got %d recipients", len(recipients))
	}
	if recipients[0].ConnectionID != snapshot.ConnectionID {
		t.Fatalf("expected connection %s after duplicate add, got %s", snapshot.ConnectionID, recipients[0].ConnectionID)
	}
}