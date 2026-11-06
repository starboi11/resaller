// Package health ports health.controller.ts.
package health

import (
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/resaller/api-go/internal/config"
	"github.com/resaller/api-go/internal/httpx"
	"github.com/resaller/api-go/internal/platform"
)

type Handlers struct {
	db    *pgxpool.Pool
	redis *platform.Redis
	cfg   config.Config
}

func New(db *pgxpool.Pool, redis *platform.Redis, cfg config.Config) *Handlers {
	return &Handlers{db: db, redis: redis, cfg: cfg}
}

type status struct {
	Status    string     `json:"status"`
	Service   string     `json:"service"`
	Timestamp httpx.Time `json:"timestamp"`
	Checks    *checks    `json:"checks,omitempty"`
}

type checks struct {
	Database string `json:"database"`
	Redis    string `json:"redis"`
	Queue    string `json:"queue"`
	Storage  string `json:"storage"`
}

func upDown(ok bool) string {
	if ok {
		return "up"
	}
	return "down"
}

// storageHealthy requires 100 MiB free on both local media roots.
func (h *Handlers) storageHealthy() bool {
	if h.cfg.MediaStorageDriver == "s3" {
		return true
	}
	for _, root := range []string{h.cfg.MediaRoot, h.cfg.PrivateMediaRoot} {
		abs, err := filepath.Abs(root)
		if err != nil || os.MkdirAll(abs, 0o755) != nil {
			return false
		}
		var fs syscall.Statfs_t
		if syscall.Statfs(abs, &fs) != nil || uint64(fs.Bavail)*uint64(fs.Bsize) < 100*1024*1024 {
			return false
		}
	}
	return true
}

func (h *Handlers) Routes(r chi.Router) {
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, status{Status: "ok", Service: "resaller-api", Timestamp: httpx.Time{Time: time.Now()}})
	})
	r.Get("/ready", func(w http.ResponseWriter, r *http.Request) {
		database := platform.PingDB(r.Context(), h.db)
		redis := h.redis.Ping(r.Context())
		queue := redis && h.redis.QueueHealthy(r.Context())
		storage := h.storageHealthy()
		healthy := database && redis && queue && storage
		code, state := http.StatusOK, "ok"
		if !healthy {
			code, state = http.StatusServiceUnavailable, "degraded"
		}
		httpx.JSON(w, code, status{Status: state, Service: "resaller-api", Timestamp: httpx.Time{Time: time.Now()},
			Checks: &checks{upDown(database), upDown(redis), upDown(queue), upDown(storage)}})
	})
}
