# Owner-only verification report — 2026-11-03

Isolated test DB `resaller_local_e2e`; OWNER_STORE_USERNAME=resaller is a TEST value, not production.

## Test suites
```
pnpm check EXIT=0
@resaller/types:test:  Test Files  2 passed (2)
@resaller/types:test:       Tests  6 passed (6)
@resaller/config:test:  Test Files  2 passed (2)
@resaller/config:test:       Tests  12 passed (12)
@resaller/validation:test:  Test Files  2 passed (2)
@resaller/validation:test:       Tests  6 passed (6)
@resaller/api:test:  Test Files  37 passed | 1 skipped (38)
@resaller/api:test:       Tests  135 passed | 2 skipped (137)
redis-queue (separately, RUN_REDIS_TESTS=1):       Tests  2 passed (2)
ok  	github.com/resaller/api-go/internal/config	0.002s
ok  	github.com/resaller/api-go/internal/httpx	(cached)
ok  	github.com/resaller/api-go/internal/ids	(cached)
ok  	github.com/resaller/api-go/internal/secure	(cached)
Node/Go parity: 24/24 scenarios identical; interoperability OK
```

## HTTP checks
```
ROLE           isOwner      /seller/stores center:owner-store     center:old-store       owner-settings     new-listing-old-store
xaridor        False        403            403                    403                    403                403
eski_sotuvchi  False        403            403                    403                    403                403
eski_azo       False        403            403                    403                    403                403
egasi          True         200            200                    403                    400                403
--- buyer catalogue:
   Telefon zaryadlovchi 65W
   Aqlli soat Fit 8
   Simsiz quloqchin TWS Pro
--- old store product by direct link: 404  old store page: 404  owner store page: 200
```

## Browser checks (Chromium, 1280px and 360px)
```
PASS  [desktop] buyer catalogue shows the owner's products only
PASS  [desktop] no seller-trust filter in catalogue
PASS  [desktop] product page says "Sotuvchi: Resaller", no trust badges
PASS  [desktop] old store product is not shown by direct link
PASS  [desktop] buyer gets "faqat do‘kon egasi uchun" on management
PASS  [desktop] buyer menu has no "Do‘kon boshqaruvi" or "Sotuvchi bo‘lish" — "Shaxsiy kabinet\nBuyurtmalarim\n☾"
PASS  [desktop] buyer pages without JS errors
PASS  [desktop] old SELLER account is not treated as owner
PASS  [desktop] old SELLER cannot open Seller Center of its old store
PASS  [desktop] old SELLER menu has no "Do‘kon boshqaruvi" — "Shaxsiy kabinet\nBuyurtmalarim\n☾"
PASS  [desktop] old-seller pages without JS errors
PASS  [desktop] former team member is not treated as owner
PASS  [desktop] former team member cannot open the owner Seller Center
PASS  [desktop] former member menu has no "Do‘kon boshqaruvi" — "Shaxsiy kabinet\nBuyurtmalarim\n☾"
PASS  [desktop] former-member pages without JS errors
PASS  [desktop] owner manages the store without ID verification
PASS  [desktop] owner opens Seller Center; no reseller links
PASS  [desktop] owner menu shows "Do‘kon boshqaruvi" — "Shaxsiy kabinet\nBuyurtmalarim\nDo‘kon boshqaruvi\n☾"
PASS  [desktop] owner pages without JS errors
PASS  [mobile] buyer catalogue shows the owner's products only
PASS  [mobile] no seller-trust filter in catalogue
PASS  [mobile] product page says "Sotuvchi: Resaller", no trust badges
PASS  [mobile] old store product is not shown by direct link
PASS  [mobile] buyer gets "faqat do‘kon egasi uchun" on management
PASS  [mobile] buyer pages without JS errors
PASS  [mobile] old SELLER account is not treated as owner
PASS  [mobile] old SELLER cannot open Seller Center of its old store
PASS  [mobile] old-seller pages without JS errors
PASS  [mobile] former team member is not treated as owner
PASS  [mobile] former team member cannot open the owner Seller Center
PASS  [mobile] former-member pages without JS errors
PASS  [mobile] owner manages the store without ID verification
PASS  [mobile] owner opens Seller Center; no reseller links
PASS  [mobile] owner pages without JS errors
PASS  [mobile] /marketplace has no horizontal overflow at 360px — 0px
PASS  [mobile] /product/clistowner000000000000001 has no horizontal overflow at 360px — 0px
PASS  [mobile] /store/resaller has no horizontal overflow at 360px — 0px
PASS  [mobile] /cart has no horizontal overflow at 360px — 0px
38/38 browser checks passed
```

## Screenshots
- desktop-1-buyer-catalogue.png
- desktop-10-owner-menu.png
- desktop-11-former-member-manage.png
- desktop-12-former-member-center.png
- desktop-2-buyer-product.png
- desktop-3-buyer-old-store-product.png
- desktop-4-buyer-manage.png
- desktop-5-buyer-menu.png
- desktop-6-old-seller-manage.png
- desktop-7-old-seller-center.png
- desktop-8-owner-manage.png
- desktop-9-owner-center.png
- mobile-1-buyer-catalogue.png
- mobile-11-former-member-manage.png
- mobile-12-former-member-center.png
- mobile-2-buyer-product.png
- mobile-3-buyer-old-store-product.png
- mobile-4-buyer-manage.png
- mobile-6-old-seller-manage.png
- mobile-7-old-seller-center.png
- mobile-8-owner-manage.png
- mobile-9-owner-center.png

## ZIP re-open check
```
Archive: resaller-2026-11-03-owner-only-final.zip
529 files extracted; 529/529 byte-identical to the source tree (SHA-256)
.env: not included; secret scan passed (520 release source files)
owner-access.ts: member lookup removed, MEMBER role removed, owner-only check present
owner-only.integration.test.ts: former-member negative test present
seller-center.controller.ts: @UseGuards(SessionGuard, OwnerGuard)
GO-MIGRATION-HANDOFF.md: correction section, production warning, 38/38 present
REPORT.md: 38 PASS, 0 FAIL; screenshots 22 (12 desktop, 10 at 360px)
check scripts: bash -n and node --check passed
```
