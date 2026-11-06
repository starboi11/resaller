# Resaller.uz — serverga topshirish, 2026-10-05

Ushbu kod arxivi Marketplace + Seller Center'ning hozirgi lokal versiyasidir. Bu productionga chiqarilgan yoki barcha browser sinovlari tugagan degani emas. Avval alohida staging'da tekshiring. Serverdagi boshqa loyihalarga tegmang.

## Arxiv tarkibi va holat

- Web, admin, API, umumiy paketlar, Docker Compose, testlar va hujjatlar.
- 21 ta Prisma migratsiyasi, shu jumladan Seller Center uchun `20261004090000_selleros_core`.
- Seller Center: `/seller/center/{storePublicId}`; `/seller/manage` ichidagi Seller Center tugmasidan ochiladi.
- Owner panel: `https://admin.resaller.uz/owner`; mavjud login, haqiqiy TOTP va role tekshiruvi ishlaydi.
- Seller Center'da tashqi buyurtmalar, umumiy stock, CRM, delivery, xarajatlar, 1/7/30 kunlik hisobotlar va shaxsiy ma'lumotsiz AI konteksti mavjud. To'lov qaydi seller kiritgan ma'lumot; payment collection/escrow/settlement hali deferred.

2026-10-04 lokal tekshiruv: build va typecheck o'tgan. Alohida vaqtinchalik PostgreSQL'da barcha 21 migratsiya va Seller Center reserve/cancel/deliver hamda marketplace checkout concurrency tekshirilgan. 2026-10-05 release secret scanner va 6 deployment testidan o'tkazildi. 2026-10-09 refund hisobi, dashboard statuslari va yangi marketplace order category snapshot'i tuzatildi; API/web typecheck va API unit testlari o'tgan. Bu o'zgarishlar uchun alohida PostgreSQL qayta sinovi Docker Engine ishga tushganda qayta bajarilishi kerak. Browser/staging sinovlari hali qolgan.

## Mavjud ma'lumotlar

Arxivda haqiqiy `.env`, `.secrets`, baza va foydalanuvchi media fayllari yo'q. Ular mavjud joyida saqlangan; arxiv ularni o'chirmaydi va backup o'rnini bosmaydi. Serverdagi `.env.production` va secretlarni `.example` bilan almashtirmang. `DATA_ENCRYPTION_KEY` o'zgarsa, eski shifrlangan ma'lumotlarni ochib bo'lmasligi mumkin.

Avval mavjud Compose project nomi, PostgreSQL major versiyasi, barcha volume va bind mount manzillarini tekshiring. Yangi project nomi yoki yangi volume nomi bo'sh bazani ulashi mumkin. Quyidagi Compose fayli PostgreSQL 17 uchun. Eski server boshqa major versiyada bo'lsa, avval alohida upgrade rejasi kerak.

## O'rnatish tartibi

1. Mavjud source/image revision, `.env`, secret, baza va media backupini saqlang; tiklash imkonini tekshiring.
2. ZIPni yangi release papkasiga oching. Node.js 24 orqali `node scripts/verify-release.mjs` bajaring.
3. Mavjud maxfiy sozlamalarni xavfsiz ulang. Kerakli env nomlari `.env.production.example` ichida. Monitoring uchun `.secrets/metrics_token` va `.secrets/alertmanager_webhook_url` fayllari ham kerak.
4. Alohida staging project/baza/bucketda shu versiyani sinang. Mavjud 80/443 portlarini ishlatayotgan proxy bo'lsa, yangi proxy bilan almashtirmang; faqat Resaller route'larini ulang.
5. Quyidagi production buyruqlarini faqat project va volume mapping tekshirilgach, har birining natijasini ko'rib ketma-ket bajaring.

```sh
export RESALLER_PROJECT='MAVJUD_TEKSHIRILGAN_PROJECT_NOMI'
node scripts/verify-release.mjs
node scripts/server-preflight.mjs --env-file .env.production --project-name "$RESALLER_PROJECT"
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml build
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml up -d --wait postgres redis clamav
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml run --rm --no-deps backup resaller-backup
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml run --rm --no-deps api pnpm --filter @resaller/api db:migrate:deploy
docker compose -p "$RESALLER_PROJECT" --env-file .env.production -f compose.production.yml up -d --wait
LIVE_ORIGIN=https://resaller.uz node scripts/live-smoke.mjs
```

Backup yoki migratsiya muvaffaqiyatsiz bo'lsa, davom etmang. Prisma faqat yetishmagan migratsiyalarni qo'llaydi. `migrate reset`, `compose down -v`, `docker system prune` ishlatmang. Alohida release papkasiga o'tganda bind mountlar ham o'zgarishini hisobga oling.

## Serverdagi qabul tekshiruvi

- `/api/v1/health/ready` 200; R2 public/private upload/read va real email.
- Buyer/seller login, cookie, logout; owner TOTP va ruxsatlar.
- Tasdiqlangan seller publish qiladi; buyer ko'radi, checkout qiladi; seller qabul qilib bajaradi; buyer review yozadi.
- Seller Center'da Telegram order yaratish, takror bosish, stock bandlash, cancel/release, delivery/finalize, CRM va hisobot.
- Boshqa do'kon ma'lumotiga kira olmaslik; Order Operator finance/stock edit qila olmasligi.
- HTTPS/HSTS, yopiq DB/Redis, monitoring alert, tashqi backup/restore va rollback.

Eski image'ga qaytish bazani avtomatik qaytarmaydi. Restore keyingi yozuvlarni yo'qotishi mumkin; buni avtomatik bajarmang.

## Qolgan ishlar

Seller Center'ning login qilingan desktop/mobile browser E2E sinovi, staging'dagi provider va xavfsizlik tekshiruvlari, marketplace tarixiy stock harakatlarini yangi ledgerda to'liq birlashtirish, marketplace tannarx/foyda hisobini yakunlash. Hozir marketplace foydasi noma'lum, tashqi foyda taxminiy deb ko'rsatiladi. Huquqiy tasdiq va beta alohida launch vazifalari bo'lib qoladi.

Texnik tuzilma: `docs/seller-center-architecture.md`. Oldingi `SERVER-HANDOFF-2026-10-02.md` tarixiy qayd; joriy migratsiya soni va release holati uchun shu fayldan foydalaning.
