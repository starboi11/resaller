// Command api is the Go port of the Resaller API. It serves the same routes
// under /api/v1 against the same PostgreSQL schema and Redis keys as the
// NestJS API, so the two can run side by side during the migration.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/resaller/api-go/internal/auth"
	"github.com/resaller/api-go/internal/config"
	"github.com/resaller/api-go/internal/health"
	"github.com/resaller/api-go/internal/httpx"
	"github.com/resaller/api-go/internal/platform"
	"github.com/resaller/api-go/internal/secure"
)

func logLevel(name string) slog.Level {
	switch name {
	case "fatal", "error":
		return slog.LevelError
	case "warn":
		return slog.LevelWarn
	case "debug", "trace":
		return slog.LevelDebug
	}
	return slog.LevelInfo
}

// NewRouter builds the full middleware chain in the order Fastify applies it.
func NewRouter(cfg config.Config, redis *platform.Redis, authHandlers *auth.Handlers, healthHandlers *health.Handlers) http.Handler {
	limit := 1000
	if cfg.Production() {
		limit = 120
	}
	root := chi.NewRouter()
	root.Use(httpx.RequestID, httpx.Recover, httpx.AccessLog, httpx.SecurityHeaders,
		httpx.CORS(cfg.CORSOrigins), httpx.RateLimit(limit, time.Minute, cfg.TrustProxy, redis, func(ip string) string { return secure.HMACBase64(cfg.SessionSecret, ip) }), httpx.OriginGuard(cfg.CORSOrigins))
	root.NotFound(httpx.NotFoundHandler)
	root.MethodNotAllowed(httpx.NotFoundHandler)
	root.Route("/api/v1", func(r chi.Router) {
		r.Route("/health", healthHandlers.Routes)
		r.Route("/auth", authHandlers.Routes)
	})
	return root
}

func run() error {
	config.LoadDotEnv(".env", "../../.env")
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel(cfg.LogLevel)})))
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	db, err := platform.OpenDB(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("database: %w", err)
	}
	defer db.Close()
	redis, err := platform.OpenRedis(cfg.RedisURL)
	if err != nil {
		return fmt.Errorf("redis: %w", err)
	}
	defer redis.Close()

	handler := NewRouter(cfg, redis, auth.NewHandlers(auth.NewService(db, redis, cfg)), health.New(db, redis, cfg))
	host := cfg.Host
	if strings.Contains(host, ":") {
		host = "[" + host + "]"
	}
	server := &http.Server{Addr: fmt.Sprintf("%s:%d", host, cfg.Port), Handler: handler,
		ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 120 * time.Second}
	errs := make(chan error, 1)
	go func() {
		slog.Info("resaller go api listening", "addr", server.Addr, "env", cfg.NodeEnv)
		errs <- server.ListenAndServe()
	}()
	select {
	case err := <-errs:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
	return nil
}

func main() {
	if err := run(); err != nil {
		slog.Error("api stopped", "error", err.Error())
		os.Exit(1)
	}
}
