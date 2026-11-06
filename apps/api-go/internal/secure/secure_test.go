package secure

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// testdata/node-fixtures.json is produced by testdata/make-node-fixtures.mjs
// with Node's crypto and the exact algorithms of the NestJS services.
type fixtures struct {
	PasswordHash, EndpointV1, EndpointLegacy, EndpointPrevious, TotpEncrypted string
	TokenHash, Hmac, TotpSecret, TotpCode                                     string
	TotpAt                                                                    int64
}

func load(t *testing.T) fixtures {
	t.Helper()
	raw, err := os.ReadFile("testdata/node-fixtures.json")
	if err != nil {
		t.Fatal(err)
	}
	var f fixtures
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}
	return f
}

const dataKey = "data-key-0123456789-0123456789-01"

func TestReadsWhatNodeWrote(t *testing.T) {
	f := load(t)
	if !VerifyPassword("Resaller-2026", f.PasswordHash) || VerifyPassword("resaller-2026", f.PasswordHash) {
		t.Fatal("Node scrypt hash not verified correctly")
	}
	c := NewCrypto(dataKey, "old-key-0123456789-0123456789-012")
	for want, payload := range map[string]string{"+998901234567": f.EndpointV1, "legacy@example.uz": f.EndpointLegacy, "rotated": f.EndpointPrevious} {
		if got, err := c.Decrypt(payload); err != nil || got != want {
			t.Fatalf("decrypt %q: got %q err %v", want, got, err)
		}
	}
	if _, err := NewCrypto(dataKey, "").Decrypt(f.EndpointPrevious); err == nil {
		t.Fatal("previous-key payload must fail without the previous key")
	}
	if got, err := NewTOTP(dataKey).Decrypt(f.TotpEncrypted); err != nil || got != f.TotpSecret {
		t.Fatalf("totp decrypt: %q %v", got, err)
	}
	if HashToken("example-token") != f.TokenHash {
		t.Fatal("token hash differs from Node")
	}
	if HMACBase64("session-secret", "alice\x00127.0.0.1") != f.Hmac {
		t.Fatal("HMAC differs from Node")
	}
	if TOTPCode(f.TotpSecret, f.TotpAt) != f.TotpCode || !VerifyTOTP(f.TotpSecret, f.TotpCode, f.TotpAt+29000) {
		t.Fatal("TOTP differs from Node")
	}
	if VerifyTOTP(f.TotpSecret, f.TotpCode, f.TotpAt+90000) {
		t.Fatal("TOTP must expire after one step of drift")
	}
}

func TestGoOutput(t *testing.T) {
	hash, err := HashPassword("Abc123")
	if err != nil || !strings.HasPrefix(hash, "scrypt$32768$8$1$") || !VerifyPassword("Abc123", hash) {
		t.Fatalf("hash %q err %v", hash, err)
	}
	c := NewCrypto(dataKey, "")
	enc, _ := c.Encrypt("secret")
	if !strings.HasPrefix(enc, "v1.") {
		t.Fatal("writes must carry the v1 prefix")
	}
	if got, _ := c.Decrypt(enc); got != "secret" {
		t.Fatal("round trip failed")
	}
	if VerifyPassword("x", "scrypt$1048576$8$1$AAAA$AAAA") {
		t.Fatal("oversized scrypt parameters must be refused")
	}
	if s, _ := GenerateTOTPSecret(); len(s) != 32 {
		t.Fatalf("secret length %d", len(s))
	}
	if ProvisioningURI("ali", "ABC") != "otpauth://totp/Resaller.uz%3Aali?secret=ABC&issuer=Resaller.uz&algorithm=SHA1&digits=6&period=30" {
		t.Fatal("provisioning URI differs from Node")
	}
}
