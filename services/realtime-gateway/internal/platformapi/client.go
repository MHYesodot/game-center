package platformapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mhurwitz/game-center/services/realtime-gateway/internal/contracts"
)

type Client struct {
	baseURL    string
	sharedSecret string
	httpClient *http.Client
}

type RequestError struct {
	StatusCode int
}

func (err RequestError) Error() string {
	return fmt.Sprintf("platform-api returned status %d", err.StatusCode)
}

func NewClient(baseURL string, timeout time.Duration, sharedSecret string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		sharedSecret: strings.TrimSpace(sharedSecret),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (client *Client) ResolveIdentity(ctx context.Context, ticket string) (string, error) {
	response := contracts.ResolveIdentityResponse{}
	if err := client.post(ctx, "/api/internal/realtime/identity/resolve", contracts.ResolveIdentityRequest{Ticket: ticket}, &response); err != nil {
		return "", err
	}

	return response.PlayerID, nil
}

func (client *Client) AuthorizeSubscription(ctx context.Context, playerID string, target contracts.SubscriptionTarget) (contracts.AuthorizeSubscriptionResponse, error) {
	response := contracts.AuthorizeSubscriptionResponse{}
	err := client.post(ctx, "/api/internal/realtime/subscriptions/authorize", contracts.AuthorizeSubscriptionRequest{
		PlayerID: playerID,
		Target:   target,
	}, &response)
	return response, err
}

func (client *Client) Ready(ctx context.Context) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, client.baseURL+"/health/ready", nil)
	if err != nil {
		return err
	}

	response, err := client.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		return fmt.Errorf("platform-api readiness returned status %d", response.StatusCode)
	}

	return nil
}

func (client *Client) post(ctx context.Context, path string, payload any, result any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	if client.sharedSecret != "" {
		request.Header.Set("X-Realtime-Gateway-Secret", client.sharedSecret)
	}

	response, err := client.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		return RequestError{StatusCode: response.StatusCode}
	}

	if result == nil {
		return nil
	}

	return json.NewDecoder(response.Body).Decode(result)
}