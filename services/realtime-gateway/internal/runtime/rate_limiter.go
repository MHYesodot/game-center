package runtime

import (
	"sync"
	"time"
)

type TokenBucket struct {
	mu        sync.Mutex
	rate      float64
	burst     float64
	tokens    float64
	updatedAt time.Time
}

func NewTokenBucket(rate float64, burst int) *TokenBucket {
	now := time.Now()
	return &TokenBucket{rate: rate, burst: float64(burst), tokens: float64(burst), updatedAt: now}
}

func (bucket *TokenBucket) Allow() bool {
	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	now := time.Now()
	bucket.tokens += now.Sub(bucket.updatedAt).Seconds() * bucket.rate
	bucket.updatedAt = now
	if bucket.tokens > bucket.burst {
		bucket.tokens = bucket.burst
	}

	if bucket.tokens < 1 {
		return false
	}

	bucket.tokens -= 1
	return true
}