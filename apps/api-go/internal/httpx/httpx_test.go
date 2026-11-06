package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestTimeMatchesJavaScriptToJSON(t *testing.T) {
	at := time.Date(2026, 11, 3, 10, 4, 5, 890_123_000, time.FixedZone("UZT", 5*3600))
	raw, _ := json.Marshal(Time{at})
	if string(raw) != `"2026-11-03T05:04:05.890Z"` {
		t.Fatalf("got %s", raw)
	}
	raw, _ = json.Marshal(NullTime{})
	if string(raw) != "null" {
		t.Fatalf("got %s", raw)
	}
}

func TestOriginPolicy(t *testing.T) {
	allowed := []string{"https://resaller.uz"}
	cases := []struct {
		method, origin string
		want           bool
	}{
		{"GET", "", true}, {"head", "https://evil.example", true}, {"POST", "", false},
		{"POST", "https://evil.example", false}, {"DELETE", "https://resaller.uz", true},
	}
	for _, c := range cases {
		if OriginAllowed(c.method, c.origin, allowed) != c.want {
			t.Fatalf("%s %q", c.method, c.origin)
		}
	}
}

func TestUnplannedErrorsAreMasked(t *testing.T) {
	r := httptest.NewRequest("GET", "/x", nil)
	w := httptest.NewRecorder()
	WriteError(w, r, errors.New(`pq: relation "User" password=hunter2`))
	if w.Code != 500 || strings.Contains(w.Body.String(), "hunter2") || !strings.Contains(w.Body.String(), `"code":"INTERNAL_ERROR"`) {
		t.Fatalf("leaked: %d %s", w.Code, w.Body)
	}
	w = httptest.NewRecorder()
	WriteError(w, r, Conflict("Username is unavailable"))
	if w.Code != 409 || !strings.Contains(w.Body.String(), `"message":"Username is unavailable"`) {
		t.Fatalf("planned message lost: %s", w.Body)
	}
}

func TestValidationOrderMatchesClassValidator(t *testing.T) {
	var v Validation
	short := "ab"
	v.Field("username", &short, 3, 30, nil)
	v.Field("password", nil, 6, 128, &Pattern{Display: "/x/", Match: func(string) bool { return false }})
	got := v.Err().Error()
	want := "username must be longer than or equal to 3 characters; password must match /x/ regular expression; " +
		"password must be shorter than or equal to 128 characters; password must be longer than or equal to 6 characters; password must be a string"
	if got != want {
		t.Fatalf("\n got %s\nwant %s", got, want)
	}
}

func TestStrictDecodeRejectsUnknownProperties(t *testing.T) {
	r := httptest.NewRequest("POST", "/", strings.NewReader(`{"username":"a","role":"SUPER_ADMIN"}`))
	var into struct {
		Username string `json:"username"`
	}
	err := DecodeStrict(r, &into)
	var planned *Error
	if !errors.As(err, &planned) || planned.Message != "property role should not exist" {
		t.Fatalf("got %v", err)
	}
}

func TestRateLimitBlocksAfterMax(t *testing.T) {
	h := RateLimit(2, time.Minute, false, nil, nil)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	codes := []int{}
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
		codes = append(codes, w.Code)
	}
	if codes[0] != 200 || codes[1] != 200 || codes[2] != 429 {
		t.Fatalf("codes %v", codes)
	}
}

func TestClientIPHonoursTrustProxy(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.2:5000"
	// A client-supplied left-most value must be ignored; the proxy appends
	// the real address on the right.
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 203.0.113.9")
	if ClientIP(r, false) != "10.0.0.2" || ClientIP(r, true) != "203.0.113.9" {
		t.Fatal("client ip")
	}
	r.Header.Add("X-Forwarded-For", "198.51.100.7")
	if ClientIP(r, true) != "198.51.100.7" {
		t.Fatal("repeated header: the last value is the proxy's")
	}
}
