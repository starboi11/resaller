package auth

import (
	"context"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/resaller/api-go/internal/httpx"
)

type ctxKey int

const userKey ctxKey = 1

// CurrentUser is set by RequireUser.
func CurrentUser(ctx context.Context) *User {
	user, _ := ctx.Value(userKey).(*User)
	return user
}

type Handlers struct {
	svc        *Service
	production bool
	trustProxy bool
}

func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc, production: svc.cfg.Production(), trustProxy: svc.cfg.TrustProxy}
}

// CookieName follows SESSION_COOKIE_NAME: __Host- in production, plain locally.
func (h *Handlers) CookieName() string {
	if h.production {
		return "__Host-resaller_session"
	}
	return "resaller_session"
}

func (h *Handlers) token(r *http.Request) string {
	cookie, err := r.Cookie(h.CookieName())
	if err != nil {
		return ""
	}
	return cookie.Value
}

func (h *Handlers) setSession(w http.ResponseWriter, session Session) {
	http.SetCookie(w, &http.Cookie{Name: h.CookieName(), Value: session.Token, Path: "/", Expires: session.ExpiresAt,
		HttpOnly: true, Secure: h.production, SameSite: http.SameSiteLaxMode})
}

func (h *Handlers) clearSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: h.CookieName(), Value: "", Path: "/", Expires: time.Unix(0, 0), MaxAge: -1,
		HttpOnly: true, Secure: h.production, SameSite: http.SameSiteLaxMode})
}

func (h *Handlers) client(r *http.Request) ClientContext {
	return ClientContext{IP: httpx.ClientIP(r, h.trustProxy), UserAgent: r.Header.Get("User-Agent")}
}

// RequireUser is SessionGuard.
func (h *Handlers) RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, err := h.svc.ResolveSession(r.Context(), h.token(r))
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if user == nil {
			httpx.WriteError(w, r, errAuthRequired)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey, user)))
	})
}

// RequireRoles is RolesGuard: SUPER_ADMIN passes every role check.
func RequireRoles(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := CurrentUser(r.Context())
			allowed := false
			if user != nil {
				for _, role := range user.Roles {
					if role == "SUPER_ADMIN" || slices.Contains(roles, role) {
						allowed = true
					}
				}
			}
			if !allowed {
				httpx.WriteError(w, r, httpx.Forbidden("Forbidden resource"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

var (
	usernamePattern = regexp.MustCompile(`^[a-z0-9_]+$`)
	digitsPattern   = regexp.MustCompile(`^\d{6}$`)
	usernameRule    = &httpx.Pattern{Display: "/^[a-z0-9_]+$/", Match: usernamePattern.MatchString}
	// Customer passwords: 6+ characters, digits alone allowed (2026-11-04).
	passwordMinMessage = "Parol kamida 6 belgidan iborat bo‘lsin"
	fullNameRule       = &httpx.Pattern{Message: "Ismda raqam yoki maxsus belgilar bo‘lmasin", Match: regexp.MustCompile(`^[^\d<>{}]+$`).MatchString}
	phoneRule          = &httpx.Pattern{Message: "Telefon raqami +998 XX XXX XX XX ko‘rinishida bo‘lsin", Match: regexp.MustCompile(`^\+998\d{9}$`).MatchString}
	spaces             = regexp.MustCompile(`\s+`)
	phoneNoise         = regexp.MustCompile(`[\s()-]`)
	uzFull             = regexp.MustCompile(`^998\d{9}$`)
	uzLocal            = regexp.MustCompile(`^\d{9}$`)
	codeRule           = &httpx.Pattern{Display: "/^\\d{6}$/", Match: digitsPattern.MatchString}
	lower              = regexp.MustCompile(`[a-z]`)
	upper              = regexp.MustCompile(`[A-Z]`)
	digit              = regexp.MustCompile(`\d`)
)

// strongPassword is /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/ (Go regexp has no lookahead).
func strongPassword(value string) bool {
	return value != "" && lower.MatchString(value) && upper.MatchString(value) && digit.MatchString(value)
}

func normalizeUsername(value *string) {
	if value != nil {
		normalized := strings.ToLower(strings.TrimSpace(*value))
		*value = normalized
	}
}

type credentials struct {
	Username *string `json:"username"`
	Password *string `json:"password"`
}

type registration struct {
	FullName *string `json:"fullName"`
	Phone    *string `json:"phone"`
	Username *string `json:"username"`
	Password *string `json:"password"`
}

// normalizeUzPhone is normalizeUzPhone in auth.dto.ts.
func normalizeUzPhone(value *string) {
	if value == nil {
		return
	}
	digits := strings.TrimPrefix(phoneNoise.ReplaceAllString(*value, ""), "+")
	switch {
	case uzFull.MatchString(digits):
		*value = "+" + digits
	case uzLocal.MatchString(digits):
		*value = "+998" + digits
	default:
		*value = strings.TrimSpace(*value)
	}
}

func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) (any, error) {
	var input registration
	v, err := httpx.DecodeBody(r, &input)
	if err != nil {
		return nil, err
	}
	if input.FullName != nil {
		collapsed := spaces.ReplaceAllString(strings.TrimSpace(*input.FullName), " ")
		input.FullName = &collapsed
	}
	normalizeUzPhone(input.Phone)
	normalizeUsername(input.Username)
	v.Field("fullName", input.FullName, 2, 80, fullNameRule)
	v.Field("phone", input.Phone, 0, 0, phoneRule)
	v.Field("username", input.Username, 3, 30, usernameRule)
	v.FieldWithMinMessage("password", input.Password, 6, 128, passwordMinMessage, nil)
	if err := v.Err(); err != nil {
		return nil, err
	}
	user, session, err := h.svc.Register(r.Context(), *input.Username, *input.Password, h.client(r), Profile{FullName: *input.FullName, Phone: *input.Phone})
	if err != nil {
		return nil, err
	}
	h.setSession(w, session)
	return map[string]any{"user": user}, nil
}

func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) (any, error) {
	var input credentials
	v, err := httpx.DecodeBody(r, &input)
	if err != nil {
		return nil, err
	}
	normalizeUsername(input.Username)
	v.Field("username", input.Username, 0, 30, nil)
	v.Field("password", input.Password, 0, 128, nil)
	if err := v.Err(); err != nil {
		return nil, err
	}
	result, err := h.svc.Login(r.Context(), *input.Username, *input.Password, h.client(r))
	if err != nil {
		return nil, err
	}
	if result.TwoFactor != nil {
		return struct {
			User      PublicUser `json:"user"`
			TwoFactor *TwoFactor `json:"twoFactor"`
		}{result.User, result.TwoFactor}, nil
	}
	h.setSession(w, *result.Session)
	return map[string]any{"user": result.User}, nil
}

func (h *Handlers) VerifyTwoFactor(w http.ResponseWriter, r *http.Request) (any, error) {
	var input struct {
		ChallengeToken *string `json:"challengeToken"`
		Code           *string `json:"code"`
	}
	v, err := httpx.DecodeBody(r, &input)
	if err != nil {
		return nil, err
	}
	v.Field("challengeToken", input.ChallengeToken, 32, 200, nil)
	v.Field("code", input.Code, 0, 0, codeRule)
	if err := v.Err(); err != nil {
		return nil, err
	}
	user, session, err := h.svc.VerifyTwoFactor(r.Context(), *input.ChallengeToken, *input.Code, h.client(r))
	if err != nil {
		return nil, err
	}
	h.setSession(w, session)
	return map[string]any{"user": user}, nil
}

func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) (any, error) {
	if err := h.svc.Logout(r.Context(), h.token(r)); err != nil {
		return nil, err
	}
	h.clearSession(w)
	return httpx.NoContent{}, nil
}

func (h *Handlers) RequestPasswordReset(w http.ResponseWriter, r *http.Request) (any, error) {
	var input struct {
		Username *string `json:"username"`
	}
	v, err := httpx.DecodeBody(r, &input)
	if err != nil {
		return nil, err
	}
	normalizeUsername(input.Username)
	v.Field("username", input.Username, 3, 32, nil)
	if err := v.Err(); err != nil {
		return nil, err
	}
	if err := h.svc.RequestPasswordReset(r.Context(), *input.Username, h.client(r)); err != nil {
		return nil, err
	}
	// Identical answer for unknown users and unavailable recovery channels.
	return map[string]bool{"accepted": true}, nil
}

func (h *Handlers) ResetPassword(w http.ResponseWriter, r *http.Request) (any, error) {
	var input struct {
		Token       *string `json:"token"`
		NewPassword *string `json:"newPassword"`
	}
	v, err := httpx.DecodeBody(r, &input)
	if err != nil {
		return nil, err
	}
	v.Field("token", input.Token, 32, 200, nil)
	v.FieldWithMinMessage("newPassword", input.NewPassword, 6, 128, passwordMinMessage, nil)
	if err := v.Err(); err != nil {
		return nil, err
	}
	if err := h.svc.ResetPassword(r.Context(), *input.Token, *input.NewPassword); err != nil {
		return nil, err
	}
	return map[string]bool{"reset": true}, nil
}

func (h *Handlers) Rotate(w http.ResponseWriter, r *http.Request) (any, error) {
	session, err := h.svc.RotateSession(r.Context(), h.token(r))
	if err != nil {
		return nil, err
	}
	h.setSession(w, session)
	return struct {
		Rotated   bool       `json:"rotated"`
		ExpiresAt httpx.Time `json:"expiresAt"`
	}{true, httpx.Time{Time: session.ExpiresAt}}, nil
}

func (h *Handlers) Profile(w http.ResponseWriter, r *http.Request) (any, error) {
	return h.svc.Profile(r.Context(), CurrentUser(r.Context()).ID)
}

func (h *Handlers) ChangePassword(w http.ResponseWriter, r *http.Request) (any, error) {
	var input struct {
		CurrentPassword *string `json:"currentPassword"`
		NewPassword     *string `json:"newPassword"`
	}
	v, err := httpx.DecodeBody(r, &input)
	if err != nil {
		return nil, err
	}
	v.Field("currentPassword", input.CurrentPassword, 0, 128, nil)
	v.FieldWithMinMessage("newPassword", input.NewPassword, 6, 128, passwordMinMessage, nil)
	if err := v.Err(); err != nil {
		return nil, err
	}
	if err := h.svc.ChangePassword(r.Context(), CurrentUser(r.Context()).ID, h.token(r), *input.CurrentPassword, *input.NewPassword); err != nil {
		return nil, err
	}
	return map[string]bool{"changed": true}, nil
}

func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) (any, error) {
	return map[string]any{"user": CurrentUser(r.Context())}, nil
}

func (h *Handlers) Sessions(w http.ResponseWriter, r *http.Request) (any, error) {
	return h.svc.Sessions(r.Context(), CurrentUser(r.Context()).ID, h.token(r))
}

func (h *Handlers) RevokeSession(w http.ResponseWriter, r *http.Request) (any, error) {
	if err := h.svc.RevokeSession(r.Context(), CurrentUser(r.Context()).ID, chi.URLParam(r, "id")); err != nil {
		return nil, err
	}
	return map[string]bool{"revoked": true}, nil
}

func (h *Handlers) RevokeOthers(w http.ResponseWriter, r *http.Request) (any, error) {
	count, err := h.svc.RevokeOtherSessions(r.Context(), CurrentUser(r.Context()).ID, h.token(r))
	if err != nil {
		return nil, err
	}
	return map[string]int64{"revoked": count}, nil
}

// Routes mounts /auth with the status codes the Nest controller declares.
func (h *Handlers) Routes(r chi.Router) {
	r.Post("/register", httpx.Handle(http.StatusCreated, h.Register))
	r.Post("/login", httpx.Handle(http.StatusOK, h.Login))
	r.Post("/2fa/verify", httpx.Handle(http.StatusOK, h.VerifyTwoFactor))
	r.Post("/logout", httpx.Handle(http.StatusNoContent, h.Logout))
	r.Post("/password/request-reset", httpx.Handle(http.StatusAccepted, h.RequestPasswordReset))
	r.Post("/password/reset", httpx.Handle(http.StatusCreated, h.ResetPassword))
	r.Group(func(r chi.Router) {
		r.Use(h.RequireUser)
		r.Post("/session/rotate", httpx.Handle(http.StatusCreated, h.Rotate))
		r.Get("/profile", httpx.Handle(http.StatusOK, h.Profile))
		r.Post("/password/change", httpx.Handle(http.StatusOK, h.ChangePassword))
		r.Get("/me", httpx.Handle(http.StatusOK, h.Me))
		r.Get("/sessions", httpx.Handle(http.StatusOK, h.Sessions))
		r.Delete("/sessions/{id}", httpx.Handle(http.StatusOK, h.RevokeSession))
		r.Post("/sessions/revoke-others", httpx.Handle(http.StatusCreated, h.RevokeOthers))
	})
}
