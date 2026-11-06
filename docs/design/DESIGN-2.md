# DESIGN-2.md

Sana: 2026-10-31. Dizayn auditi; ilova kodi o‘zgartirilmadi.

Manba: mavjud eng yangi `resaller-server-2026-10-31-fixed.zip` va undan ochilgan `resaller-local-2026-10-31` nusxasi. `docs/resale/HANDOFF.md` 2 va 4-yozuvlari o‘qildi; ulardagi “testlar yashil” bayonoti bu auditda mustaqil qayta tasdiqlanmadi. Ushbu so‘rovda boshqa yangi arxiv yo‘li kelmagan. Agar bundan yangi nusxa bo‘lsa, ushbu xulosalar aynan unga tegishli deb hisoblanmasin.

Tekshirilgan fayllar: `docs/design/DESIGN.md`, `docs/resale/HANDOFF.md`, `apps/web/app/seller/center/[storeId]/catalog/catalog-client.tsx`, `earnings/earnings-client.tsx`, `apps/web/app/resale.css`, `apps/web/app/orders/[id]/page.tsx`, `apps/admin/app/payouts/page.tsx`, admin `globals.css`. “Bajarilgan” kodda ko‘rinadigan amalga oshirishni bildiradi; 360px browser, klaviatura va vizual qabul testi o‘tkazilganini bildirmaydi.

## Sahifa: Supplier katalogi va Daromadlarim — oldingi 9 band tekshiruvi

### Muammo
- **1. Yo‘riqnoma — bajarilgan; yuqori.** `resale-steps` ichida uch bosqich bor; orqaga havola “Sotuvchi kabineti”. CSS 560px gacha vertikal yo‘nalish, 24px belgilar va 8px qator oralig‘ini beradi.
- **2. Kartochka holati — bajarilgan; yuqori.** `CatalogCard` ACTIVE/Pauzada yozuvini ajratadi, badge nomdan yuqorida, `outsideWindow` ogohlantirishi va umumiy stock matni bor. Boshqaruv tugmasi to‘g‘ri, CSS 48px balandlikni beradi. Holat mahalliy ACTIVE qiymatiga asoslangan; real sotib olish imkonini bu komponentning o‘zi tekshirmaydi.
- **3. Qidiruv/yuklash — bajarilgan; o‘rta.** `initialError`, `refreshError`, `loadingMore`, `moreError` alohida. Refresh va keyingi sahifa xatosida kartalar qoladi, qayta urinish va filtrlarni tozalash bor. Bu eski talabning bajarilishi; parallel so‘rovlar tartibi browserda sinab ko‘rilmagan.
- **4. Foyda va variantlar — qisman bajarilgan; yuqori.** Slayder narxdan oldin, foyda 32px, kupon izohi va har variant foydasi bor. Lekin `variedPrices` faqat variant narxlarining o‘zaro farqini tekshiradi. Bitta variantning override narxi asosiy narxdan farq qilsa, yoki barcha variantlar bir xil override bilan asosiy narxdan farq qilsa, sarlavha “Bir dona uchun foyda” bo‘lib qoladi, summa esa asosiy narxdan olinadi. Bitta variantda tafsilot ham ochilmaydi (`variants.length > 1`).
- **5. Oyna va to‘lov izohi — bajarilgan; yuqori.** Header/body/footer ajratilgan, tana aylantiriladi, 92dvh limit va safe-area padding bor. Qo‘shish/saqlash jarayon matni, footerda xato va to‘g‘ri 7 kun/minimum izohi bor. Native dialog va ochgan elementga fokus qaytarish chaqirig‘i mavjud; ishlashini browserda tasdiqlash qoladi.
- **6. Pauza/o‘chirish — bajarilgan; o‘rta.** `pause()` faqat `{ status: 'PAUSED' }` yuboradi. O‘chirish native confirm o‘rniga oyna ichida tasdiqlanadi; oqibat matni va ikki 48px tugma bor. Tasdiq holatiga kirganda alohida fokus ko‘chirish yozilmagan — klaviatura qabulida tekshirilsin.
- **7. Balanslar — bajarilgan; yuqori.** `holdMinor` va `requestedMinor` alohida olinadi, `available − payable` hisoblash yo‘q. To‘rtta holat qatori, 32px katta summa, o‘raladigan matn va mobil bir ustun CSS bor. Ushbu belgi frontend ko‘rsatishiga tegishli; server aggregatlarining haqiqiy ma’lumot bilan to‘g‘riligi qayta sinovdan o‘tkazilmadi.
- **8. To‘lov so‘rash — bajarilgan; yuqori.** `canRequestPayout`, ochiq so‘rov va minimum tekshiriladi; menejerga izoh bor. Karta faqat oxirgi 4 raqam/ism, naqd izohi to‘g‘ri, 48px maydonlar, busy matni va xatoda qiymatlarni saqlash mavjud.
- **9. Tarix — bajarilgan; o‘rta.** Sotuv jami daromaddan alohida, sana va qaror sanasi chiqariladi, bekor qilingan summa chiziladi. Holat matni avtomatik to‘lovni va’da qilmaydi; payout reference/sabab o‘raladi. `earningState` muddati o‘tgan, ammo payable=false holatida “Hozircha to‘lov so‘rab bo‘lmaydi” deydi.

### O‘zgarish
- Element: **Yangi 1-band — variantga mos foyda. Muhimlik: yuqori.**
- Hozir: yuqoridagi foyda doim asosiy listing narxidan; ayrim override holatlarida variant summasi bilan mos emas.
- Bo‘lishi kerak: yagona sotiladigan variant bo‘lsa, narx/foyda shu variantning haqiqiy ulgurji narxidan ko‘rsatilsin. Bir nechta turlicha narx bo‘lsa asosiy blok “Asosiy narx bo‘yicha foyda”, variantlar esa nom, xaridor narxi va foyda bilan alohida ko‘rsatilsin. Asosiy narx variantlarga teng bo‘lmagan har bir holatda bu tafovut yashirilmasin. Hisob mavjud `resellerPrice()` qoidasi bilan. 360px da har variant bir ustun, 16px asosiy matn, foyda `--success`, katta summa 32px; yangi formula yoki biznes qoida yo‘q.
- Sabab: reseller qaror qabul qilayotgan foyda summasi sotiladigan mahsulotga mos bo‘lishi kerak.

### Matnlar
- “Bir dona uchun foyda” → yagona variant uchun haqiqiy variant summasi bilan shu matn; umumiy baza uchun “Asosiy narx bo‘yicha foyda”.
- “Variantlar narxi va foydasi” → saqlanadi; zarur bo‘lsa yagona override variant tafsiloti ham ko‘rsatiladi.

## Sahifa: Buyurtma — ta’minotchi

### Muammo
- **Yuqori:** DOM tartibi manzil → countdown → mahsulotlar → tarix → qoidalar → o‘zgarishlar → amallar. 360px da ta’minotchining asosiy qabul qilish tugmasi barcha shu bloklardan keyin keladi. `page.tsx` 438–461-qatorlarda manzil/taymer, 631-qator atrofida asosiy amal bor.
- `sellerTransition()` uchun yuborilmoqda holati yo‘q; taymer nolga tushganda amallarni qayta baholash/yangilash ko‘rinmaydi. Holatni yangilashdan keyin mahalliy `status: to` yoziladi.
- Telefon `tel:` havola, ammo oddiy kichik matn; manzilni nusxalash yo‘q.

### O‘zgarish
- Element: **Yangi 2-band — qabul qilish va holat boshqaruvi. Muhimlik: yuqori.**
- Hozir: “Keyingi ruxsat etilgan amal” blokidagi “... holatiga o‘tkazish” tugmasi sahifaning pastki qismida.
- Bo‘lishi kerak: ta’minotchi uchun sarlavhadan so‘ng taymer va “Buyurtmani qabul qilish” bir blokda, keyin manzil, keyin mahsulotlar. 360px da birlamchi amal 48px va 100% en; uzun sahifada pastga yopishgan nusxasi bo‘lishi mumkin, kontent uchun uning balandligicha joy va safe-area qoldirilsin. Fon `--surface`, chegara `--line`, taymer `--warning`, tugma mavjud `.rs-button`. Amal davomida “Qabul qilinmoqda…” va barcha qarama-qarshi holat tugmalari o‘chiriladi. Nol vaqtda “Muddat tugadi. Holat tekshirilmoqda…”; server natijasi kelmaguncha muvaffaqiyat deb ko‘rsatilmasin. Server tasdiqlagan keyingi holatga qarab “Tayyorlashni boshlash”, “Jo‘natishga tayyor”, “Jo‘natildi deb belgilash” kabi fe’llar. Yetkazildi/yakunlandi o‘tishiga tegishli rol huquqi backend bilan tekshirilsin, UI yangi huquq bermasin.
- Sabab: 60 daqiqalik amal birinchi ekranda topiladi; takror bosish va noto‘g‘ri mahalliy holat taassuroti kamayadi.

- Element: **Yangi 3-band — jo‘natish uchun manzil kartasi. Muhimlik: yuqori.**
- Hozir: ism, telefon, manzil `text-sm` ichida inline maydonlar.
- Bo‘lishi kerak: “Yetkazish ma’lumotlari” kartasi 16px padding, vertikal 12px oraliq; yorliq 14px `--muted`, qiymat 16px `--text`, uzun manzil o‘raladi. “Qo‘ng‘iroq qilish” va “Manzilni nusxalash” kamida 44px, 360px da ustma-ust. Nusxalanadigan matn qabul qiluvchi, telefon va to‘liq manzilni oladi. Qiymat yetishmasa bo‘sh `tel:` havola emas, “Telefon ko‘rsatilmagan” yoki “Manzil ma’lumoti yetishmaydi” yozuvi va mavjud support yo‘li; xaritani koordinata bo‘lmasa taxminiy ochmaslik. Ta’minotchiga chat o‘rnidagi uzun bo‘sh panel emas, shu karta ostida 14px izoh: “Xaridor bilan reseller yozishadi. Jo‘natish uchun yuqoridagi ma’lumotlardan foydalaning”.
- Sabab: ta’minotchi bir ekranda qabul qilib, jo‘natish ma’lumotini amalda ishlata oladi.

### Matnlar
- “Keyingi ruxsat etilgan amal” → “Buyurtmani boshqarish”.
- “... holatiga o‘tkazish” → tegishli aniq amal, masalan “Buyurtmani qabul qilish”.
- Ta’minotchi uchun “Sotuvchi tasdig‘i uchun qolgan vaqt” → “Qabul qilish uchun qolgan vaqt”.
- Ta’minotchining “Xususiy chat” sarlavhasi → olib tashlanadi, jo‘natish kartasi ostida rol izohi qoladi.

## Sahifa: Buyurtma — xaridor va reseller

### Muammo
- Xaridorga ta’minotchi izohi `viewerRole === 'SELLER'` orqali yashirilgan. Ulgurji narx/ustama esa faqat `resellerMarginMinor !== undefined` sharti bilan render qilinadi; frontendda qo‘shimcha rol sharti yo‘q. Bu o‘z-o‘zicha API sizib chiqishini isbotlamaydi.
- Resellerning fulfilment tugmalari `sellerActs` bilan yashirilgan — to‘g‘ri. Lekin “Sharh yozish” faqat COMPLETED va review yo‘qligiga qaraydi, BUYER sharti yo‘q.
- Telefon tartibida chat mahsulot, tarix va qoidalardan keyin. Xaridor va reseller uchun tez chatga o‘tish yo‘li yo‘q. Ta’minotchi chat/SSE’dan chiqarilgan, biroq focus/visibility handler `/messages/read` ni `canChat` tekshiruvisiz chaqiradi.

### O‘zgarish
- Element: **Yangi 4-band — rolga mos buyurtma ko‘rinishi. Muhimlik: yuqori.**
- Hozir: umumiy tarkib, kichik ulgurji/ustama matni, umumiy review tugmasi va pastdagi chat.
- Bo‘lishi kerak: xaridorga yuqorida holat va “Sotuvchiga yozish”, keyin xaridor narxlari/manzil/tarix; supplier yoki ulgurji ma’lumot hech qayerda chiqmasin. Review amali faqat BUYER va amaldagi ruxsatda. Resellerga “Buyurtmani ta’minotchi jo‘natadi” izohi va “Xaridorga yozish” 48px tugmasi; fulfilment amali yo‘q. Har ikki ruxsatli rolda chat tugmasi chat blokiga olib boradi va xabar maydoniga fokus beradi. Ta’minotchi uchun chatga oid read so‘rovlari ham qilinmasin. Ulgurji va ustama faqat server ruxsat bergan seller ma’lumotida hamda seller roli sharti bilan; 360px mahsulot kartasi vertikal: nom × son, “Bir dona narxi”, “Ulgurji narx / dona”, “Ustama / dona”. Pul birligi “so‘m”, miqdor va jami aniq ajratiladi. Matn 16px, yordamchi 14px, `--text`/`--muted`, margin `--success`. Frontend yashirishi backend himoyasini almashtirmaydi.
- Sabab: har bir odam faqat o‘z ishini bajaradi; reseller foydasi va xaridor summasi chalkashmaydi.

### Matnlar
- Xaridor uchun “Xususiy chat” → “Sotuvchi bilan yozishma”.
- Reseller uchun “Xususiy chat” → “Xaridor bilan yozishma”.
- “ulgurji ..., ustama +...” → “Ulgurji narx / dona: ... so‘m” va “Ustama / dona: +... so‘m”.
- Xaridor taymeri “Sotuvchi tasdig‘i uchun qolgan vaqt” bo‘lib qoladi — ichki ta’minotchi oshkor qilinmaydi.

## Sahifa: Admin — Reseller to‘lovlari

### Muammo
- Alohida tasdiq oynasi, reference/sabab majburiyligi, `consistent=false` da PAID tugmasini o‘chirish va avtomatik to‘lov yo‘qligi izohi bor — yaxshi asos.
- Yakuniy dialogda faqat do‘kon nomi va summa bor: username, so‘rov raqami, karta/naqd va rekvizit qayta ko‘rsatilmaydi. “O‘tkazma raqami yoki izoh” kartaga to‘lov uchun oddiy izohni ham qabul qilishga undaydi.
- `busy` faqat submitni o‘chiradi; dialog tashqarisiga bosish va “Bekor qilish” yuborish davomida ham uni yopadi. Dialog `div/form` va ARIA atributlaridan iborat; fokusni ushlash, Escape va fokusni qaytarish boshqaruvi ko‘rinmaydi.
- Ro‘yxat `load()` ichida tarmoq istisnosini ushlamaydi; “Yuklanmoqda…” qolishi mumkin. Do‘konni SUPPLIER qilish formasi ham pul qarorlari bilan bitta sahifada, publicId qo‘lda kiritiladi.

### O‘zgarish
- Element: **Yangi 5-band — pul berilganini yakuniy qayd qilish. Muhimlik: yuqori.**
- Hozir: nom/summa va “O‘tkazma raqami yoki izoh” maydoni, “To‘landi” tugmasi.
- Bo‘lishi kerak: dialogda do‘kon nomi + @username, so‘rov publicId, summa 24px, usul va mavjud oluvchi/oxirgi 4 raqam takror ko‘rsatilsin. To‘liq karta raqami talab qilinmasin. CARD uchun “O‘tkazma raqami”, CASH uchun “Naqd topshirilganini qayd etish izohi”. Ikki holatda ham “Pulni oldindan o‘tkazdim yoki topshirdim” tasdiqlash katagi, kamida 44px label. Pastda “Bu amal pul yubormaydi, amalga oshirilgan to‘lovni qayd etadi”. Yakuniy tugma “{summa} to‘langanini qayd etish”, 48px, yonida/yoki pastida ikkilamchi “Bekor qilish”. 360px da barcha ma’lumot bir ustun; uzun ID o‘raladi. Rad etishda alohida sarlavha va sotuvchiga ko‘rinadigan sabab, to‘lovni tasdiqlash katagi kerak emas. Bu UI tasdiqi mavjud server consistency/authorization tekshiruvlarini saqlaydi.
- Sabab: noto‘g‘ri do‘kon yoki hali o‘tkazilmagan pulni tasdiqlash ehtimoli kamayadi.

- Element: **Yangi 6-band — dialog va javobi noma’lum amal. Muhimlik: yuqori.**
- Hozir: yuborishda dialogni yopish mumkin; `load()` tarmoq xatosining alohida retry holati yo‘q.
- Bo‘lishi kerak: tasdiqlashda “Qayd etilmoqda…”; submit, bekor qilish va tashqaridan yopish vaqtincha o‘chiriladi. Javob yo‘qolsa “Natija tekshirilmoqda” va serverdagi so‘rov holatini yangilash; pulni yana o‘tkazishga undamasin. Xato dialog ichida, maydonlar saqlanadi. Ro‘yxat xatosida “To‘lovlar yuklanmadi” + “Qayta urinish”, uni bo‘sh ro‘yxat bilan tenglashtirmaslik. Dialog ochilganda fokus ichiga, Tab oyna ichida, idle holatda Escape yopadi, yopilganda asl tugmaga qaytadi. 360px da eni ekran minus 32px, balandligi 85dvh, tana aylantiriladi, tugmalar 48px va ustma-ust. Mavjud `--surface`, `--text`, `--line`, `--danger`, `--warning` tokenlari ishlatilsin. Admin `globals.css` ko‘rilgan variantida web tokenlari ta’riflanmagan: implementatsiyada webdagi mavjud token qiymatlari admin tomonidan ham ulanishi shart; aniqlanmagan `var()` qo‘shib qo‘yilmasin.
- Sabab: operator natijani yo‘qotmaydi, tarmoq xatosi ikki marta pul jo‘natishga sabab bo‘lmaydi.

- Element: **Yangi 7-band — ta’minotchi do‘konini belgilash. Muhimlik: o‘rta.**
- Hozir: to‘lovlar pastida publicId, tur va sababdan iborat darhol yuboriladigan forma.
- Bo‘lishi kerak: alohida “Do‘kon sozlamalari” bo‘limiga ko‘chirilsin. ID kiritilgach serverdan topilgan do‘kon nomi, @username, joriy va yangi turi tasdiq kartasida ko‘rsatilsin; topilmagan ID bilan amal bo‘lmasin. SUPPLIER ga o‘tishda “Bu do‘kon mahsulotlari xaridor katalogida ko‘rinmaydi” izohi. “Do‘kon turini o‘zgartirish” tugmasi 48px, busy holati va shu formaga tegishli xato; 360px da bitta ustun, 16px padding. SUPER_ADMIN ruxsati saqlanadi.
- Sabab: pul to‘lash va do‘konning ko‘rinishini o‘zgartirish ikki alohida vazifa; xato ID oqibati oldindan ko‘rinadi.

### Matnlar
- “To‘lovni tasdiqlash” → “Amalga oshirilgan to‘lovni qayd etish”.
- “O‘tkazma raqami yoki izoh” → CARD: “O‘tkazma raqami”; CASH: “Naqd topshirilganini qayd etish izohi”.
- “To‘landi” (yakuniy tugma) → “{summa} to‘langanini qayd etish”.
- “Supplier do‘koni” → “Ta’minotchi do‘koni” (admin sozlamasida; reseller sahifasi “Supplier katalogi” nomida qoladi).

Chegara: ushbu hujjat 7 ta yangi ustuvor o‘zgarish beradi. Screenshot/render bo‘lmagani uchun ekran elementlarining amaldagi kesilishi, kontrasti yoki fokus ishlashi bo‘yicha “testdan o‘tdi” xulosasi berilmaydi. Tayyor bo‘lganda buyer/reseller/supplier rollari va adminning CARD/CASH, inconsistent, busy, tarmoq uzilishi holatlari 360px hamda desktopda tekshirilsin. Online payment, avtomatik payout yoki yangi reseller tahrirlash huquqi qo‘shilmaydi.
