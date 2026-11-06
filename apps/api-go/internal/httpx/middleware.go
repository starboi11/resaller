package httpx

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

var safeMethods = map[string]bool{"GET": true, "HEAD": true, "OPTIONS": true}

// OriginAllowed is common/origin-policy.ts: unsafe methods need an allow-listed Origin.
func OriginAllowed(method, origin string, allowed []string) bool {
	if safeMethods[strings.ToUpper(method)] {
		return true
	}
	return origin != "" && slices.Contains(allowed, origin)
}

// CORS reproduces enableCors({ origin: list, credentials: true }).
func CORS(allowed []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			h := w.Header()
			h.Add("Vary", "Origin")
			if origin != "" && slices.Contains(allowed, origin) {
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
			}
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE")
				if requested := r.Header.Get("Access-Control-Request-Headers"); requested != "" {
					h.Set("Access-Control-Allow-Headers", requested)
					h.Add("Vary", "Access-Control-Request-Headers")
				}
				h.Set("Content-Length", "0")
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// OriginGuard blocks cross-site state changes before any handler runs.
func OriginGuard(allowed []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !OriginAllowed(r.Method, r.Header.Get("Origin"), allowed) {
				JSON(w, http.StatusForbidden, errorBody{Code: "ORIGIN_FORBIDDEN", Message: "Cross-site request blocked", RequestID: RequestIDFrom(r.Context())})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders matches @fastify/helmet as configured in main.ts.
func SecurityHeaders(next http.Handler) http.Handler {
	headers := map[string]string{
		"Content-Security-Policy":           "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'none';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
		"Cross-Origin-Opener-Policy":        "same-origin",
		"Cross-Origin-Resource-Policy":      "same-origin",
		"Origin-Agent-Cluster":              "?1",
		"Referrer-Policy":                   "no-referrer",
		"Strict-Transport-Security":         "max-age=31536000; includeSubDomains",
		"X-Content-Type-Options":            "nosniff",
		"X-Dns-Prefetch-Control":            "off",
		"X-Download-Options":                "noopen",
		"X-Frame-Options":                   "SAMEORIGIN",
		"X-Permitted-Cross-Domain-Policies": "none",
		"X-Xss-Protection":                  "0",
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for key, value := range headers {
			w.Header().Set(key, value)
		}
		next.ServeHTTP(w, r)
	})
}

// ClientIP returns the address that connected to our single trusted proxy.
// With TRUST_PROXY=true exactly one hop (Caddy) is trusted, so the client is
// the right-most X-Forwarded-For entry: anything to its left was supplied by
// the client and must never key a rate limit (Fastify trustProxy: 1).
func ClientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		values := r.Header.Values("X-Forwarded-For")
		if len(values) > 0 {
			parts := strings.Split(values[len(values)-1], ",")
			if last := strings.TrimSpace(parts[len(parts)-1]); last != "" {
				return last
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// Limiter is a shared fixed-window counter (Redis in production).
type Limiter interface {
	FixedWindowLimit(ctx context.Context, key string, limit, ttlSeconds int) (bool, error)
}

// RateLimit is the global per-IP limit. With a shared limiter every API
// instance enforces one cluster-wide window; if Redis is unreachable it falls
// back to this process's own window rather than failing every request.
func RateLimit(max int, window time.Duration, trustProxy bool, shared Limiter, hashIP func(string) string) func(http.Handler) http.Handler {
	local := localRateLimit(max, window, trustProxy)
	return func(next http.Handler) http.Handler {
		fallback := local(next)
		if shared == nil {
			return fallback
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			allowed, err := shared.FixedWindowLimit(r.Context(), "http:"+hashIP(ClientIP(r, trustProxy)), max, int(window.Seconds()))
			if err != nil {
				fallback.ServeHTTP(w, r)
				return
			}
			w.Header().Set("X-Ratelimit-Limit", itoa(max))
			if !allowed {
				w.Header().Set("Retry-After", itoa(int(window.Seconds())))
				JSON(w, http.StatusTooManyRequests, errorBody{Code: "HTTP_429", Message: "Rate limit exceeded, retry in 1 minute", RequestID: RequestIDFrom(r.Context())})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func localRateLimit(max int, window time.Duration, trustProxy bool) func(http.Handler) http.Handler {
	type bucket struct {
		count int
		reset time.Time
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}
	go func() {
		for range time.Tick(window) {
			mu.Lock()
			now := time.Now()
			for key, b := range buckets {
				if now.After(b.reset) {
					delete(buckets, key)
				}
			}
			mu.Unlock()
		}
	}()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := ClientIP(r, trustProxy)
			now := time.Now()
			mu.Lock()
			b := buckets[ip]
			if b == nil || now.After(b.reset) {
				b = &bucket{reset: now.Add(window)}
				buckets[ip] = b
			}
			b.count++
			count, reset := b.count, b.reset
			mu.Unlock()
			remaining := max - count
			if remaining < 0 {
				remaining = 0
			}
			h := w.Header()
			h.Set("X-Ratelimit-Limit", itoa(max))
			h.Set("X-Ratelimit-Remaining", itoa(remaining))
			h.Set("X-Ratelimit-Reset", itoa(int(time.Until(reset).Seconds()+0.999)))
			if count > max {
				h.Set("Retry-After", itoa(int(time.Until(reset).Seconds()+0.999)))
				JSON(w, http.StatusTooManyRequests, errorBody{Code: "HTTP_429", Message: "Rate limit exceeded, retry in 1 minute", RequestID: RequestIDFrom(r.Context())})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func itoa(n int) string { return strconv.Itoa(n) }

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) { s.status = code; s.ResponseWriter.WriteHeader(code) }

// Flush keeps Server-Sent Events working through the recorder.
func (s *statusRecorder) Flush() {
	if f, ok := s.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// AccessLog logs method, path and status; cookies and authorization headers
// are never logged (the Fastify logger redacts them).
func AccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		slog.Info("request", "requestId", RequestIDFrom(r.Context()), "method", r.Method, "path", r.URL.Path,
			"status", recorder.status, "durationMs", time.Since(started).Milliseconds())
	})
}

// Recover turns a panic into the masked 500 body.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if value := recover(); value != nil {
				slog.Error("panic", "requestId", RequestIDFrom(r.Context()), "value", value)
				JSON(w, http.StatusInternalServerError, errorBody{Code: "INTERNAL_ERROR", Message: "Unexpected server error", RequestID: RequestIDFrom(r.Context())})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// NotFound reproduces Nest's "Cannot GET /path" response.
func NotFoundHandler(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusNotFound, errorBody{Code: "HTTP_404", Message: "Cannot " + r.Method + " " + r.URL.RequestURI(), RequestID: RequestIDFrom(r.Context())})
}
