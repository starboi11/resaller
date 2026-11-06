#!/usr/bin/env bash
set -e
export PGPASSWORD=postgres; P="psql -q -h localhost -U postgres -d resaller_local_e2e -v ON_ERROR_STOP=1"
$P <<'SQL'
INSERT INTO "Store" (id,"publicId","sellerProfileId",username,"nameUz","descriptionUz","orderPrefix",status,"updatedAt") VALUES
 ('bbbbbbbb-1111-4111-8111-111111111111','cstoreowner0000000000001','aaaaaaaa-1111-4111-8111-111111111111','resaller','Resaller','Mahsulotlarni o‘zimiz tanlaymiz, saqlaymiz va yetkazamiz.','RS','ACTIVE',now()),
 ('bbbbbbbb-2222-4222-8222-222222222222','cstoreother0000000000002','aaaaaaaa-2222-4222-8222-222222222222','eski_dokon','Eski do‘kon',NULL,'ED','ACTIVE',now());
SQL
# Former team member of the owner store (teams are retired: must get nothing).
$P -c "INSERT INTO \"StoreMember\" (id,\"storeId\",\"userId\",role) VALUES (gen_random_uuid(),'bbbbbbbb-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','STORE_MANAGER')"
add() { $P -c "WITH l AS (INSERT INTO \"Listing\" (id,\"publicId\",\"storeId\",\"categoryId\",\"nameUz\",\"descriptionUz\",\"priceMinor\",status,\"updatedAt\") SELECT gen_random_uuid(), '$1', '$2', id, '$3', 'Sinov uchun mahsulot tavsifi.', $4, 'ACTIVE', now() FROM \"Category\" WHERE slug='elektronika' RETURNING id), v AS (INSERT INTO \"ListingVariant\" (id,\"listingId\",sku,options) SELECT gen_random_uuid(), id, 'SKU-$1', '{}'::jsonb FROM l RETURNING id) INSERT INTO \"Inventory\" (id,\"variantId\",available) SELECT gen_random_uuid(), id, $5 FROM v"; }
add clistowner000000000000001 bbbbbbbb-1111-4111-8111-111111111111 'Simsiz quloqchin TWS Pro' 189000 12
add clistowner000000000000002 bbbbbbbb-1111-4111-8111-111111111111 'Aqlli soat Fit 8' 349000 5
add clistowner000000000000003 bbbbbbbb-1111-4111-8111-111111111111 'Telefon zaryadlovchi 65W' 99000 0
add clistother000000000000001 bbbbbbbb-2222-4222-8222-222222222222 'ESKI DOKON MAHSULOTI ko‘rinmasligi kerak' 10000 9
echo "--- stores as read from the database:"
psql -h localhost -U postgres -d resaller_local_e2e -At -c "SELECT s.username||' | '||s.status||' | owner verified: '||(p.\"verifiedAt\" IS NOT NULL) FROM \"Store\" s JOIN \"SellerProfile\" p ON p.id=s.\"sellerProfileId\" ORDER BY 1"
