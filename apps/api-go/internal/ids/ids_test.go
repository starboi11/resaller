package ids

import (
	"regexp"
	"testing"
)

func TestFormats(t *testing.T) {
	if !regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(UUID()) {
		t.Fatal("uuid v4")
	}
	seen := map[string]bool{}
	for i := 0; i < 10000; i++ {
		id := CUID()
		if !regexp.MustCompile(`^c[0-9a-z]{24}$`).MatchString(id) || seen[id] {
			t.Fatalf("bad or duplicate cuid %q", id)
		}
		seen[id] = true
	}
}
