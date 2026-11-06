// Package auth ports apps/api/src/auth: accounts, cookie sessions, admin TOTP
// two-factor, password recovery and session management. It reads and writes
// the same tables with the same encodings, so a session issued by either
// backend is valid on the other.
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/resaller/api-go/internal/config"
	"github.com/resaller/api-go/internal/httpx"
	"github.com/resaller/api-go/internal/ids"
	"github.com/resaller/api-go/internal/platform"
	"github.com/resaller/api-go/internal/secure"
)

// Abuse limits shared with the Node API (same Redis keys and windows).
const (
	loginPerAccount    = 30  // attempts per account, from any address
	loginAccountWindow = 900 // seconds
	registerPerIP      = 10
	registerWindow     = 3600
	resetPerAccount    = 3
	resetPerIP         = 10
	resetWindow        = 900
)

// Admin policy (owner decision 2026-11-04), identical to the Node API.
const (
	adminSessionLifetime = 12 * time.Hour
	adminLoginPerAccount = 5
	adminLoginWindow     = 900
)

// AdminTwoFactorRequired follows ADMIN_TWO_FACTOR_REQUIRED (default true).
func AdminTwoFactorRequired() bool { return os.Getenv("ADMIN_TWO_FACTOR_REQUIRED") != "false" }

// StrongAdminPassword: at least 16 characters with upper, lower and digits.
func StrongAdminPassword(value string) bool {
	return len(value) >= 16 && lower.MatchString(value) && upper.MatchString(value) && digit.MatchString(value)
}

const (
	sessionLifetime   = 30 * 24 * time.Hour
	twoFactorLifetime = 5 * time.Minute
	resetLifetime     = 15 * time.Minute
)

var privilegedRoles = []string{"MODERATOR", "VERIFICATION_ADMIN", "DISPUTE_ADMIN", "SUPPORT_ADMIN", "SECURITY_ADMIN", "SUPER_ADMIN"}

func privileged(roles []string) bool {
	for _, role := range roles {
		if slices.Contains(privilegedRoles, role) {
			return true
		}
	}
	return false
}

// PublicUser is the account shape returned to clients (publicUser in Node).
type PublicUser struct {
	PublicID  string     `json:"publicId"`
	Username  string     `json:"username"`
	Roles     []string   `json:"roles"`
	CreatedAt httpx.Time `json:"createdAt"`
}

// User is the authenticated user attached to a request (AuthenticatedUser).
type User struct {
	ID string `json:"id"`
	PublicUser
}

type Service struct {
	dummyHash string
	db        *pgxpool.Pool
	redis     *platform.Redis
	cfg       config.Config
	crypto    *secure.Crypto
	totp      *secure.TOTP
	client    *http.Client
}

func NewService(db *pgxpool.Pool, redis *platform.Redis, cfg config.Config) *Service {
	// A real scrypt hash of a random password: missing and inactive accounts
	// are verified against it so they cost the same time as a wrong password.
	dummy, _ := secure.HashPassword(ids.UUID())
	return &Service{
		dummyHash: dummy,
		db:        db, redis: redis, cfg: cfg,
		crypto: secure.NewCrypto(cfg.EncryptionSecret(), cfg.DataEncryptionKeyPrev),
		totp:   secure.NewTOTP(cfg.EncryptionSecret()),
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

type ClientContext struct {
	IP        string
	UserAgent string
}

func (s *Service) ipHash(ip string) *string {
	if ip == "" {
		return nil
	}
	hash := secure.HMACBase64(s.cfg.SessionSecret, ip)
	return &hash
}

func safeUserAgent(value string) *string {
	if value == "" {
		return nil
	}
	runes := []rune(value)
	if len(runes) > 300 {
		value = string(runes[:300])
	}
	return &value
}

func (s *Service) securityEvent(ctx context.Context, q querier, userID *string, kind, severity string, ipHash *string, metadata any) error {
	var meta []byte
	if metadata != nil {
		meta, _ = json.Marshal(metadata)
	}
	_, err := q.Exec(ctx, `INSERT INTO "SecurityEvent" (id, "userId", type, severity, "ipHash", metadata) VALUES ($1,$2,$3,$4,$5,$6)`,
		ids.UUID(), userID, kind, severity, ipHash, meta)
	return err
}

type querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type account struct {
	ID, PublicID, Username, PasswordHash, AccountStatus string
	Roles                                               []string
	CreatedAt                                           time.Time
	DeletedAt, TotpEnabledAt                            *time.Time
	TotpSecretEncrypted                                 *string
}

const accountColumns = `u.id, u."publicId", u.username, u."passwordHash", u."accountStatus", u.roles::text[], u."createdAt", u."deletedAt", u."totpEnabledAt", u."totpSecretEncrypted"`

func scanAccount(row pgx.Row) (*account, error) {
	var a account
	err := row.Scan(&a.ID, &a.PublicID, &a.Username, &a.PasswordHash, &a.AccountStatus, &a.Roles, &a.CreatedAt, &a.DeletedAt, &a.TotpEnabledAt, &a.TotpSecretEncrypted)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &a, err
}

func (a *account) public() PublicUser {
	roles := a.Roles
	if roles == nil {
		roles = []string{}
	}
	return PublicUser{PublicID: a.PublicID, Username: a.Username, Roles: roles, CreatedAt: httpx.Time{Time: a.CreatedAt}}
}

type Session struct {
	Token     string
	ExpiresAt time.Time
}

// sessionExpiry: admin sessions last 12 hours, everyone else's 30 days.
func (s *Service) sessionExpiry(ctx context.Context, userID string) (time.Time, error) {
	var roles []string
	if err := s.db.QueryRow(ctx, `SELECT roles::text[] FROM "User" WHERE id = $1`, userID).Scan(&roles); err != nil {
		return time.Time{}, err
	}
	if privileged(roles) {
		return time.Now().Add(adminSessionLifetime).Truncate(time.Millisecond), nil
	}
	return time.Now().Add(sessionLifetime).Truncate(time.Millisecond), nil
}

func (s *Service) createSession(ctx context.Context, userID string, client ClientContext, twoFactorVerifiedAt *time.Time) (Session, error) {
	token, tokenHash, err := secure.IssueToken()
	if err != nil {
		return Session{}, err
	}
	expiresAt, err := s.sessionExpiry(ctx, userID)
	if err != nil {
		return Session{}, err
	}
	var seller bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM "SellerProfile" WHERE "userId" = $1)`, userID).Scan(&seller); err != nil {
		return Session{}, err
	}
	var ipEncrypted *string
	if seller && client.IP != "" {
		encrypted, err := s.crypto.Encrypt(client.IP)
		if err != nil {
			return Session{}, err
		}
		ipEncrypted = &encrypted
	}
	_, err = s.db.Exec(ctx, `INSERT INTO "Session" (id, "tokenHash", "userId", "expiresAt", "ipHash", "ipEncrypted", "userAgent", "twoFactorVerifiedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		ids.UUID(), tokenHash, userID, expiresAt, s.ipHash(client.IP), ipEncrypted, safeUserAgent(client.UserAgent), twoFactorVerifiedAt)
	return Session{Token: token, ExpiresAt: expiresAt}, err
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

type Profile struct {
	FullName string
	Phone    string
}

func (s *Service) phoneHash(phone string) string {
	return secure.HMACBase64(s.cfg.SessionSecret, "phone\x00"+phone)
}

var errPhoneTaken = httpx.Conflict("Bu telefon raqami bilan hisob allaqachon bor")

func (s *Service) Register(ctx context.Context, username, password string, client ClientContext, profile Profile) (PublicUser, Session, error) {
	ip := client.IP
	if ip == "" {
		ip = "unknown"
	}
	allowed, err := s.redis.FixedWindowLimit(ctx, "register:"+secure.HMACBase64(s.cfg.SessionSecret, ip), registerPerIP, registerWindow)
	if err != nil {
		return PublicUser{}, Session{}, err
	}
	if !allowed {
		return PublicUser{}, Session{}, httpx.Errorf(http.StatusTooManyRequests, "Too many accounts created from this network; try again later")
	}
	hash, err := secure.HashPassword(password)
	if err != nil {
		return PublicUser{}, Session{}, err
	}
	phoneHash := s.phoneHash(profile.Phone)
	var taken bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM "User" WHERE "phoneHash" = $1)`, phoneHash).Scan(&taken); err != nil {
		return PublicUser{}, Session{}, err
	}
	if taken {
		return PublicUser{}, Session{}, errPhoneTaken
	}
	phoneEncrypted, err := s.crypto.Encrypt(profile.Phone)
	if err != nil {
		return PublicUser{}, Session{}, err
	}
	row := s.db.QueryRow(ctx, `INSERT INTO "User" AS u (id, "publicId", username, "passwordHash", "fullName", "phoneEncrypted", "phoneHash", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING `+accountColumns, ids.UUID(), ids.CUID(), username, hash, profile.FullName, phoneEncrypted, phoneHash)
	created, err := scanAccount(row)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "phoneHash") {
		return PublicUser{}, Session{}, errPhoneTaken
	}
	if isUniqueViolation(err) {
		return PublicUser{}, Session{}, httpx.Conflict("Username is unavailable")
	}
	if err != nil {
		return PublicUser{}, Session{}, err
	}
	session, err := s.createSession(ctx, created.ID, client, nil)
	return created.public(), session, err
}

// TwoFactor is the challenge returned instead of a session to privileged users.
type TwoFactor struct {
	Required        bool       `json:"required"`
	Mode            string     `json:"mode"`
	ChallengeToken  string     `json:"challengeToken"`
	ExpiresAt       httpx.Time `json:"expiresAt"`
	Secret          string     `json:"secret,omitempty"`
	ProvisioningURI string     `json:"provisioningUri,omitempty"`
}

type LoginResult struct {
	User      PublicUser
	Session   *Session
	TwoFactor *TwoFactor
}

var errInvalidLogin = httpx.Unauthorized("Invalid username or password")

func (s *Service) Login(ctx context.Context, username, password string, client ClientContext) (LoginResult, error) {
	ip := client.IP
	if ip == "" {
		ip = "unknown"
	}
	attemptKey := secure.HMACBase64(s.cfg.SessionSecret, username+"\x00"+ip)
	allowed, err := s.redis.FixedWindowLimit(ctx, "login:"+attemptKey, 10, 300)
	if err != nil {
		return LoginResult{}, err
	}
	// The per-account window does not depend on the network address, so
	// rotating addresses cannot buy more guesses against one account.
	accountAllowed, err := s.redis.FixedWindowLimit(ctx, "login-account:"+secure.HMACBase64(s.cfg.SessionSecret, username), loginPerAccount, loginAccountWindow)
	if err != nil {
		return LoginResult{}, err
	}
	if !allowed || !accountAllowed {
		if err := s.securityEvent(ctx, s.db, nil, "LOGIN_RATE_LIMITED", "WARNING", s.ipHash(client.IP), map[string]string{"attemptedUsername": username}); err != nil {
			return LoginResult{}, err
		}
		return LoginResult{}, errInvalidLogin
	}
	user, err := scanAccount(s.db.QueryRow(ctx, `SELECT `+accountColumns+` FROM "User" u WHERE username = $1`, username))
	if err != nil {
		return LoginResult{}, err
	}
	usable := user != nil && user.DeletedAt == nil && user.AccountStatus == "ACTIVE"
	isAdmin := usable && privileged(user.Roles)
	// Admin accounts get their own, tighter window on top of the account one.
	if isAdmin {
		ok, err := s.redis.FixedWindowLimit(ctx, "admin-login:"+secure.HMACBase64(s.cfg.SessionSecret, username), adminLoginPerAccount, adminLoginWindow)
		if err != nil {
			return LoginResult{}, err
		}
		if !ok {
			if err := s.securityEvent(ctx, s.db, &user.ID, "ADMIN_LOGIN_RATE_LIMITED", "CRITICAL", s.ipHash(client.IP), nil); err != nil {
				return LoginResult{}, err
			}
			return LoginResult{}, errInvalidLogin
		}
	}
	stored := s.dummyHash
	if usable {
		stored = user.PasswordHash
	}
	// Always run exactly one scrypt verification, so response time does not
	// reveal whether the username exists.
	passwordOK := secure.VerifyPassword(password, stored)
	if !usable || !passwordOK {
		var userID *string
		if user != nil {
			userID = &user.ID
		}
		if err := s.securityEvent(ctx, s.db, userID, "LOGIN_FAILED", "WARNING", s.ipHash(client.IP), map[string]string{"attemptedUsername": username}); err != nil {
			return LoginResult{}, err
		}
		return LoginResult{}, errInvalidLogin
	}
	if ipHash := s.ipHash(client.IP); ipHash != nil {
		var known bool
		if err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM "Session" WHERE "userId" = $1 AND "ipHash" = $2 AND "revokedAt" IS NULL)`, user.ID, *ipHash).Scan(&known); err != nil {
			return LoginResult{}, err
		}
		if !known {
			err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
				if err := s.securityEvent(ctx, tx, &user.ID, "NEW_LOGIN_CONTEXT", "INFO", ipHash, map[string]any{"userAgent": safeUserAgent(client.UserAgent)}); err != nil {
					return err
				}
				payload, _ := json.Marshal(map[string]any{"event": "NEW_LOGIN_CONTEXT", "userAgent": safeUserAgent(client.UserAgent), "occurredAt": httpx.Time{Time: time.Now()}})
				_, err := tx.Exec(ctx, `INSERT INTO "Notification" (id, "userId", severity, type, payload) VALUES ($1,$2,'WARNING','SECURITY_ALERT',$3)`, ids.UUID(), user.ID, payload)
				return err
			})
			if err != nil {
				return LoginResult{}, err
			}
		}
	}
	if isAdmin && AdminTwoFactorRequired() {
		challenge, err := s.issueTwoFactorChallenge(ctx, user, client)
		return LoginResult{User: user.public(), TwoFactor: challenge}, err
	}
	if isAdmin {
		meta := map[string]any{"userAgent": safeUserAgent(client.UserAgent), "twoFactor": false}
		if err := s.securityEvent(ctx, s.db, &user.ID, "ADMIN_LOGIN", "WARNING", s.ipHash(client.IP), meta); err != nil {
			return LoginResult{}, err
		}
	}
	session, err := s.createSession(ctx, user.ID, client, nil)
	return LoginResult{User: user.public(), Session: &session}, err
}

func (s *Service) issueTwoFactorChallenge(ctx context.Context, user *account, client ClientContext) (*TwoFactor, error) {
	token, tokenHash, err := secure.IssueToken()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(twoFactorLifetime).Truncate(time.Millisecond)
	enrolling := user.TotpSecretEncrypted == nil
	var secret string
	var secretEncrypted *string
	if enrolling {
		if secret, err = secure.GenerateTOTPSecret(); err != nil {
			return nil, err
		}
		encrypted, err := s.totp.Encrypt(secret)
		if err != nil {
			return nil, err
		}
		secretEncrypted = &encrypted
	}
	purpose, mode := "LOGIN", "VERIFY"
	if enrolling {
		purpose, mode = "ENROLL", "ENROLL"
	}
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE "TwoFactorChallenge" SET "usedAt" = now() WHERE "userId" = $1 AND "usedAt" IS NULL`, user.ID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO "TwoFactorChallenge" (id, "userId", "tokenHash", purpose, "secretEncrypted", "expiresAt", "ipHash", "userAgent")
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, ids.UUID(), user.ID, tokenHash, purpose, secretEncrypted, expiresAt, s.ipHash(client.IP), safeUserAgent(client.UserAgent))
		return err
	})
	if err != nil {
		return nil, err
	}
	result := &TwoFactor{Required: true, Mode: mode, ChallengeToken: token, ExpiresAt: httpx.Time{Time: expiresAt}}
	if enrolling {
		result.Secret = secret
		result.ProvisioningURI = secure.ProvisioningURI(user.Username, secret)
	}
	return result, nil
}

var errChallenge = httpx.Unauthorized("Two-factor challenge is invalid or expired")
var errCode = httpx.Unauthorized("Invalid authentication code")

func (s *Service) VerifyTwoFactor(ctx context.Context, challengeToken, code string, client ClientContext) (PublicUser, Session, error) {
	var challengeID, userID, purpose string
	var secretEncrypted *string
	var usedAt *time.Time
	var expiresAt time.Time
	row := s.db.QueryRow(ctx, `SELECT c.id, c."userId", c.purpose, c."secretEncrypted", c."usedAt", c."expiresAt" FROM "TwoFactorChallenge" c WHERE c."tokenHash" = $1`, secure.HashToken(challengeToken))
	err := row.Scan(&challengeID, &userID, &purpose, &secretEncrypted, &usedAt, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return PublicUser{}, Session{}, errChallenge
	}
	if err != nil {
		return PublicUser{}, Session{}, err
	}
	user, err := scanAccount(s.db.QueryRow(ctx, `SELECT `+accountColumns+` FROM "User" u WHERE id = $1`, userID))
	if err != nil {
		return PublicUser{}, Session{}, err
	}
	now := time.Now()
	if user == nil || usedAt != nil || !expiresAt.After(now) || user.DeletedAt != nil || user.AccountStatus != "ACTIVE" {
		return PublicUser{}, Session{}, errChallenge
	}
	encrypted := user.TotpSecretEncrypted
	if purpose == "ENROLL" {
		encrypted = secretEncrypted
	}
	allowed, err := s.redis.FixedWindowLimit(ctx, "two-factor:"+userID, 5, int(twoFactorLifetime.Seconds()))
	if err != nil {
		return PublicUser{}, Session{}, err
	}
	if !allowed {
		if err := s.securityEvent(ctx, s.db, &userID, "TWO_FACTOR_RATE_LIMITED", "WARNING", s.ipHash(client.IP), nil); err != nil {
			return PublicUser{}, Session{}, err
		}
		return PublicUser{}, Session{}, errCode
	}
	valid := false
	if encrypted != nil {
		if secret, err := s.totp.Decrypt(*encrypted); err == nil {
			valid = secure.VerifyTOTP(secret, code, now.UnixMilli())
		}
	}
	if !valid {
		if err := s.securityEvent(ctx, s.db, &userID, "TWO_FACTOR_FAILED", "WARNING", s.ipHash(client.IP), nil); err != nil {
			return PublicUser{}, Session{}, err
		}
		return PublicUser{}, Session{}, errCode
	}
	tag, err := s.db.Exec(ctx, `UPDATE "TwoFactorChallenge" SET "usedAt" = $2 WHERE id = $1 AND "usedAt" IS NULL AND "expiresAt" > $2`, challengeID, now)
	if err != nil {
		return PublicUser{}, Session{}, err
	}
	if tag.RowsAffected() != 1 {
		return PublicUser{}, Session{}, errChallenge
	}
	event := "TWO_FACTOR_VERIFIED"
	if purpose == "ENROLL" && encrypted != nil {
		event = "TWO_FACTOR_ENABLED"
		if _, err := s.db.Exec(ctx, `UPDATE "User" SET "totpSecretEncrypted" = $2, "totpEnabledAt" = $3, "updatedAt" = now() WHERE id = $1`, userID, *encrypted, now); err != nil {
			return PublicUser{}, Session{}, err
		}
		if _, err := s.db.Exec(ctx, `UPDATE "Session" SET "revokedAt" = $2 WHERE "userId" = $1 AND "revokedAt" IS NULL`, userID, now); err != nil {
			return PublicUser{}, Session{}, err
		}
	} else if purpose == "ENROLL" {
		event = "TWO_FACTOR_VERIFIED"
	}
	if err := s.securityEvent(ctx, s.db, &userID, event, "INFO", s.ipHash(client.IP), nil); err != nil {
		return PublicUser{}, Session{}, err
	}
	verifiedAt := now.Truncate(time.Millisecond)
	session, err := s.createSession(ctx, userID, client, &verifiedAt)
	return user.public(), session, err
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	_, err := s.db.Exec(ctx, `UPDATE "Session" SET "revokedAt" = now() WHERE "tokenHash" = $1 AND "revokedAt" IS NULL`, secure.HashToken(token))
	return err
}

// ResolveSession returns nil for any session that is missing, revoked, expired,
// belongs to an inactive account, or is a privileged session without 2FA.
func (s *Service) ResolveSession(ctx context.Context, token string) (*User, error) {
	if token == "" {
		return nil, nil
	}
	var revokedAt, verifiedAt *time.Time
	var expiresAt time.Time
	var a account
	err := s.db.QueryRow(ctx, `SELECT s."revokedAt", s."expiresAt", s."twoFactorVerifiedAt", `+accountColumns+`
		FROM "Session" s JOIN "User" u ON u.id = s."userId" WHERE s."tokenHash" = $1`, secure.HashToken(token)).
		Scan(&revokedAt, &expiresAt, &verifiedAt, &a.ID, &a.PublicID, &a.Username, &a.PasswordHash, &a.AccountStatus, &a.Roles, &a.CreatedAt, &a.DeletedAt, &a.TotpEnabledAt, &a.TotpSecretEncrypted)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if revokedAt != nil || !expiresAt.After(time.Now()) || a.DeletedAt != nil || a.AccountStatus != "ACTIVE" {
		return nil, nil
	}
	if privileged(a.Roles) && AdminTwoFactorRequired() && (verifiedAt == nil || a.TotpEnabledAt == nil) {
		return nil, nil
	}
	return &User{ID: a.ID, PublicUser: a.public()}, nil
}

func (s *Service) RequestPasswordReset(ctx context.Context, username string, client ClientContext) error {
	ip := client.IP
	if ip == "" {
		ip = "unknown"
	}
	byIP, err := s.redis.FixedWindowLimit(ctx, "reset-ip:"+secure.HMACBase64(s.cfg.SessionSecret, ip), resetPerIP, resetWindow)
	if err != nil {
		return err
	}
	byAccount, err := s.redis.FixedWindowLimit(ctx, "reset-account:"+secure.HMACBase64(s.cfg.SessionSecret, username), resetPerAccount, resetWindow)
	if err != nil {
		return err
	}
	// Over the limit the caller still gets the same "accepted" answer, so the
	// limit neither floods the victim's inbox nor reveals that the account exists.
	if !byIP || !byAccount {
		return nil
	}
	user, err := scanAccount(s.db.QueryRow(ctx, `SELECT `+accountColumns+` FROM "User" u WHERE username = $1`, username))
	if err != nil || user == nil || user.DeletedAt != nil {
		return err
	}
	token, tokenHash, err := secure.IssueToken()
	if err != nil {
		return err
	}
	now := time.Now()
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE "PasswordResetToken" SET "usedAt" = $2 WHERE "userId" = $1 AND "usedAt" IS NULL`, user.ID, now); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO "PasswordResetToken" (id, "userId", "tokenHash", "expiresAt") VALUES ($1,$2,$3,$4)`, ids.UUID(), user.ID, tokenHash, now.Add(resetLifetime)); err != nil {
			return err
		}
		return s.securityEvent(ctx, tx, &user.ID, "PASSWORD_RESET_REQUESTED", "INFO", nil, nil)
	})
	if err != nil {
		return err
	}
	kind, severity := "PASSWORD_RESET_DELIVERY_UNAVAILABLE", "WARNING"
	if s.deliverReset(ctx, user.ID, token) {
		kind, severity = "PASSWORD_RESET_DELIVERED", "INFO"
	}
	return s.securityEvent(ctx, s.db, &user.ID, kind, severity, nil, nil)
}

// deliverReset posts to the e-mail webhook exactly like PasswordResetDeliveryService.
func (s *Service) deliverReset(ctx context.Context, userID, token string) bool {
	if s.cfg.PublicWebURL == "" || s.cfg.EmailWebhookURL == "" {
		return false
	}
	rows, err := s.db.Query(ctx, `SELECT id, "valueEncrypted" FROM "NotificationEndpoint" WHERE "userId" = $1 AND channel = 'EMAIL' AND active LIMIT 3`, userID)
	if err != nil {
		return false
	}
	type endpoint struct{ id, value string }
	var endpoints []endpoint
	for rows.Next() {
		var e endpoint
		if rows.Scan(&e.id, &e.value) == nil {
			endpoints = append(endpoints, e)
		}
	}
	rows.Close()
	resetURL, err := url.Parse(s.cfg.PublicWebURL)
	if err != nil {
		return false
	}
	resetURL = resetURL.JoinPath("/recovery")
	resetURL.Path = "/recovery"
	query := resetURL.Query()
	query.Set("token", token)
	resetURL.RawQuery = query.Encode()
	delivered := false
	for _, e := range endpoints {
		target, err := s.crypto.Decrypt(e.value)
		if err != nil {
			continue
		}
		id := fmt.Sprintf("password-reset-%s-%s", secure.HashToken(token)[:24], e.id)
		body, _ := json.Marshal(map[string]any{"deliveryKey": id, "channel": "EMAIL", "target": target,
			"notification": map[string]any{"id": id, "type": "PASSWORD_RESET", "severity": "WARNING",
				"payload": map[string]any{"subject": "Resaller hisobingiz uchun parolni tiklash", "resetUrl": resetURL.String(), "expiresInMinutes": 15}}})
		request, _ := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.EmailWebhookURL, strings.NewReader(string(body)))
		request.Header.Set("content-type", "application/json")
		request.Header.Set("idempotency-key", id)
		if s.cfg.EmailWebhookToken != "" {
			request.Header.Set("authorization", "Bearer "+s.cfg.EmailWebhookToken)
		}
		response, err := s.client.Do(request)
		if err == nil && response.StatusCode < 300 {
			delivered = true
		} else {
			slog.Warn("password reset delivery failed", "endpoint", e.id)
		}
		if response != nil {
			response.Body.Close()
		}
	}
	return delivered
}

var errResetToken = httpx.Unauthorized("Reset token is invalid or expired")

var errAdminPassword = httpx.BadRequest("Admin paroli kamida 16 belgi bo‘lsin: katta va kichik harf hamda raqam aralash")

// assertPasswordPolicy keeps admin passwords at 16+ mixed characters on every path.
func (s *Service) assertPasswordPolicy(ctx context.Context, userID, newPassword string) error {
	var roles []string
	if err := s.db.QueryRow(ctx, `SELECT roles::text[] FROM "User" WHERE id = $1`, userID).Scan(&roles); err != nil {
		return err
	}
	if privileged(roles) && !StrongAdminPassword(newPassword) {
		return errAdminPassword
	}
	return nil
}

type ProfileView struct {
	PublicID  string     `json:"publicId"`
	Username  string     `json:"username"`
	FullName  *string    `json:"fullName"`
	Phone     *string    `json:"phone"`
	CreatedAt httpx.Time `json:"createdAt"`
}

// Profile returns the caller's own profile with the phone decrypted.
func (s *Service) Profile(ctx context.Context, userID string) (ProfileView, error) {
	var view ProfileView
	var encrypted *string
	var created time.Time
	if err := s.db.QueryRow(ctx, `SELECT "publicId", username, "fullName", "phoneEncrypted", "createdAt" FROM "User" WHERE id = $1`, userID).
		Scan(&view.PublicID, &view.Username, &view.FullName, &encrypted, &created); err != nil {
		return view, err
	}
	view.CreatedAt = httpx.Time{Time: created}
	if encrypted != nil {
		if phone, err := s.crypto.Decrypt(*encrypted); err == nil {
			view.Phone = &phone
		}
	}
	return view, nil
}

func (s *Service) ChangePassword(ctx context.Context, userID, currentToken, currentPassword, newPassword string) error {
	allowed, err := s.redis.FixedWindowLimit(ctx, "password-change:"+userID, 5, 900)
	if err != nil {
		return err
	}
	if !allowed {
		return httpx.Errorf(http.StatusTooManyRequests, "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring")
	}
	var stored string
	if err := s.db.QueryRow(ctx, `SELECT "passwordHash" FROM "User" WHERE id = $1`, userID).Scan(&stored); err != nil {
		return err
	}
	if !secure.VerifyPassword(currentPassword, stored) {
		return httpx.BadRequest("Joriy parol noto‘g‘ri")
	}
	if err := s.assertPasswordPolicy(ctx, userID, newPassword); err != nil {
		return err
	}
	hash, err := secure.HashPassword(newPassword)
	if err != nil {
		return err
	}
	keep := ""
	if currentToken != "" {
		keep = secure.HashToken(currentToken)
	}
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE "User" SET "passwordHash" = $2, "updatedAt" = now() WHERE id = $1`, userID, hash); err != nil {
			return err
		}
		// Every other device is signed out; this one stays signed in.
		if _, err := tx.Exec(ctx, `UPDATE "Session" SET "revokedAt" = now() WHERE "userId" = $1 AND "revokedAt" IS NULL AND "tokenHash" <> $2`, userID, keep); err != nil {
			return err
		}
		return s.securityEvent(ctx, tx, &userID, "PASSWORD_CHANGED", "WARNING", nil, nil)
	})
}

func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) error {
	var id, userID string
	var usedAt *time.Time
	var expiresAt time.Time
	err := s.db.QueryRow(ctx, `SELECT id, "userId", "usedAt", "expiresAt" FROM "PasswordResetToken" WHERE "tokenHash" = $1`, secure.HashToken(token)).Scan(&id, &userID, &usedAt, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && (usedAt != nil || !expiresAt.After(time.Now()))) {
		return errResetToken
	}
	if err != nil {
		return err
	}
	if err := s.assertPasswordPolicy(ctx, userID, newPassword); err != nil {
		return err
	}
	hash, err := secure.HashPassword(newPassword)
	if err != nil {
		return err
	}
	now := time.Now()
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE "PasswordResetToken" SET "usedAt" = $2 WHERE id = $1 AND "usedAt" IS NULL AND "expiresAt" > $2`, id, now)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return errResetToken
		}
		if _, err := tx.Exec(ctx, `UPDATE "User" SET "passwordHash" = $2, "updatedAt" = now() WHERE id = $1`, userID, hash); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE "Session" SET "revokedAt" = $2 WHERE "userId" = $1 AND "revokedAt" IS NULL`, userID, now); err != nil {
			return err
		}
		return s.securityEvent(ctx, tx, &userID, "PASSWORD_RESET_COMPLETED", "WARNING", nil, nil)
	})
}

type SessionView struct {
	ID        string     `json:"id"`
	UserAgent *string    `json:"userAgent"`
	CreatedAt httpx.Time `json:"createdAt"`
	ExpiresAt httpx.Time `json:"expiresAt"`
	Current   bool       `json:"current"`
}

func (s *Service) Sessions(ctx context.Context, userID, currentToken string) ([]SessionView, error) {
	currentHash := ""
	if currentToken != "" {
		currentHash = secure.HashToken(currentToken)
	}
	rows, err := s.db.Query(ctx, `SELECT id, "tokenHash", "userAgent", "createdAt", "expiresAt" FROM "Session"
		WHERE "userId" = $1 AND "revokedAt" IS NULL AND "expiresAt" > now() ORDER BY "createdAt" DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	views := []SessionView{}
	for rows.Next() {
		var v SessionView
		var tokenHash string
		var created, expires time.Time
		if err := rows.Scan(&v.ID, &tokenHash, &v.UserAgent, &created, &expires); err != nil {
			return nil, err
		}
		v.CreatedAt, v.ExpiresAt, v.Current = httpx.Time{Time: created}, httpx.Time{Time: expires}, tokenHash == currentHash
		views = append(views, v)
	}
	return views, rows.Err()
}

func (s *Service) RevokeSession(ctx context.Context, userID, id string) error {
	tag, err := s.db.Exec(ctx, `UPDATE "Session" SET "revokedAt" = now() WHERE id::text = $1 AND "userId" = $2 AND "revokedAt" IS NULL`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.Unauthorized("Session not found")
	}
	return nil
}

func (s *Service) RevokeOtherSessions(ctx context.Context, userID, currentToken string) (int64, error) {
	currentHash := ""
	if currentToken != "" {
		currentHash = secure.HashToken(currentToken)
	}
	tag, err := s.db.Exec(ctx, `UPDATE "Session" SET "revokedAt" = now() WHERE "userId" = $1 AND "revokedAt" IS NULL AND "tokenHash" <> $2`, userID, currentHash)
	return tag.RowsAffected(), err
}

var errAuthRequired = httpx.Unauthorized("Authentication required")

func (s *Service) RotateSession(ctx context.Context, token string) (Session, error) {
	if token == "" {
		return Session{}, errAuthRequired
	}
	oldHash := secure.HashToken(token)
	var id string
	var revokedAt *time.Time
	var expiresAt time.Time
	err := s.db.QueryRow(ctx, `SELECT id, "revokedAt", "expiresAt" FROM "Session" WHERE "tokenHash" = $1`, oldHash).Scan(&id, &revokedAt, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && (revokedAt != nil || !expiresAt.After(time.Now()))) {
		return Session{}, errAuthRequired
	}
	if err != nil {
		return Session{}, err
	}
	newToken, newHash, err := secure.IssueToken()
	if err != nil {
		return Session{}, err
	}
	var userID string
	if err := s.db.QueryRow(ctx, `SELECT "userId" FROM "Session" WHERE id = $1`, id).Scan(&userID); err != nil {
		return Session{}, err
	}
	newExpiry, err := s.sessionExpiry(ctx, userID)
	if err != nil {
		return Session{}, err
	}
	tag, err := s.db.Exec(ctx, `UPDATE "Session" SET "tokenHash" = $3, "expiresAt" = $4 WHERE id = $1 AND "tokenHash" = $2 AND "revokedAt" IS NULL`, id, oldHash, newHash, newExpiry)
	if err != nil {
		return Session{}, err
	}
	if tag.RowsAffected() != 1 {
		return Session{}, errAuthRequired
	}
	return Session{Token: newToken, ExpiresAt: newExpiry}, nil
}
