module github.com/resaller/api-go

go 1.22

require (
	github.com/go-chi/chi/v5 v5.1.0
	github.com/jackc/pgx/v5 v5.7.1
	github.com/redis/go-redis/v9 v9.7.0
	golang.org/x/crypto v0.31.0
)

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/sync v0.10.0 // indirect
	golang.org/x/text v0.21.0 // indirect
)

// golang.org and gopkg.in are not always reachable from build sandboxes; the
// GitHub mirrors carry the same module paths and code. yaml.v3 is only a test
// dependency of a dependency and is never compiled into the API binary.
replace (
	golang.org/x/crypto => github.com/golang/crypto v0.31.0
	golang.org/x/net => github.com/golang/net v0.33.0
	golang.org/x/sync => github.com/golang/sync v0.10.0
	golang.org/x/sys => github.com/golang/sys v0.28.0
	golang.org/x/term => github.com/golang/term v0.27.0
	golang.org/x/text => github.com/golang/text v0.21.0
	gopkg.in/yaml.v3 => ./third_party/yamlstub
)
