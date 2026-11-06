# DESIGN.md

Manba: `resaller-server-2026-10-30-resale.zip` ichidagi `docs/resale/SPEC.md`, `catalog-client.tsx`, `earnings-client.tsx`, `resale.css` va `globals.css` rang/o‘lcham tokenlari. Faqat yangi resale modeli hisobga olindi. Ushbu ikki sahifaning skrinshotlari arxivda topilmadi; bu kod va CSS asosidagi dizayn auditi, bajarilgan browser yoki vizual test hisoboti emas. Ilova kodi o‘zgartirilmadi.

Quyidagi 9 o‘zgarish bajarish ustuvorligi bilan berilgan. Barcha joylarda mavjud shrift va komponentlar ishlatiladi; yangi kutubxona kerak emas. 360px ekranda sahifa yon chetlari 16px, kontent eni 328px; asosiy matn 16px, yordamchi matn kamida 14px, bosiladigan element kamida 44×44px. Matn va pul summalari kesilmaydi, zarur bo‘lsa yangi qatorga tushadi. Ranglar mavjud theme tokenlaridan olinadi.

## Sahifa: Supplier katalogi
### Muammo
- **1 — Yuqori:** birinchi kirishdagi uzun izoh nima qilish kerakligini bir qarashda anglatmaydi; “supplier” va “Seller Center” oddiy sotuvchi uchun begona atamalar.
- **2 — Yuqori:** kartochkadagi “Do‘koningizda” belgisi ACTIVE va PAUSED holatini ajratmaydi. Ustama chegarasi o‘zgarganda foydalanuvchi mahsulot sotilmayotganini payqamasligi mumkin.
- **3 — O‘rta:** qidirish har o‘zgarishda butun ro‘yxatni skeleton bilan almashtiradi. “Yana ko‘rsatish” yuklanayotganini bildirmaydi; keyingi sahifa xatosi mavjud kartalarni ham yashiradi.

### O‘zgarish
- Element: **1 — Sarlavha ostidagi yo‘riqnoma**.
- Hozir: bitta uzun paragraf, orqaga havola “Seller Center”.
- Bo‘lishi kerak: “Supplier katalogi” nomi saqlansin, ostida “Mahsulot tanlang → Ustama belgilang → Do‘kon havolasini ulashing” uch bosqichi ko‘rsatilsin. 360px da uchta vertikal qator, har biri 16px matn va 24px raqamli belgi, qatorlar oralig‘i 8px. Belgilar foni `--brand-soft`, matni `--text`; tagida 14px `--muted` rangida “Tovarni saqlash va jo‘natish bilan ta’minotchi shug‘ullanadi”. Orqaga havola “Sotuvchi kabineti”, kamida 44px balandlikda.
- Sabab: birinchi harakat va reseller zimmasidagi ish qisqa tushuntiriladi.

- Element: **2 — Mahsulot kartochkasining holati va boshqaruv tugmasi**.
- Hozir: har qanday qo‘shilgan mahsulotda “Do‘koningizda · 15%”, tugmada “Ustamani o‘zgartirish”. Badge foni `--brand-strong`, matni doim oq.
- Bo‘lishi kerak: faol mahsulot uchun “Sotuvda · 15%”, pauza uchun “Pauzada · 15%”; foiz haqiqiy qiymatdan olinadi. Belgi kartochka tanasida nom tepasiga joylashtirilsin: 14px, 6px 10px padding, to‘liq yumaloq chet. Faol holat `--success`, pauza `--warning`, fon tegishli rangning `--surface` bilan 10% aralashmasi. Rangdan tashqari yozuv ham holatni bildiradi. Qo‘shilgan mahsulot tugmasi “Mahsulotni boshqarish”; yangi mahsulotniki “Do‘konimga qo‘shish”, eni 100%, balandligi 48px. Ustamasi yangi chegaradan tashqarida bo‘lsa “Ustamani yangilang” izohi chiqarilsin. Ombor soni alohida “Umumiy omborda: {son} dona” deb berilsin; nol bo‘lsa “Hozir omborda yo‘q”.
- Sabab: qo‘shilganlik sotuvga ochiqlik bilan chalkashmaydi; stock barcha resellerlar uchun umumiyligi aniq bo‘ladi. Supplier mavjud bo‘lmasa, faqat ACTIVE yozuviga qarab sotib olish mumkin deb va’da berilmasin.

- Element: **3 — Qidirish, bo‘sh natija va ko‘proq yuklash**.
- Hozir: har yozishda skeleton, natija topilmaganda faqat tavsiya, yuklash tugmasida jarayon holati yo‘q.
- Bo‘lishi kerak: qidirish va kategoriya 360px da ustma-ust, oralig‘i 8px, balandligi 48px, matni 16px. Yangilashda mavjud kartalar saqlanib, qidiruv ostida “Natijalar yangilanmoqda…” ko‘rsatiladi; muvaffaqiyatda yangi natijaga almashadi. Natija bo‘lmasa 48px “Filtrlarni tozalash” tugmasi. Qo‘shimcha yuklashda tugma “Yuklanmoqda…” bo‘lib vaqtincha o‘chiriladi; xatoda mavjud kartalar qoladi, pastda `--danger` rangida “Keyingi mahsulotlar yuklanmadi” va “Qayta urinish” tugmasi chiqadi. Birinchi yuklash skeletoni saqlanadi.
- Sabab: telefon ekranida miltillash va bir xil so‘rovni qayta bosish kamayadi; xato oldingi natijalarni yo‘qotmaydi.

### Matnlar
- "Seller Center" → "Sotuvchi kabineti"
- "Do‘koningizda · {ustama}" → "Sotuvda · {ustama}" yoki "Pauzada · {ustama}"
- "Ustamani o‘zgartirish" → "Mahsulotni boshqarish"
- "Tavsiya narx" → "Tavsiya etilgan sotuv narxi"
- "Omborda {son} dona" → "Umumiy omborda: {son} dona"

## Sahifa: Supplier katalogi — ustama oynasi
### Muammo
- **4 — Yuqori:** “Har bir sotuvdan foydangiz” asosiy narxdan hisoblanadi; variantlarning narxi farq qilsa bu barcha variant uchun bir xil foyda degan taassurot beradi. Reseller kuponi ham foydani kamaytiradi.
- **5 — Yuqori:** “7 kundan so‘ng to‘lanadi” avtomatik pul o‘tkazilishini va’da qiladi; aslida to‘lov alohida so‘raladi. Tugmalar pastda qolib, telefonda ortiqcha aylantirish talab qilishi mumkin.
- **6 — O‘rta:** pauza bosilganda kod saqlanmagan ustamani ham jo‘natadi; o‘chirish esa standart browser tasdiqlash oynasini ochadi.

### O‘zgarish
- Element: **4 — Narx va foyda bloki, variantlar**.
- Hozir: asosiy ulgurji narx, “Sizning narxingiz”, katta foyda; variantlar yopiq ro‘yxatda, faqat sotuv narxi va qoldiq bor.
- Bo‘lishi kerak: oynada ketma-ket mahsulot nomi → ustama boshqaruvi → narx va foyda → variantlar → izoh → amallar. “Ustama: {foiz}” 18px, slayderning bosish maydoni 44px, mavjud ruxsat etilgan min/max saqlanadi. Foyda bloki `--surface-2`, 16px padding, 16px radius; “Xaridor to‘laydigan narx” 18px va `--text`, foyda summasi 32px va `--success`, alohida qatorda. Yagona narxli mahsulotda “Bir dona uchun foyda”, narxi turlicha variantlarda “Asosiy narx bo‘yicha foyda” yozilsin. Tagida “Kupon chegirmasi bo‘lsa, foydangiz shuncha kamayadi” 14px `--muted`. Variantlar bo‘limi “Variantlar narxi va foydasi”; har variant 360px da vertikal blok: nom, sotuv narxi, foyda, ombor soni; 3 ustunli siqilgan jadval ishlatilmasin. Hisoblash SPEC dagi mavjud pul hisoblash qoidasidan olinadi, yangi formula kiritilmaydi.
- Sabab: foyda aniq ko‘rinadi va taxminiy summa barcha sotuvga kafolatdek taqdim qilinmaydi.

- Element: **5 — Oyna pastidagi asosiy amal va to‘lov izohi**.
- Hozir: tugmalar umumiy oqimda, “Ustamangiz buyurtma yakunlangach 7 kundan so‘ng to‘lanadi”.
- Bo‘lishi kerak: mobil oynaning maksimal balandligi 92dvh saqlanadi; sarlavha/yopish va pastki asosiy tugma ko‘rinadigan, o‘rta kontent aylantiriladigan bo‘lsin. Pastki panel `--surface`, ustki chegara `--line`, 16px padding va telefon safe-area bo‘shlig‘i. Asosiy tugma 100% en, 48px balandlik, mavjud `.rs-button` ranglari. Amal vaqtida “Qo‘shilmoqda…” yoki “Saqlanmoqda…”, xato tugma oldida `--danger`, foydalanuvchi tanlagan ustama saqlanadi. Izoh: “Buyurtmani ta’minotchi 60 daqiqa ichida qabul qilishi kerak va o‘zi jo‘natadi. Buyurtma yakunlangach 7 kun o‘tib, qaytarish yoki ochiq nizo bo‘lmasa, daromad to‘lov so‘rashga tayyor bo‘ladi. Kamida 50 000 so‘m yig‘ilganda to‘lov so‘raysiz”. Yopish 44×44px, klaviatura fokusi oyna ichida va yopilganda ochgan tugmaga qaytadi.
- Sabab: to‘lov sharti to‘g‘ri tushuntiriladi va telefonda asosiy amal topiladi.

- Element: **6 — Pauza va olib tashlash amallari**.
- Hozir: “Pauza” ham yangi slayder qiymatini saqlaydi; o‘chirish `window.confirm` bilan.
- Bo‘lishi kerak: “Sotuvni to‘xtatish” ikkilamchi 48px tugma bo‘lsin va faqat holatni o‘zgartirsin; ustama alohida saqlanadi. “Do‘kondan olib tashlash” 44px bosish maydonli `--danger` matn, asosiy tugmadan kamida 16px ajratilsin. Shu oyna ichida tasdiq holati ochilsin: “Mahsulot do‘koningizdan olib tashlansinmi?” va “Mahsulot xaridorlar savatidan ham olib tashlanadi”. Tugmalar: “Bekor qilish” va “Olib tashlash”, telefonda ustma-ust, 48px. Pauzani qayta faollashtirishdagi mavjud “Saqlash va faollashtirish” saqlansin: bu amal ikki o‘zgarishni ochiq bildiradi.
- Sabab: xavfsiz pauza kutilmagan narx o‘zgarishiga olib kelmaydi; olib tashlash oqibati tushunarli bo‘ladi.

### Matnlar
- "Sizning narxingiz" → "Xaridor to‘laydigan narx"
- "Har bir sotuvdan foydangiz" → "Bir dona uchun foyda" yoki "Asosiy narx bo‘yicha foyda"
- "Variantlar narxi ({son})" → "Variantlar narxi va foydasi ({son})"
- "Pauza" → "Sotuvni to‘xtatish"
- "Ustamangiz buyurtma yakunlangach 7 kundan so‘ng to‘lanadi." → "Buyurtma yakunlangach 7 kun o‘tib, qaytarish yoki ochiq nizo bo‘lmasa, daromad to‘lov so‘rashga tayyor bo‘ladi."

## Sahifa: Daromadlarim
### Muammo
- **7 — Yuqori:** “Hozir yechib olish mumkin” darhol pul keladigandek tuyuladi. `availableMinor − payableMinor` natijasi doimo 7 kunlik ushlab turilgan summani anglatishi kafolatlanmagan; to‘lov so‘rovidagi yoki nizo sabab bloklangan summalar alohida ajratilishi kerak.
- **8 — Yuqori:** to‘lov shakli chegara yetmasa butunlay yo‘qoladi; owner-only qoidasini ekranda tushuntirish ko‘rinmaydi. Naqd uchun “Chilonzor ofisidan olaman” misoli tasdiqlanmagan ofis borligini anglatadi.
- **9 — O‘rta:** sotuv summasi va foyda bir-biridan yaxshi ajratilmagan; “{sana} dan to‘lanadi” to‘lov sanasini va’da qiladi. Uzun buyurtma raqami, summa va rad etish sababi ikki ustunda siqilishi mumkin.

### O‘zgarish
- Element: **7 — Balans kartasi va daromad holatlari**.
- Hozir: katta yechish summasi va uchta yordamchi jami.
- Bo‘lishi kerak: katta summa `--success`, 32px, yorliq “To‘lov so‘rashga tayyor”. 360px da `so‘m` birlik belgisi kerak bo‘lsa keyingi qatorga o‘tadi; summa kesilmaydi. Pastda 16px oraliq bilan “Kutilmoqda”, “7 kunlik kutish muddati”, “To‘lov so‘rovida”, “Jami to‘langan” qatorlari; yorliqlar 14px `--muted`, summalar 16px `--text`. Har summa o‘z holati bo‘yicha server tasdiqlagan jami bilan ko‘rsatiladi; sahifalangan ro‘yxatdan jami yasalmaydi va `available − payable` taxminan “7 kun” deb nomlanmaydi. API aniq bo‘linishni bermasa, vaqtincha “Hozir so‘rab bo‘lmaydigan daromad” deb ataladi, izohida “Kutish muddati yoki boshqa cheklovlar bo‘lishi mumkin” yoziladi; mavjud bo‘lmagan jami o‘ylab chiqarilmaydi. Nizo bo‘yicha sabab faqat tegishli ma’lumot mavjud bo‘lsa chiqariladi.
- Sabab: bir summa ikki marta hisoblangandek ko‘rinmaydi, texnik AVAILABLE holati to‘lashga tayyorlik bilan tenglashtirilmaydi.

- Element: **8 — To‘lov so‘rashning barcha holatlari**.
- Hozir: shakl faqat summa yetarli va ochiq so‘rov yo‘qligida ko‘rinadi; alohida “yuborilmoqda” matni yo‘q.
- Bo‘lishi kerak: balans tagida doim tushunarli keyingi qadam bo‘lsin. Minimumga yetmasa “Eng kam to‘lov: 50 000 so‘m” va “Yana {yetishmayotgan summa} kerak”; summa server minimumidan olinadi. Ochiq so‘rov bo‘lsa “{summa} uchun so‘rov ko‘rib chiqilmoqda”, ikkinchi so‘rov shakli chiqmaydi. Faqat do‘kon egasi to‘lov so‘rashi mumkin; menejerga “To‘lovni faqat do‘kon egasi so‘rashi mumkin” ko‘rsatiladi, ruxsatsiz tugma ko‘rsatilmaydi. Formada 48px ikki tanlov: “Kartaga” va “Naqd”; maydonlar 16px matnli, balandligi 48px. Karta uchun faqat oxirgi 4 raqam va egasi; to‘liq raqam, amal qilish muddati, CVV so‘ralmaydi. Naqd izohi placeholderi “Pulni olish bo‘yicha izohingiz”, tagida “Olish tartibi siz bilan alohida kelishiladi”. Yuborish tugmasi “{summa} uchun to‘lov so‘rash”, jarayonda “So‘rov yuborilmoqda…”. Muvaffaqiyatda “So‘rov yuborildi. To‘lov qo‘lda amalga oshiriladi; holatini quyida kuzating”. Xato maydon yonida yoki tugma oldida, kiritilgan qiymatlar saqlanadi.
- Sabab: foydalanuvchi nima uchun to‘lov so‘ray olmayotganini tushunadi; ruxsat va qo‘lda to‘lash qoidalari buzilmaydi.

- Element: **9 — Sotuvlar va to‘lovlar tarixi**.
- Hozir: buyurtma jami va foyda bir qatordagi zich blokda, kutish uchun sana avtomatik to‘lovdek yozilgan.
- Bo‘lishi kerak: sotuv kartasi 16px vertikal padding, pastki chegara `--line`; yuqorida buyurtma raqami 16px, pastda sana 14px `--muted`, keyin holat va alohida “Sizning daromadingiz: +{summa}” 18px. Buyurtma jami yordamchi 14px matn sifatida “Buyurtma summasi: {summa}”. 360px da summa alohida qatorga chiqadi. Holatlar: “Kutilmoqda”, “7 kunlik kutish muddati”, “To‘lashga tayyor”, “To‘lov so‘rovida”, “To‘langan”, “Bekor qilingan”. Kelajakdagi availableAt uchun “{sana} dan so‘rash mumkin”; sana o‘tgan, ammo payable=false bo‘lsa avtomatik tayyor deb yozilmasin: ma’lum sabab yoki “Hozircha to‘lov so‘rab bo‘lmaydi”. Bekor qilingan summa ustidan chizilgan va `--muted`; tayyor/to‘langan `--success`, kutish `--warning`, barcha holatlar yozuv bilan. To‘lovlar tarixida so‘rov sanasi va mavjud bo‘lsa qaror sanasi alohida, rad etish sababi to‘liq o‘raladigan qatorda; reference va uzun matn kartadan chiqib ketmasin.
- Sabab: savdo aylanmasi reseller foydasiga teng deb qabul qilinmaydi va tarix telefonda o‘qiladi.

### Matnlar
- "Hozir yechib olish mumkin" → "To‘lov so‘rashga tayyor"
- "Buyurtma yakunlanishini kutmoqda" → "Kutilmoqda"
- "Ushlab turilgan (7 kun)" → "7 kunlik kutish muddati" — faqat haqiqiy shu holat summasi bo‘lsa
- "{sana} dan to‘lanadi" → "{sana} dan so‘rash mumkin" — faqat muddat hali kelmagan bo‘lsa
- "{summa} so‘rash" → "{summa} uchun to‘lov so‘rash"
- "Masalan: Chilonzor ofisidan olaman" → "Pulni olish bo‘yicha izohingiz"

Qabul mezoni: 360px va desktopda light/dark holatlar, uzun mahsulot/variant nomi, katta summa, pauza, nol stock, yuklanish va xatolar tekshirilsin. Daromadda 49 999/50 000 so‘m chegarasi, ochiq so‘rov, menejer/egasi, 7 kun oldi/keyini, nizo va rad etish holatlari tekshirilsin. Bu hujjat testlar o‘tganini bildirmaydi. Buyer ekranlariga ulgurji narx, ustama yoki supplier ma’lumoti qo‘shilmaydi; reseller uchun media/stock tahrirlash ochilmaydi; avtomatik to‘lov yoki yangi moliyaviy qoida kiritilmaydi.

## Claude tekshiruvi (texnik izohlar)

Tasdiqlangan. Bajarishda quyidagilarni hisobga ol:

1. Backend o'zgarishi kerak (7 va 8-band uchun):
   GET /seller-center/stores/:storeId/earnings javobiga qo'shilsin:
   - totals.holdMinor — AVAILABLE, payoutId yo'q, availableAt > hozir
   - totals.requestedMinor — AVAILABLE, payoutId bor (ochiq so'rovda)
   - canRequestPayout — faqat do'kon egasi uchun true
   "available − payable" frontendda hisoblanmasin. Integratsion testga
   bu summalar tekshiruvi qo'shilsin.
2. Pauza xatosi (6-band): "Sotuvni to'xtatish" PATCH'ga faqat
   { status: 'PAUSED' } yuborsin, markupBps yubormasin.
3. Yuklashda xato (3-band): keyingi sahifa xatosi mavjud kartalarni
   yashirmasin; birinchi yuklash va keyingi yuklash holati alohida bo'lsin.
4. Atamalar: sahifa nomi "Supplier katalogi" qoladi, matn ichida
   "ta'minotchi" ishlatiladi. Hamma joyda bir xil bo'lsin.
5. Foyda hisobi resale-api.ts dagi resellerPrice() orqali (API bilan
   bir xil formula). Variant foydasi = variant sotuv narxi − variant ulgurji narxi.
6. Tugagach: pnpm check yashil bo'lsin, HANDOFF.md ga yozuv qo'shilsin.
