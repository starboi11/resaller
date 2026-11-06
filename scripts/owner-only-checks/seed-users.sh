#!/usr/bin/env bash
set -e
export PGPASSWORD=${PGPASSWORD:-postgres} PGHOST=${PGHOST:-localhost} PGUSER=${PGUSER:-postgres}
DB=resaller_local_e2e; P="psql -q -h localhost -U postgres -d $DB -v ON_ERROR_STOP=1"
createdb_cmd="${CREATEDB:-createdb}"; dropdb --if-exists "$DB" 2>/dev/null || true; $createdb_cmd "$DB"
cd "$(dirname "$0")/../.." && for d in $(ls -d apps/api/prisma/migrations/*/ | sort); do $P -f ${d}migration.sql >/dev/null; done
for t in Store Listing Inventory; do psql -h localhost -U postgres -d $DB -At -c "SELECT string_agg(column_name,',') FROM information_schema.columns WHERE table_name='$t' AND is_nullable='NO' AND column_default IS NULL" | sed "s/^/$t required: /"; done
HASH=$(node -e "const c=require('crypto');const s=c.randomBytes(16);const k=c.scryptSync('Parol123',s,64,{N:32768,r:8,p:1,maxmem:67108864});console.log('scrypt\$32768\$8\$1\$'+s.toString('base64url')+'\$'+k.toString('base64url'))")
$P <<SQL
INSERT INTO "Category" (id, slug, "nameUz") VALUES (gen_random_uuid(), 'elektronika', 'Elektronika');
INSERT INTO "User" (id,"publicId",username,"passwordHash",roles,"updatedAt") VALUES
 ('11111111-1111-4111-8111-111111111111','cownerdemo000000000000001','egasi','$HASH',ARRAY['BUYER','SELLER']::"Role"[],now()),
 ('22222222-2222-4222-8222-222222222222','cseller0demo00000000000002','eski_sotuvchi','$HASH',ARRAY['BUYER','SELLER']::"Role"[],now()),
 ('33333333-3333-4333-8333-333333333333','cbuyer00demo00000000000003','xaridor','$HASH',ARRAY['BUYER']::"Role"[],now()),
 ('44444444-4444-4444-8444-444444444444','cmember0demo00000000000004','eski_azo','$HASH',ARRAY['BUYER','SELLER']::"Role"[],now());
INSERT INTO "SellerProfile" (id,"userId","verifiedAt") VALUES
 ('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',NULL),
 ('aaaaaaaa-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',now());
SQL
echo seeded-users
