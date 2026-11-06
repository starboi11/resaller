// Package config mirrors packages/config (apiEnvironmentSchema) so one .env
// file configures both backends identically.
package config

import (
	"bufio"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	NodeEnv               string
	Port                  int
	Host                  string
	TrustProxy            bool
	DatabaseURL           string
	RedisURL              string
	SessionSecret         string
	DataEncryptionKey     string
	DataEncryptionKeyPrev string
	PublicWebURL          string
	LogLevel              string
	CORSOrigins           []string
	MediaRoot             string
	PrivateMediaRoot      string
	MediaStorageDriver    string
	EmailWebhookURL       string
	EmailWebhookToken     string
	MetricsToken          string
	OwnerStoreUsername    string
}

func (c Config) Production() bool { return c.NodeEnv == "production" }
func (c Config) Deployed() bool   { return c.NodeEnv == "production" || c.NodeEnv == "staging" }

// EncryptionSecret follows `DATA_ENCRYPTION_KEY ?? SESSION_SECRET`.
func (c Config) EncryptionSecret() string {
	if c.DataEncryptionKey != "" {
		return c.DataEncryptionKey
	}
	return c.SessionSecret
}

// LoadDotEnv fills variables that are not already set, like process.loadEnvFile
// in main.ts: production injects the environment, development reads .env.
func LoadDotEnv(paths ...string) {
	if os.Getenv("DATABASE_URL") != "" {
		return
	}
	for _, path := range paths {
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
				continue
			}
			key, value, _ := strings.Cut(line, "=")
			key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
			value = strings.Trim(strings.TrimSpace(value), `"'`)
			if _, exists := os.LookupEnv(key); !exists {
				os.Setenv(key, value)
			}
		}
		file.Close()
		return
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func isURL(value string) bool {
	u, err := url.Parse(value)
	return err == nil && u.Scheme != "" && u.Host != ""
}

// Load validates with the same rules as the zod schema and fails fast.
func Load() (Config, error) {
	var problems []string
	c := Config{
		NodeEnv:               env("NODE_ENV", "development"),
		Host:                  env("API_HOST", "0.0.0.0"),
		DatabaseURL:           os.Getenv("DATABASE_URL"),
		RedisURL:              os.Getenv("REDIS_URL"),
		SessionSecret:         os.Getenv("SESSION_SECRET"),
		DataEncryptionKey:     os.Getenv("DATA_ENCRYPTION_KEY"),
		DataEncryptionKeyPrev: os.Getenv("DATA_ENCRYPTION_KEY_PREVIOUS"),
		PublicWebURL:          os.Getenv("PUBLIC_WEB_URL"),
		LogLevel:              env("LOG_LEVEL", "info"),
		MediaRoot:             env("MEDIA_ROOT", "./data/media"),
		PrivateMediaRoot:      env("PRIVATE_MEDIA_ROOT", "./data/private-media"),
		MediaStorageDriver:    env("MEDIA_STORAGE_DRIVER", "local"),
		EmailWebhookURL:       os.Getenv("EMAIL_WEBHOOK_URL"),
		EmailWebhookToken:     os.Getenv("EMAIL_WEBHOOK_TOKEN"),
		MetricsToken:          os.Getenv("METRICS_TOKEN"),
		OwnerStoreUsername:    os.Getenv("OWNER_STORE_USERNAME"),
	}
	switch c.NodeEnv {
	case "development", "test", "staging", "production":
	default:
		problems = append(problems, "NODE_ENV must be development, test, staging or production")
	}
	port, err := strconv.Atoi(env("API_PORT", "4000"))
	if err != nil || port <= 0 {
		problems = append(problems, "API_PORT must be a positive integer")
	}
	c.Port = port
	switch env("TRUST_PROXY", "false") {
	case "true":
		c.TrustProxy = true
	case "false":
	default:
		problems = append(problems, "TRUST_PROXY must be true or false")
	}
	if c.DatabaseURL == "" {
		problems = append(problems, "DATABASE_URL is required")
	}
	if !isURL(c.RedisURL) {
		problems = append(problems, "REDIS_URL must be a URL")
	}
	if len(c.SessionSecret) < 32 {
		problems = append(problems, "SESSION_SECRET requires at least 32 characters")
	}
	if c.DataEncryptionKey != "" && len(c.DataEncryptionKey) < 32 {
		problems = append(problems, "DATA_ENCRYPTION_KEY requires at least 32 characters")
	}
	for _, origin := range strings.Split(os.Getenv("CORS_ORIGINS"), ",") {
		origin = strings.TrimSpace(origin)
		if !isURL(origin) {
			problems = append(problems, "CORS_ORIGINS must be a comma-separated list of URLs")
			break
		}
		c.CORSOrigins = append(c.CORSOrigins, origin)
	}
	if c.Deployed() {
		if len(c.DataEncryptionKey) < 32 {
			problems = append(problems, "DATA_ENCRYPTION_KEY requires at least 32 characters in deployed environments")
		}
		if len(c.MetricsToken) < 32 {
			problems = append(problems, "METRICS_TOKEN requires at least 32 characters in deployed environments")
		}
		if c.MediaStorageDriver != "s3" {
			problems = append(problems, "Deployed environments require S3 media storage")
		}
		for _, origin := range c.CORSOrigins {
			if !strings.HasPrefix(origin, "https://") {
				problems = append(problems, "Deployed browser origins require HTTPS")
				break
			}
		}
		if c.OwnerStoreUsername == "" {
			problems = append(problems, "OWNER_STORE_USERNAME is required: buyers may only see the owner store")
		}
		if !strings.HasPrefix(c.PublicWebURL, "https://") {
			problems = append(problems, "PUBLIC_WEB_URL requires HTTPS in deployed environments")
		}
	}
	if len(problems) > 0 {
		return c, fmt.Errorf("invalid environment: %s", strings.Join(problems, "; "))
	}
	return c, nil
}
