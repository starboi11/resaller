// Package httpx reproduces the HTTP conventions of the NestJS/Fastify API:
// error body {code,message,requestId}, millisecond UTC timestamps, Fastify
// request ids, strict JSON bodies and class-validator style messages.
package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

// Time marshals like JavaScript's Date#toJSON: UTC with exactly 3 fractional digits.
type Time struct{ time.Time }

func (t Time) MarshalJSON() ([]byte, error) {
	return []byte(`"` + t.UTC().Truncate(time.Millisecond).Format("2006-01-02T15:04:05.000Z") + `"`), nil
}

// NullTime marshals a nil value as JSON null.
type NullTime struct {
	Time  time.Time
	Valid bool
}

func (t NullTime) MarshalJSON() ([]byte, error) {
	if !t.Valid {
		return []byte("null"), nil
	}
	return Time{t.Time}.MarshalJSON()
}

// Error is a planned HTTP error whose message is safe to show to the caller
// (the equivalent of a thrown HttpException).
type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string { return e.Message }

func Errorf(status int, format string, args ...any) *Error {
	return &Error{Status: status, Message: fmt.Sprintf(format, args...)}
}

func BadRequest(message string) *Error   { return &Error{http.StatusBadRequest, message} }
func Unauthorized(message string) *Error { return &Error{http.StatusUnauthorized, message} }
func Forbidden(message string) *Error    { return &Error{http.StatusForbidden, message} }
func NotFound(message string) *Error     { return &Error{http.StatusNotFound, message} }
func Conflict(message string) *Error     { return &Error{http.StatusConflict, message} }

type ctxKey int

const requestIDKey ctxKey = 1

var nextRequestID atomic.Uint64

// RequestID assigns Fastify-style ids ("req-" + base36 counter).
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := "req-" + strconv.FormatUint(nextRequestID.Add(1), 36)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
	})
}

func RequestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}

func JSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

type errorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"requestId"`
}

// WriteError masks anything that is not a planned *Error, like HttpExceptionFilter.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	var planned *Error
	status, message := http.StatusInternalServerError, "Unexpected server error"
	if errors.As(err, &planned) {
		status, message = planned.Status, planned.Message
		if status == http.StatusInternalServerError {
			message = "Unexpected server error"
		}
	}
	code := "HTTP_" + strconv.Itoa(status)
	if status == http.StatusInternalServerError {
		code = "INTERNAL_ERROR"
		slog.ErrorContext(r.Context(), "request failed", "requestId", RequestIDFrom(r.Context()), "error", err.Error())
	}
	JSON(w, status, errorBody{Code: code, Message: message, RequestID: RequestIDFrom(r.Context())})
}

// Handler lets endpoints return (body, error); status defaults to 200, or 201
// for POST like NestJS, unless the handler is wrapped with Status.
type Handler func(w http.ResponseWriter, r *http.Request) (any, error)

type NoContent struct{}

func Handle(status int, h Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := h(w, r)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		if _, empty := body.(NoContent); empty {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		JSON(w, status, body)
	}
}

// DecodeStrict rejects unknown properties (forbidNonWhitelisted) with Nest's wording.
func DecodeStrict(r *http.Request, into any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(into); err != nil {
		if strings.HasPrefix(err.Error(), "json: unknown field ") {
			field := strings.Trim(strings.TrimPrefix(err.Error(), "json: unknown field "), `"`)
			return BadRequest(fmt.Sprintf("property %s should not exist", field))
		}
		if errors.Is(err, io.EOF) {
			return BadRequest("Body cannot be empty when content-type is set to 'application/json'")
		}
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) {
			return BadRequest(typeErr.Field + " must be a string")
		}
		return BadRequest("Body is not valid JSON")
	}
	return nil
}

// DecodeBody decodes a JSON object and, like ValidationPipe with
// forbidNonWhitelisted, reports every unknown property ("property x should not
// exist", in body order) inside the returned Validation, so the field checks
// that follow are reported in the same message, exactly as Nest does.
func DecodeBody(r *http.Request, into any) (*Validation, error) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return nil, BadRequest("Body is not valid JSON")
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return nil, BadRequest("Body cannot be empty when content-type is set to 'application/json'")
	}
	known := map[string]bool{}
	t := reflect.TypeOf(into).Elem()
	for i := 0; i < t.NumField(); i++ {
		name, _, _ := strings.Cut(t.Field(i).Tag.Get("json"), ",")
		known[name] = true
	}
	v := &Validation{}
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return nil, BadRequest("Body is not valid JSON")
	}
	for decoder.More() {
		key, err := decoder.Token()
		if err != nil {
			return nil, BadRequest("Body is not valid JSON")
		}
		var skip json.RawMessage
		if err := decoder.Decode(&skip); err != nil {
			return nil, BadRequest("Body is not valid JSON")
		}
		if name, _ := key.(string); !known[name] {
			v.Add("property %s should not exist", name)
		}
	}
	if err := json.Unmarshal(raw, into); err != nil {
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) {
			return nil, BadRequest(typeErr.Field + " must be a string")
		}
		return nil, BadRequest("Body is not valid JSON")
	}
	return v, nil
}

// Validation collects class-validator style messages, joined with "; ".
type Validation struct{ messages []string }

func (v *Validation) Add(format string, args ...any) {
	v.messages = append(v.messages, fmt.Sprintf(format, args...))
}

// Field validates a string property declared as
// @IsString() @MinLength(min) @MaxLength(max) @Matches(pattern). class-validator
// reports failed constraints in reverse declaration order; a missing value
// fails every constraint. min, max <= 0 and a nil pattern mean "not declared".
type Pattern struct {
	Display string
	Match   func(string) bool
	// Message replaces the default text, like @Matches(re, { message }).
	Message string
}

func (p *Pattern) text(field string) string {
	if p.Message != "" {
		return p.Message
	}
	return fmt.Sprintf("%s must match %s regular expression", field, p.Display)
}

func (v *Validation) Field(field string, value *string, min, max int, pattern *Pattern) {
	v.FieldWithMinMessage(field, value, min, max, "", pattern)
}

// FieldWithMinMessage is Field with a custom @MinLength message.
func (v *Validation) FieldWithMinMessage(field string, value *string, min, max int, minMessage string, pattern *Pattern) {
	minText := minMessage
	if minText == "" {
		minText = fmt.Sprintf("%s must be longer than or equal to %d characters", field, min)
	}
	if value == nil {
		if pattern != nil {
			v.Add("%s", pattern.text(field))
		}
		if max > 0 {
			v.Add("%s must be shorter than or equal to %d characters", field, max)
		}
		if min > 0 {
			v.Add("%s", minText)
		}
		v.Add("%s must be a string", field)
		return
	}
	length := len([]rune(*value))
	if pattern != nil && !pattern.Match(*value) {
		v.Add("%s", pattern.text(field))
	}
	if max > 0 && length > max {
		v.Add("%s must be shorter than or equal to %d characters", field, max)
	}
	if min > 0 && length < min {
		v.Add("%s", minText)
	}
}

func (v *Validation) Err() error {
	if len(v.messages) == 0 {
		return nil
	}
	return BadRequest(strings.Join(v.messages, "; "))
}
