package config

import (
	"strings"
	"testing"
)

func set(t *testing.T, values map[string]string) {
	for key, value := range values {
		t.Setenv(key, value)
	}
}

func base(t *testing.T) {
	set(t, map[string]string{
		"NODE_ENV": "development", "DATABASE_URL": "postgresql://x", "REDIS_URL": "redis://localhost:6379",
		"SESSION_SECRET": strings.Repeat("s", 32), "CORS_ORIGINS": "http://localhost:3000, http://localhost:3001",
	})
}

func TestDevelopmentDefaults(t *testing.T) {
	base(t)
	c, err := Load()
	if err != nil || c.Port != 4000 || len(c.CORSOrigins) != 2 || c.EncryptionSecret() != strings.Repeat("s", 32) {
		t.Fatalf("%+v %v", c, err)
	}
}

func TestProductionRequiresHardening(t *testing.T) {
	base(t)
	set(t, map[string]string{"NODE_ENV": "production"})
	_, err := Load()
	for _, want := range []string{"DATA_ENCRYPTION_KEY", "METRICS_TOKEN", "S3 media storage", "HTTPS"} {
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("missing %q in %v", want, err)
		}
	}
}

func TestShortSessionSecretRejected(t *testing.T) {
	base(t)
	set(t, map[string]string{"SESSION_SECRET": "short"})
	if _, err := Load(); err == nil {
		t.Fatal("short secret accepted")
	}
}
