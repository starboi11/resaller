# Resaller server handoff — 2026-10-02

## Chegara

Faqat Resaller loyihasiga teging. Boshqa saytlar, konteynerlar, bazalar, portlar va Cloudflare sozlamalarini o‘zgartirmang. Ushbu audit production serverni o‘zgartirmadi. `docker system prune`, `compose down -v`, bazani reset qilish va mavjud volume’larni o‘chirish taqiqlanadi.

## Arxiv va maxfiy sozlamalar

Arxiv source code, Docker/CI, 19 migratsiya, testlar va hujjatlarni saqlaydi. `node_modules`, build keshi, haqiqiy `.env`, `.secrets`, baza va foydalanuvchi media fayllari unga kiritilmaydi. Ular eski joyida saqlanishi kerak. Bu kod arxivi baza/media backupini almashtirmaydi.

Ochilgandan keyin `node scripts/verify-release.mjs` orqali barcha source hashlarini tekshiring. Secretlarni chatga yoki GitHubga yubormang. `.env.production.example` va `.env.staging.example` faqat shablon. Mavjud secret fayllarini shablon bilan bosib yubormang. Linuxda env fayli owner-only bo‘lsin. Monitoring secret fayllarini esa tegishli container UID o‘qiy olishi shart: image foydalanuvchisini tekshirib, faqat shu UID/kerakli guruhga read huquqini bering. World-readable qilmang; root-only `600` bind-mount Prometheus/Alertmanager ishlashiga to‘sqinlik qilishi mumkin.

Chatda oshkor bo‘lgan R2 credentiallari foydalanuvchi iltimosiga ko‘ra o‘zgartirilmagan va o‘chirilmagan. Ularni productionda saqlash xavfsizlik riski; yangi cheklangan token bilan almashtirish launch oldi tavsiyasi bo‘lib qoladi.

## Avval mavjud joylashuvni aniqlang

Hostda Docker Engine + Compose v2 va tekshiruv skriptlari uchun Node.js 24 kerak. Ilovalar Docker ichida build qilinadi. Disk/RAM sig‘imini staging yuklama natijasiga qarab tanlang; ClamAV uchun ham xotira ajrating.

`docker compose ls`, `docker ps` va Resaller konteynerlarining Compose label/volume mountlarini read-only tekshiring. Mavjud production project nomi va PostgreSQL/media volume yo‘llarini yozib oling. Yangi project nomi yangi bo‘sh baza yaratishi mumkin. Faqat yangi o‘rnatishda `resaller-prod`; mavjud o‘rnatishda aynan eski project nomidan foydalaning. Quyidagi `<EXISTING_PROJECT>` shu tekshirilgan nomni anglatadi.

## Alohida staging

Productiondan alohida `/opt/resaller-staging` papka, `resaller-staging` Compose project, `staging.resaller.uz` va `admin.staging.resaller.uz`, alohida baza va R2 bucketlar kerak. Shu serverda 80/443 boshqa proxy tomonidan band bo‘lsa, ikkinchi proxy ishga tushirmang: mavjud proxy egasi bilan faqat staging route’larini kelishing yoki alohida staging host ishlating.

`.env.staging` va `.secrets/metrics_token`, `.secrets/alertmanager_webhook_url` to‘ldirilgach:

```sh
node scripts/server-preflight.mjs --staging --env-file .env.staging
```

Bu faqat konfiguratsiya tekshiruvi, R2/email/alert haqiqiy ishlashini isbotlamaydi. Staging deploy skripti faqat tasdiqlangan staging papkada ishlaydi, source revisionni o‘zi almashtirmaydi va productionga tegmaydi.

## Production yangilash tartibi

1. Env, secret, media va bazaning tiklanadigan tashqi backupini oling. Hozirgi Git/source revision va image digestlarini yozing.
2. Alohida release papkaga arxivni oching. Secretlarni xavfsiz ulang; avvalgi baza/volume identifikatorlarini saqlang.
3. `node scripts/server-preflight.mjs --env-file .env.production --project-name <EXISTING_PROJECT>`.
4. Shu project va env bilan `compose.production.yml` image’larini build qiling. `NEXT_PUBLIC_API_URL` build vaqtida to‘g‘ri HTTPS domen bo‘lishi shart.
5. Shu projectning PostgreSQL/Redis/ClamAV xizmatlari tayyor bo‘lgach, maintenance oynasida API image orqali `pnpm --filter @resaller/api db:migrate:deploy` bajaring. 19 migratsiya source’da bor; Prisma faqat yetishmaganlarini qo‘llaydi. `migrate reset` ishlatmang.
6. Xuddi shu project va env bilan `up -d --wait`. Tayyorlik endpointi `/api/v1/health/ready` 200 qaytarishi kerak.
7. `LIVE_ORIGIN=https://resaller.uz node scripts/live-smoke.mjs` va authorized seller/buyer/owner oqimlarini sinang. Smoke skriptining env nomlarini o‘zidan tekshiring.
8. Owner kirishi: `https://admin.resaller.uz/owner`. `/` 404, `/owner` noindex. API login/TOTP/role tekshiruvlari majburiy. Domen uchun owner identity allowlist qo‘shimcha himoya kerak.

Mavjud project va volume nomlari tekshirilgandan keyingi buyruqlar (papka ichida). Placeholder o‘rniga tekshirilgan nomni kiriting. Mavjud PostgreSQL major versiyasi 17 bo‘lmasa, bu buyruqlarni bajarmang: avval alohida baza upgrade rejasi kerak.

```sh
export RESALLER_PROJECT='SET_EXISTING_PROJECT_NAME'
node scripts/verify-release.mjs
node scripts/server-preflight.mjs --env-file .env.production --project-name "$RESALLER_PROJECT"
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml build
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml up -d --wait postgres redis clamav
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml run --rm --no-deps backup resaller-backup
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml run --rm --no-deps api pnpm --filter @resaller/api db:migrate:deploy
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml up -d --wait
LIVE_ORIGIN=https://resaller.uz node scripts/live-smoke.mjs
```

Har bir buyruq muvaffaqiyatli tugaganidan keyin keyingisini bajaring. Backup yoki migratsiya xato bersa, keyingisiga o‘tmang. Boshqa loyihaning project/volume nomini ishlatmang.

Migratsiya admin sessiyasiga 2FA isbotini qo‘shadi: eski privileged sessiyalar qayta kirishni talab qiladi. Eski statik olti xonali kodlar haqiqiy TOTP o‘rniga ishlamaydi.

## Qabul sinovi

Verified seller mahsulot draftini yaratadi → media/variant saqlanadi → publish qiladi → anonymous buyer katalog/store/productda ko‘radi → savat/checkout → seller 60 daqiqada qabul qiladi → bajaradi → buyer yakunlab verified review yozadi. Har listing uchun admin tasdig‘i talab qilinmaydi; seller verification bir marta tasdiqlanadi. Bloklangan/vacation store va restricted listing chiqmasligi tekshirilsin. To‘lov/escrow/settlement MVPda deferred.

R2 public/private upload/read va begona hisobga private hujjat rad etilishi; real email; logout/expired cookie; multi-seller; duplicate checkout; stock concurrency; timeout; return/dispute; ClamAV upload; chat reconnect tekshirilsin.

HTTPS redirect/HSTS, DB/Redis internetdan yopiq, alert operatorga yetishi, off-host backup restore va rollback isboti bo‘lmasdan global launch tasdiqlanmaydi. Eski imagega qaytish migratsiyani avtomatik qaytarmaydi; additive schema compatibilityni tekshiring yoki maintenance ichida oldingi backupni tiklang. Tiklash keyingi buyurtmalarni yo‘qotishi mumkin — owner tasdig‘isiz bajarmang.

## Hali tashqi isbot talab qilinadigan ishlar

Real staging va production deploy, R2/provider ulanishi, owner allowlist, HTTPS/HSTS, off-host restore/rollback, SSE yuklama testi, staging pentest, real iPhone uzun savdo jarayoni, yuridik tasdiq va 20–50 seller beta. Lokal testlar bularni almashtirmaydi. AI provider narx/retention/privacy qarori hali owner tasdig‘ini talab qiladi.
