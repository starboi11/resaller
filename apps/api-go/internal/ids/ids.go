// Package ids creates the identifiers Prisma generates client-side
// (@default(uuid()) and @default(cuid())), which the database does not default.
package ids

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

func UUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

var counter atomic.Uint32

func pad(s string, size int) string {
	if len(s) >= size {
		return s[len(s)-size:]
	}
	return strings.Repeat("0", size-len(s)) + s
}

var fingerprint = func() string {
	host, _ := os.Hostname()
	sum := len(host) + 36
	for _, r := range host {
		sum += int(r)
	}
	return pad(strconv.FormatInt(int64(os.Getpid()), 36), 2) + pad(strconv.FormatInt(int64(sum), 36), 2)
}()

func randomBlock() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(36*36*36*36))
	return pad(strconv.FormatInt(n.Int64(), 36), 4)
}

// CUID returns a 25-character collision-resistant id in the cuid v1 layout
// ("c" + time + counter + fingerprint + random), like Prisma's cuid().
func CUID() string {
	c := counter.Add(1) % (36 * 36 * 36 * 36)
	return "c" + strconv.FormatInt(time.Now().UnixMilli(), 36) +
		pad(strconv.FormatInt(int64(c), 36), 4) + fingerprint + randomBlock() + randomBlock()
}
