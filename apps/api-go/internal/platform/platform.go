// Package platform owns the PostgreSQL pool and the Redis client.
package platform

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func OpenDB(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 20
	return pgxpool.NewWithConfig(ctx, cfg)
}

func PingDB(ctx context.Context, db *pgxpool.Pool) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	var one int
	return db.QueryRow(ctx, "SELECT 1").Scan(&one) == nil
}

type Redis struct{ client *redis.Client }

func OpenRedis(url string) (*Redis, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	opts.MaxRetries = 1
	return &Redis{client: redis.NewClient(opts)}, nil
}

func (r *Redis) Ping(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return r.client.Ping(ctx).Val() == "PONG"
}

var fixedWindow = redis.NewScript("local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return count")

// FixedWindowLimit shares keys with the Node limiter ("resaller:limit:*"), so
// attempts against either backend count against the same window.
func (r *Redis) FixedWindowLimit(ctx context.Context, key string, limit, ttlSeconds int) (bool, error) {
	count, err := fixedWindow.Run(ctx, r.client, []string{"resaller:limit:" + key}, ttlSeconds).Int()
	if err != nil {
		return false, err
	}
	return count <= limit, nil
}

// QueueHealthy mirrors NotificationQueueService.health(): up when the queue
// sets can be read.
func (r *Redis) QueueHealthy(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	pipe := r.client.Pipeline()
	pipe.ZCard(ctx, "resaller:notify:scheduled")
	pipe.ZCard(ctx, "resaller:notify:processing")
	_, err := pipe.Exec(ctx)
	return err == nil
}

func (r *Redis) Close() error { return r.client.Close() }
