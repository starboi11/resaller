# Lokal audit va topshirish — 2026-11-06

## Qilingan tuzatishlar

- Checkout takroriy so‘rovining natijasi faqat o‘sha xaridorga qaytadi, shu jumladan ikkita so‘rov bir vaqtda kelganda ham.
- Eski StoreMember yozuvi buyurtma tafsilotlari, chat, AI buyurtma yordami yoki shaxsiy media fayliga kirish huquqini bermaydi. Do‘kon egasi va xaridor uchun ruxsat saqlangan; adminning tegishli rollari alohida ishlaydi.
- Faqat butunlay rollback qilingan P2034 tranzaksiya to‘qnashuvi ko‘pi bilan ikki marta qayta bajariladi. Asl idempotency key, narx va stock tekshiruvlari saqlanadi. Noma’lum tarmoq xatosi avtomatik takrorlanmaydi.
- Bir bazani ishlatadigan integratsion test fayllari RUN_DB_TESTS=1 bo‘lsa ketma-ket bajariladi. Oxirgi dona testining ikki xaridori test ichida parallel ishlaydi. Avval boshqa testlar yaratish/tozalash amallari Serializable testiga xalaqit berib, ikkala buyurtmani rad qilishi kuzatilgan.
- Admin modullari yuklanmasa, bo‘sh muvaffaqiyat ekrani o‘rniga xato va qayta yangilash imkoniyati chiqadi. Sessiya tugasa eski yozuvlar o‘chiriladi.
- Admin qarori saqlanmasa, oyna va yozilgan sabab qoladi; parallel takror bosish cheklangan. Faqat muvaffaqiyatdan keyin oyna yopiladi.
- Admin oynalari native dialog orqali klaviatura fokusini ichkarida saqlaydi; Escape bilan yopiladi. Saqlash vaqtida yopish bloklanadi. Sabab maydonlariga o‘qiladigan nom berilgan.
- Admin serverining Windows fayl yo‘li to‘g‘rilangan. Production maxfiy manzil himoyasi saqlangan.
- Homepage’dagi keraksiz FAQ bloki olib tashlangan. Telegram tugmasiga tiniq SVG Telegram belgisi qo‘yilgan; manzil @starboiazp.
- Hero video ovozsiz, avtomatik boshlanadi, controls yo‘q; reduced-motion holatida poster ko‘rinadi. Portret video keng blokni to‘ldirish uchun qirqiladi.
- .local-audit/ Git va Docker build’dan chiqarilgan. Uning ichidagi lokal test parollari va baza sozlamalari release arxiviga kiritilmaydi, lokal fayllar o‘chirilmagan.

## Tekshiruv dalillari

| Tekshiruv | Natija va chegarasi |
| --- | --- |
| pnpm check | O‘tdi: Prisma schema, secret scan, deployment tools, lint, typecheck, paket testlari, web/admin/API build |
| Nest API | 144 o‘tdi, 2 Redis testi asosiy yugurishda skip |
| Redis | O‘sha 2 test alohida lokal Redis DB12’da o‘tdi: jami API 146/146 |
| Umumiy paketlar | Config 12, types 6, validation 6; deployment tools 6 o‘tdi |
| Haqiqiy brauzer + lokal API | 19 tekshiruv: UI ro‘yxatdan o‘tish/profil/savat, haqiqiy checkout, takror so‘rov, egani aniqlash, fulfillment, yakunlash va review, admin foydalanuvchilar va real status qarori |
| Admin xato holatlari | 503 javobida sabab saqlanishi, yangilashdagi outage, 401 sessiya tugashida yozuvlar yashirilishi; bu xatolar ataylab brauzerda taqlid qilingan |
| Desktop va mobil | Edge Chromium, 1440px va 360px: 9 xaridor/ega sahifasi va 9 admin moduli, jami 38 qayd |
| Accessibility | Shu 9 web sahifada WCAG2 A/AA axe avtomatik tekshiruvi: topilma yo‘q. Bu to‘liq qo‘lda screen-reader auditi degani emas |
| AI | Haqiqiy API’da katalog mahsulotini topish, mavjud bo‘lmagan mahsulotga halol bo‘sh javob, prompt-injection rad etilishi o‘tdi |
| Alohida baza | Lokal *_e2e PostgreSQL, 23 migration. Production ma’lumotlari ishlatilmadi |

Muhim aniqlik: checkout va order holatlarini o‘tkazish brauzerning haqiqiy cookie sessiyasida API orqali bajarildi. Barcha qadamlardagi har bir UI tugmasi bosildi degan da’vo yo‘q. Admin modullarining yuklanishi tekshirildi; har bir moderator qarorining barcha kombinatsiyasi bajarilmagan.

Skrinshotlar va maxfiy ma’lumotsiz natija qaydlari: docs/verification/2026-11-06-local-audit/.

## Qoladigan ishlar

1. Firefox va WebKit, haqiqiy Android/iPhone qurilmalarida tekshiruv. Hozirgi mobil sinov — Edge’ning 360px viewport’i.
2. Mahsulot yaratish/media upload, qaytarish/nizo va barcha admin qarorlarini UI orqali boshidan oxirigacha to‘liq kengaytirilgan E2E. Eski ko‘p sotuvchili E2E ssenariylaridan ayrimlari hali yangi modelga moslashtirishni talab qiladi.
3. Go migratsiyasining qolgan bosqichlari va Go/Node parity qayta sinovi. Bu auditda Go testlari qayta bajarilmadi; ishlayotgan backend Nest API.
4. Docker production image’larini qurib ishga tushirish. Bu muhitda Docker executable topilmadi; WSL PostgreSQL/Redis ishlatildi.
5. Staging’da haqiqiy R2 upload/read, email/Telegram, HTTPS/HSTS, backup/restore/rollback va yuklama/pentest tekshiruvlari.
6. Production OWNER_STORE_USERNAME ni o‘sha bazadan aniqlash; audit_owner faqat lokal fixture, serverga ko‘chirilmasin. Serverning mavjud .env fayli saqlansin; .env.example tayyor credential emas.
7. Huquqiy hujjatlarning yangi yagona sotuvchi modeliga mosligi va qaytarish qoidalarini tasdiqlash.

Ushbu natija barcha buglar tugaganini yoki production launch tasdiqlanganini anglatmaydi. Production/SSH/Cloudflare’ga tegilmadi. Eski hisoblar va production fayllari o‘chirilmagan.

## Yakuniy klaviatura tekshiruvi

Admin tasdiqlash oynasida ketma-ket Tab bosish fokusni oyna ichida saqladi. Escape oynani yopdi va fokus uni ochgan tugmaga qaytdi. Shu tuzatishdan keyin admin lint va production build qayta o‘tdi. Ko‘p martalik test loginlari adminning haqiqiy kirish limitini ishga tushirdi; limit zaiflashtirilmadi, yakuniy klaviatura sinovi alohida lokal test admini bilan bajarildi.
