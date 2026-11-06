// Package secure holds every primitive whose bytes must match the Node API
// exactly, so users, sessions and encrypted rows written by either backend keep
// working with the other during the migration.
package secure

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/crypto/scrypt"
)

var b64 = base64.RawURLEncoding

const (
	passwordKeyLength = 64
	passwordCost      = 32768
)

// HashPassword produces `scrypt$N$r$p$salt$key`, the format PasswordService writes.
func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, err := scrypt.Key([]byte(password), salt, passwordCost, 8, 1, passwordKeyLength)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("scrypt$%d$8$1$%s$%s", passwordCost, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// VerifyPassword accepts any cost encoded in the hash, like the Node verifier.
func VerifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "scrypt" {
		return false
	}
	n, errN := strconv.Atoi(parts[1])
	r, errR := strconv.Atoi(parts[2])
	p, errP := strconv.Atoi(parts[3])
	salt, errS := b64.DecodeString(parts[4])
	expected, errK := b64.DecodeString(parts[5])
	if errN != nil || errR != nil || errP != nil || errS != nil || errK != nil || len(expected) != passwordKeyLength {
		return false
	}
	// Node caps scrypt memory at 64 MiB; refuse parameters above it.
	if n <= 1 || r <= 0 || p <= 0 || 128*n*r > 64*1024*1024 {
		return false
	}
	actual, err := scrypt.Key([]byte(password), salt, n, r, p, passwordKeyLength)
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(expected, actual) == 1
}

// IssueToken returns a random token and its SHA-256 base64url hash (SessionTokenService).
func IssueToken() (token, tokenHash string, err error) {
	raw := make([]byte, 32)
	if _, err = rand.Read(raw); err != nil {
		return "", "", err
	}
	token = b64.EncodeToString(raw)
	return token, HashToken(token), nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return b64.EncodeToString(sum[:])
}

// HMACBase64 is HMAC-SHA256 with a base64url digest (login limiter keys, IP hashes).
func HMACBase64(secret, value string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(value))
	return b64.EncodeToString(mac.Sum(nil))
}

func deriveKey(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

// Crypto mirrors EndpointCryptoService: AES-256-GCM, `v1.iv.tag.data`, with the
// previous key accepted on read during a rotation.
type Crypto struct {
	current  []byte
	previous []byte
}

func NewCrypto(current, previous string) *Crypto {
	c := &Crypto{current: deriveKey(current)}
	if previous != "" {
		c.previous = deriveKey(previous)
	}
	return c
}

func seal(key []byte, value string) (iv, tag, data []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, nil, err
	}
	iv = make([]byte, 12)
	if _, err = rand.Read(iv); err != nil {
		return nil, nil, nil, err
	}
	sealed := gcm.Seal(nil, iv, []byte(value), nil)
	return iv, sealed[len(sealed)-16:], sealed[:len(sealed)-16], nil
}

func open(key, iv, tag, data []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	plain, err := gcm.Open(nil, iv, append(append([]byte{}, data...), tag...), nil)
	return string(plain), err
}

func (c *Crypto) Encrypt(value string) (string, error) {
	iv, tag, data, err := seal(c.current, value)
	if err != nil {
		return "", err
	}
	return strings.Join([]string{"v1", b64.EncodeToString(iv), b64.EncodeToString(tag), b64.EncodeToString(data)}, "."), nil
}

var ErrDecrypt = errors.New("stored encrypted value could not be decrypted with any configured key")

func (c *Crypto) Decrypt(payload string) (string, error) {
	parts := strings.Split(payload, ".")
	if len(parts) == 4 && parts[0] == "v1" {
		parts = parts[1:]
	}
	if len(parts) != 3 {
		return "", errors.New("stored encrypted value is malformed")
	}
	iv, e1 := b64.DecodeString(parts[0])
	tag, e2 := b64.DecodeString(parts[1])
	data, e3 := b64.DecodeString(parts[2])
	if e1 != nil || e2 != nil || e3 != nil {
		return "", errors.New("stored encrypted value is malformed")
	}
	for _, key := range [][]byte{c.current, c.previous} {
		if key == nil {
			continue
		}
		if plain, err := open(key, iv, tag, data); err == nil {
			return plain, nil
		}
	}
	return "", ErrDecrypt
}

// TOTP mirrors TotpService. Its secrets use the legacy `iv.tag.data` form
// (no version prefix) and only the current key.
type TOTP struct{ key []byte }

func NewTOTP(secret string) *TOTP { return &TOTP{key: deriveKey(secret)} }

func (t *TOTP) Encrypt(secret string) (string, error) {
	iv, tag, data, err := seal(t.key, secret)
	if err != nil {
		return "", err
	}
	return strings.Join([]string{b64.EncodeToString(iv), b64.EncodeToString(tag), b64.EncodeToString(data)}, "."), nil
}

func (t *TOTP) Decrypt(payload string) (string, error) {
	parts := strings.Split(payload, ".")
	if len(parts) != 3 {
		return "", errors.New("invalid encrypted TOTP secret")
	}
	iv, e1 := b64.DecodeString(parts[0])
	tag, e2 := b64.DecodeString(parts[1])
	data, e3 := b64.DecodeString(parts[2])
	if e1 != nil || e2 != nil || e3 != nil {
		return "", errors.New("invalid encrypted TOTP secret")
	}
	return open(t.key, iv, tag, data)
}

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

func GenerateTOTPSecret() (string, error) {
	raw := make([]byte, 20)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base32Encode(raw), nil
}

func base32Encode(input []byte) string {
	var bits strings.Builder
	for _, b := range input {
		bits.WriteString(fmt.Sprintf("%08b", b))
	}
	s := bits.String()
	var out strings.Builder
	for i := 0; i < len(s); i += 5 {
		chunk := s[i:min(i+5, len(s))]
		for len(chunk) < 5 {
			chunk += "0"
		}
		v, _ := strconv.ParseUint(chunk, 2, 8)
		out.WriteByte(base32Alphabet[v])
	}
	return out.String()
}

func base32Decode(input string) ([]byte, error) {
	input = strings.ToUpper(strings.TrimRight(input, "="))
	var bits strings.Builder
	for _, ch := range input {
		idx := strings.IndexRune(base32Alphabet, ch)
		if idx < 0 {
			return nil, errors.New("invalid base32 secret")
		}
		bits.WriteString(fmt.Sprintf("%05b", idx))
	}
	s := bits.String()
	out := make([]byte, 0, len(s)/8)
	for i := 0; i+8 <= len(s); i += 8 {
		v, _ := strconv.ParseUint(s[i:i+8], 2, 8)
		out = append(out, byte(v))
	}
	return out, nil
}

func totpCode(key []byte, counter int64) string {
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], uint64(counter))
	mac := hmac.New(sha1.New, key)
	mac.Write(msg[:])
	digest := mac.Sum(nil)
	offset := digest[len(digest)-1] & 0x0f
	value := (binary.BigEndian.Uint32(digest[offset:]) & 0x7fffffff) % 1000000
	return fmt.Sprintf("%06d", value)
}

var sixDigits = regexp.MustCompile(`^\d{6}$`)

// VerifyTOTP accepts the previous, current and next 30-second step.
func VerifyTOTP(secret, code string, nowMillis int64) bool {
	if !sixDigits.MatchString(code) {
		return false
	}
	key, err := base32Decode(secret)
	if err != nil {
		return false
	}
	counter := nowMillis / 30000
	ok := false
	for _, offset := range []int64{-1, 0, 1} {
		if subtle.ConstantTimeCompare([]byte(totpCode(key, counter+offset)), []byte(code)) == 1 {
			ok = true
		}
	}
	return ok
}

// TOTPCode is exported for tests and local tooling only.
func TOTPCode(secret string, nowMillis int64) string {
	key, _ := base32Decode(secret)
	return totpCode(key, nowMillis/30000)
}

func ProvisioningURI(username, secret string) string {
	issuer := "Resaller.uz"
	return fmt.Sprintf("otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
		encodeURIComponent(issuer+":"+username), secret, encodeURIComponent(issuer))
}

// encodeURIComponent matches JavaScript's escaping set.
func encodeURIComponent(s string) string {
	const keep = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()"
	var out strings.Builder
	for _, b := range []byte(s) {
		if strings.IndexByte(keep, b) >= 0 {
			out.WriteByte(b)
		} else {
			out.WriteString(fmt.Sprintf("%%%02X", b))
		}
	}
	return out.String()
}
