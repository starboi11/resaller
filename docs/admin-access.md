# Admin kirishi — qo‘llanma (2026-11-04)

Bu hujjatda maxfiy manzil ham, parol ham YO‘Q. Ularni faqat serverda yaratasiz
va parol menejerida saqlaysiz. Hech qachon chatga, emailga, skrinshotga
qo‘ymang.

## 1. Maxfiy admin manzili

```bash
node scripts/generate-admin-path.mjs      # masalan: /Xq3…  (33 belgi)
```

Chiqqan qiymatni serverdagi `.env` ga yozing:

```
ADMIN_BASE_PATH=/<chiqqan qiymat>
```

Admin panel endi faqat shu manzilda ochiladi:
`https://admin.<domen>/<maxfiy qiymat>/owner`. Boshqa har qanday admin manzili
oddiy 404 qaytaradi va maxfiy qiymatni ko‘rsatmaydi (Caddy ham, admin
serverining o‘zi ham tekshiradi). Qiymat build va ishga tushirish paytida
kerak; u bo‘lmasa admin image yig‘ilmaydi ham, ishga tushmaydi ham.

Manzilni almashtirish: yangi qiymat yarating, `.env` da almashtiring, admin
image’ni qayta yig‘ing (`docker compose -f compose.production.yml up -d --build admin proxy`).

## 2. Admin akkaunti

Serverda, API konteyneri ichida:

```bash
docker compose -f compose.production.yml exec api node apps/api/dist/scripts/admin-account.js create <username>
```

Buyruq 16 belgili tasodifiy parol (katta, kichik harf va raqam; 0/O, 1/l/I
kabi o‘xshash belgilarsiz) yaratadi va uni FAQAT BIR MARTA ko‘rsatadi. Darhol
parol menejeriga saqlang. Database’da faqat parolning scrypt izi qoladi.

Parolni yo‘qotsangiz yoki almashtirmoqchi bo‘lsangiz:

```bash
docker compose -f compose.production.yml exec api node apps/api/dist/scripts/admin-account.js reset <username>
```

`reset` yangi parol beradi va admin barcha qurilmalardan chiqariladi. Saytda
admin yaratish yoki admin bo‘lish yo‘li yo‘q — faqat shu buyruq.

## 3. 2FA (ikki bosqichli kirish)

Siz tanladingiz: admin faqat parol bilan kiradi. Serverdagi `.env`:

```
ADMIN_TWO_FACTOR_REQUIRED=false
```

Standart qiymat `true` (2FA yoqilgan). 2FA o‘chirilganda o‘rniga ishlaydi:
- admin kirishiga alohida limit: 15 daqiqada 5 urinish;
- har bir admin kirishi `ADMIN_LOGIN` (WARNING) xavfsizlik hodisasi sifatida yoziladi,
  limitga urilish `ADMIN_LOGIN_RATE_LIMITED` (CRITICAL);
- admin sessiyasi 12 soat (oddiy foydalanuvchi — 30 kun);
- admin paroli har qanday yo‘l bilan o‘zgartirilganda kamida 16 belgi, katta va
  kichik harf hamda raqam aralash bo‘lishi shart.

Ochiq aytilgan xavf: 2FA parol o‘g‘irlanganda (fishing, kompyuterdagi virus,
parolni boshqa joyda ishlatish) himoya qiladi. 2FA’siz parolni egallagan odam
butun saytni boshqaradi. Shuning uchun parolni faqat parol menejerida saqlang,
boshqa joyda ishlatmang, va shubha bo‘lsa darhol `reset` qiling. Xohlagan
vaqtda `ADMIN_TWO_FACTOR_REQUIRED=true` qilib 2FA’ni qaytarish mumkin.

## 4. Kundalik ish va admin ishi

- Do‘kon egasi akkaunti (`OWNER_STORE_USERNAME` do‘koni egasi): buyurtmalar,
  mijozlar bilan chat, savol va sharhlarga javob, mahsulotlar — Seller Center.
- Admin akkaunti: nizolar, foydalanuvchilarni bloklash, moderatsiya, xavfsizlik
  va audit — maxfiy admin manzili.
