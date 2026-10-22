// The resident app's own text in English and Bahasa Melayu. The staff dashboard (/insights) stays English.
// The language comes from the profile (or the welcome screen before there is one): see account.ts.
// Placeholders look like {name}. Keep both languages of a string side by side.
import { useCallback } from "react";
import type { Language } from "./account";
import { useAccount } from "./hooks/useAccount";

type Entry = { en: string; ms: string };

const S = {
  // --- app shell ---
  "app.skip": { en: "Skip to content", ms: "Langkau ke kandungan" },
  // The offline banner is three parts so the middle one can be bold.
  "app.offline1": { en: "Can't reach the BeeAble server, so you're seeing", ms: "Pelayan BeeAble tidak dapat dihubungi, jadi anda melihat" },
  "app.offline2": { en: "sample data", ms: "data contoh" },
  "app.offline3": {
    en: ". Reports you send now won't reach staff.",
    ms: ". Laporan yang dihantar sekarang tidak akan sampai kepada staf.",
  },
  "tab.navigate": { en: "Navigate", ms: "Navigasi" },
  "tab.report": { en: "Report", ms: "Lapor" },
  "tab.staff": { en: "Staff", ms: "Staf" },
  "tab.main": { en: "Main", ms: "Utama" },

  // --- account menu ---
  "menu.guest": { en: "Guest", ms: "Tetamu" },
  "menu.you": { en: "You", ms: "Anda" },
  "menu.account": { en: "Account: {name}", ms: "Akaun: {name}" },
  "menu.guestNote": { en: "No account · on this phone", ms: "Tiada akaun · pada telefon ini" },
  "menu.savedNote": { en: "Saved on this phone", ms: "Disimpan pada telefon ini" },
  "menu.editProfile": { en: "Edit profile", ms: "Edit profil" },
  "menu.leaveGuest": { en: "Leave guest mode", ms: "Keluar mod tetamu" },
  "menu.logOut": { en: "Log out", ms: "Log keluar" },

  // --- welcome ---
  "landing.heading": { en: "Get around campus without the guesswork", ms: "Bergerak di kampus tanpa meneka-neka" },
  "landing.lead": {
    en: "Walking routes shaped by how you move, and a quick way to flag what's in the way.",
    ms: "Laluan jalan kaki mengikut cara anda bergerak, dan cara pantas untuk melaporkan halangan.",
  },
  "landing.p1.title": { en: "Routes that fit you", ms: "Laluan yang sesuai dengan anda" },
  "landing.p1.text": {
    en: "Step-free or easy walking, with a plain reason for every turn.",
    ms: "Tanpa tangga atau jalan mudah, dengan sebab yang jelas untuk setiap pilihan.",
  },
  "landing.p2.title": { en: "Report a barrier in seconds", ms: "Laporkan halangan dalam beberapa saat" },
  "landing.p2.text": {
    en: "Snap a photo and add a few words in BM or English.",
    ms: "Ambil gambar dan tambah beberapa patah perkataan dalam BM atau English.",
  },
  "landing.p3.title": { en: "AI checks, staff fix", ms: "AI menyemak, staf membaiki" },
  "landing.p3.text": {
    en: "Fixed barriers update everyone's routes straight away.",
    ms: "Halangan yang dibaiki terus mengemas kini laluan semua orang.",
  },
  "landing.register": { en: "Create an account", ms: "Cipta akaun" },
  "landing.login": { en: "Log in", ms: "Log masuk" },
  "landing.guest": { en: "Continue without an account", ms: "Teruskan tanpa akaun" },
  "landing.privacy": {
    en: "Your details stay on this phone. Reports are always anonymous.",
    ms: "Butiran anda kekal pada telefon ini. Laporan sentiasa tanpa nama.",
  },
  "landing.language": { en: "Language", ms: "Bahasa" },

  // --- log in / register ---
  "auth.back": { en: "Back", ms: "Kembali" },
  "auth.registerTitle": { en: "Create your account", ms: "Cipta akaun anda" },
  "auth.loginTitle": { en: "Welcome back", ms: "Selamat kembali" },
  "auth.registerLead": {
    en: "It's saved on this phone only, so the app remembers how you get around.",
    ms: "Ia disimpan pada telefon ini sahaja, supaya aplikasi ingat cara anda bergerak.",
  },
  "auth.loginLead": {
    en: "Log in with the account you made on this phone.",
    ms: "Log masuk dengan akaun yang anda cipta pada telefon ini.",
  },
  "auth.replaceWarning": {
    en: "This phone already has an account. Creating a new one replaces it.",
    ms: "Telefon ini sudah ada akaun. Mencipta akaun baharu akan menggantikannya.",
  },
  "auth.loginInstead": { en: "Log in instead", ms: "Log masuk sahaja" },
  "auth.name": { en: "Your name", ms: "Nama anda" },
  "auth.email": { en: "Email", ms: "E-mel" },
  "auth.password": { en: "Password", ms: "Kata laluan" },
  "auth.show": { en: "Show password", ms: "Tunjukkan kata laluan" },
  "auth.hide": { en: "Hide password", ms: "Sembunyikan kata laluan" },
  "auth.passwordHint": { en: "At least {n} characters.", ms: "Sekurang-kurangnya {n} aksara." },
  "auth.createAccount": { en: "Create account", ms: "Cipta akaun" },
  "auth.logIn": { en: "Log in", ms: "Log masuk" },
  "auth.haveAccount": { en: "Already have an account?", ms: "Sudah ada akaun?" },
  "auth.newHere": { en: "New here?", ms: "Baru di sini?" },
  "auth.errName": { en: "Enter your name.", ms: "Masukkan nama anda." },
  "auth.errEmail": {
    en: "Enter an email address like name@example.com.",
    ms: "Masukkan alamat e-mel seperti nama@contoh.com.",
  },
  "auth.errPassword": { en: "Use at least {n} characters.", ms: "Gunakan sekurang-kurangnya {n} aksara." },
  "auth.errNoAccount": {
    en: "There's no account on this phone yet. Create one, or continue without an account.",
    ms: "Belum ada akaun pada telefon ini. Cipta satu, atau teruskan tanpa akaun.",
  },
  "auth.errWrong": {
    en: "That email and password don't match the account on this phone.",
    ms: "E-mel dan kata laluan itu tidak sepadan dengan akaun pada telefon ini.",
  },

  // --- profile setup ---
  "setup.step1": { en: "About you", ms: "Tentang anda" },
  "setup.step2": { en: "Getting around", ms: "Cara bergerak" },
  "setup.step3": { en: "Anything else", ms: "Lain-lain" },
  "setup.prev": { en: "Previous step", ms: "Langkah sebelumnya" },
  "setup.cancel": { en: "Cancel and go back", ms: "Batal dan kembali" },
  "setup.stepOf": { en: "Step {n} of {total}", ms: "Langkah {n} daripada {total}" },
  "setup.progress": { en: "Progress", ms: "Kemajuan" },
  "setup.done": { en: " — done", ms: " — selesai" },
  "setup.yourProfile": { en: "Your profile", ms: "Profil anda" },
  "setup.guestHello": { en: "Let's set you up", ms: "Jom mulakan" },
  "setup.hello": { en: "Hi!", ms: "Hai!" },
  "setup.helloName": { en: "Hi, {name}!", ms: "Hai, {name}!" },
  "setup.lead": {
    en: "This helps BeeAble pick routes and talk to you in your language.",
    ms: "Ini membantu BeeAble memilih laluan dan bercakap dengan anda dalam bahasa anda.",
  },
  "setup.nameLabel": { en: "What should we call you?", ms: "Apa nama panggilan anda?" },
  "setup.optional": { en: "(optional)", ms: "(pilihan)" },
  "setup.language": { en: "Preferred language", ms: "Bahasa pilihan" },
  "setup.languageHint": {
    en: "The whole app switches to this language. You can still write reports in any language.",
    ms: "Seluruh aplikasi akan bertukar ke bahasa ini. Anda masih boleh menulis laporan dalam apa-apa bahasa.",
  },
  "setup.moveTitle": { en: "How do you get around?", ms: "Bagaimana anda bergerak?" },
  "setup.moveLead": {
    en: "We'll use this for your routes. You can switch any time on the map.",
    ms: "Kami gunakan ini untuk laluan anda. Anda boleh tukar bila-bila masa pada peta.",
  },
  "setup.routeType": { en: "Route type", ms: "Jenis laluan" },
  "setup.neverAccessible": {
    en: "We never call a route \"accessible\". We show what's been checked and what hasn't.",
    ms: "Kami tidak sesekali menggelar laluan sebagai \"mesra OKU\". Kami tunjukkan apa yang sudah dan belum disemak.",
  },
  "setup.elseTitle": { en: "Anything else we should know?", ms: "Ada apa-apa lagi yang perlu kami tahu?" },
  "setup.elseLead": { en: "Optional. Pick any that apply.", ms: "Pilihan. Pilih mana-mana yang berkenaan." },
  "setup.needs": { en: "Needs", ms: "Keperluan" },
  "setup.save": { en: "Save profile", ms: "Simpan profil" },
  "setup.start": { en: "Start exploring", ms: "Mula meneroka" },
  "setup.next": { en: "Next", ms: "Seterusnya" },

  // --- routing profiles ---
  "profile.legend": { en: "How do you get around?", ms: "Bagaimana anda bergerak?" },
  "profile.step_free.label": { en: "Step-free", ms: "Tanpa tangga" },
  "profile.step_free.hint": { en: "Avoids steps and steep slopes", ms: "Mengelak tangga dan cerun curam" },
  "profile.step_free.example": {
    en: "For example: wheelchair users, mobility scooters, pushing a stroller or trolley",
    ms: "Contohnya: pengguna kerusi roda, skuter mobiliti, menolak kereta sorong bayi atau troli",
  },
  "profile.easy_walking.label": { en: "Easy walking", ms: "Jalan mudah" },
  "profile.easy_walking.hint": {
    en: "Fewer steps, gentler slopes, more shade",
    ms: "Kurang tangga, cerun landai, lebih teduh",
  },
  "profile.easy_walking.example": {
    en: "For example: older people, walking with a stick or crutches, knee pain, pregnancy",
    ms: "Contohnya: warga emas, berjalan dengan tongkat, sakit lutut, mengandung",
  },

  // --- needs ---
  "need.wheelchair.label": { en: "I use a wheelchair", ms: "Saya menggunakan kerusi roda" },
  "need.wheelchair.hint": { en: "Manual or powered", ms: "Manual atau elektrik" },
  "need.stroller.label": { en: "I push a stroller or trolley", ms: "Saya menolak kereta sorong bayi atau troli" },
  "need.stroller.hint": { en: "Prams, carts, luggage", ms: "Kereta bayi, troli, bagasi" },
  "need.elderly.label": { en: "I tire easily on long walks", ms: "Saya cepat letih jika berjalan jauh" },
  "need.elderly.hint": { en: "Or need to rest along the way", ms: "Atau perlu berehat di sepanjang jalan" },

  // --- navigate ---
  "nav.where": { en: "Where would you like to go?", ms: "Ke mana anda mahu pergi?" },
  "nav.routeTo": { en: "Route to · {type}", ms: "Laluan ke · {type}" },
  "nav.change": { en: "Change", ms: "Tukar" },
  "nav.couldNotLoad": { en: "Could not load a route: {error}", ms: "Laluan tidak dapat dimuatkan: {error}" },
  "nav.finding": { en: "Finding a route…", ms: "Mencari laluan…" },
  "nav.start": { en: "Start journey", ms: "Mula perjalanan" },
  "nav.needGps": {
    en: "Turn-by-turn directions need your GPS on campus.",
    ms: "Arahan langkah demi langkah memerlukan GPS anda di kampus.",
  },
  "nav.tryAgain": { en: "Try again", ms: "Cuba lagi" },
  "nav.locateMe": { en: "Show my location", ms: "Tunjukkan lokasi saya" },
  "nav.mapKey": { en: "Map key", ms: "Petunjuk peta" },
  "nav.closeKey": { en: "Close map key", ms: "Tutup petunjuk peta" },
  "nav.shrink": { en: "Shrink panel", ms: "Kecilkan panel" },
  "nav.expand": { en: "Expand panel", ms: "Besarkan panel" },

  // --- location ---
  "loc.locating": { en: "Finding your location…", ms: "Mencari lokasi anda…" },
  "loc.ok": { en: "Using your current location.", ms: "Menggunakan lokasi semasa anda." },
  "loc.off_campus": {
    en: "You seem to be off campus, so we're using the campus centre.",
    ms: "Anda nampaknya berada di luar kampus, jadi kami menggunakan pusat kampus.",
  },
  "loc.unavailable": {
    en: "Location unavailable, so we're using the campus centre.",
    ms: "Lokasi tidak tersedia, jadi kami menggunakan pusat kampus.",
  },

  // --- place types ---
  "place.clinic": { en: "Clinic", ms: "Klinik" },
  "place.mosque_surau": { en: "Surau", ms: "Surau" },
  "place.bus_stop": { en: "Bus stop", ms: "Perhentian bas" },
  "place.library": { en: "Library", ms: "Perpustakaan" },
  "place.food": { en: "Food & drink", ms: "Makanan & minuman" },
  "place.residence": { en: "College / hostel", ms: "Kolej / asrama" },
  "place.sport": { en: "Sport", ms: "Sukan" },
  "place.building": { en: "Building", ms: "Bangunan" },
  "place.pin": { en: "Spot on the map", ms: "Lokasi pada peta" },
  "pin.name": { en: "Pinned spot", ms: "Lokasi pilihan" },
  "pin.near": { en: "Near {place}", ms: "Berhampiran {place}" },
  "nav.tapHint": { en: "Or tap the map to choose a spot.", ms: "Atau ketik pada peta untuk memilih lokasi." },
  "nav.tooFar": {
    en: "That spot is too far from any path we know. Tap closer to a path or building.",
    ms: "Lokasi itu terlalu jauh dari mana-mana laluan yang kami tahu. Ketik lebih dekat dengan laluan atau bangunan.",
  },

  // --- destination search ---
  "search.label": { en: "Search for a place", ms: "Cari tempat" },
  "search.placeholder": {
    en: "Where to? Try “clinic” or “Perpustakaan”",
    ms: "Ke mana? Cuba “klinik” atau “Perpustakaan”",
  },
  "search.clear": { en: "Clear search", ms: "Kosongkan carian" },
  "search.suggestions": { en: "Suggestions", ms: "Cadangan" },
  "search.none": {
    en: "No campus places match “{q}”. Try the building name or what it is, e.g. “library”.",
    ms: "Tiada tempat di kampus yang sepadan dengan “{q}”. Cuba nama bangunan atau jenisnya, cth. “perpustakaan”.",
  },
  "search.places": { en: "Places", ms: "Tempat" },
  "search.recent": { en: "Recent", ms: "Terkini" },
  "search.nearby": { en: "Nearby key places", ms: "Tempat utama berdekatan" },
  "search.key": { en: "Key places", ms: "Tempat utama" },
  "search.away": { en: "{d} m away", ms: "{d} m dari sini" },

  // --- route card ---
  "card.recommendedAria": { en: "Recommended route", ms: "Laluan disyorkan" },
  "card.alternativeAria": { en: "Alternative route", ms: "Laluan alternatif" },
  "card.min": { en: "min", ms: "min" },
  "card.beeable": { en: "BeeAble route", ms: "Laluan BeeAble" },
  "card.alternative": { en: "Alternative", ms: "Alternatif" },
  "card.options": { en: "Route options", ms: "Pilihan laluan" },
  "card.optionMeta": { en: "{m} m · ~{n} min", ms: "{m} m · ~{n} min" },
  "card.okTitle": { en: "Smooth flying!", ms: "Terbang lancar!" },
  "card.okText": { en: "No known barriers for your profile.", ms: "Tiada halangan diketahui untuk profil anda." },
  "card.leastBadTitle": { en: "Buzz-kill: no clear path", ms: "Alamak: tiada laluan jelas" },
  "card.leastBadText": {
    en: "No route avoids every barrier. Least-bad option: passes {b}.",
    ms: "Tiada laluan yang mengelak semua halangan. Pilihan paling kurang buruk: melalui {b}.",
  },
  "card.blockedTitle": { en: "Bzz, careful!", ms: "Bzz, hati-hati!" },
  "card.blockedText": { en: "This route passes {b}.", ms: "Laluan ini melalui {b}." },
  "card.warnTitle": { en: "Bzz, heads up!", ms: "Bzz, berhati-hati!" },
  "card.warn.one": {
    en: "Best route we found, but it still has 1 known barrier. Tap the striped markers on the map to see it.",
    ms: "Laluan terbaik yang kami jumpa, tetapi masih ada 1 halangan diketahui. Ketik penanda berjalur pada peta untuk melihatnya.",
  },
  "card.warn.other": {
    en: "Best route we found, but it still has {n} known barriers. Tap the striped markers on the map to see them.",
    ms: "Laluan terbaik yang kami jumpa, tetapi masih ada {n} halangan diketahui. Ketik penanda berjalur pada peta untuk melihatnya.",
  },
  "card.warnAlt.one": {
    en: "This route has 1 known barrier. Tap the striped markers on the map to see it.",
    ms: "Laluan ini ada 1 halangan diketahui. Ketik penanda berjalur pada peta untuk melihatnya.",
  },
  "card.warnAlt.other": {
    en: "This route has {n} known barriers. Tap the striped markers on the map to see them.",
    ms: "Laluan ini ada {n} halangan diketahui. Ketik penanda berjalur pada peta untuk melihatnya.",
  },
  "card.surveyed": {
    en: "of this route checked in person. The rest is unknown.",
    ms: "daripada laluan ini telah disemak secara langsung. Selebihnya tidak diketahui.",
  },
  "card.alsoShortest": { en: "This is also the shortest route.", ms: "Ini juga laluan terpendek." },
  "card.shortest": { en: "Shortest route:", ms: "Laluan terpendek:" },
  "card.noKnown": { en: "no known barriers", ms: "tiada halangan diketahui" },
  "card.passes": { en: "passes {b}", ms: "melalui {b}" },
  "card.known.one": { en: "1 known barrier", ms: "1 halangan diketahui" },
  "card.known.other": { en: "{n} known barriers", ms: "{n} halangan diketahui" },
  "card.adds": { en: "This route adds about {m} m (~{n} min).", ms: "Laluan ini menambah kira-kira {m} m (~{n} min)." },
  "card.why": { en: "Why this route?", ms: "Kenapa laluan ini?" },

  // --- map ---
  "map.aria": {
    en: "Map of the campus showing routes and reported barriers",
    ms: "Peta kampus yang menunjukkan laluan dan halangan yang dilaporkan",
  },
  "map.barrierTitle": { en: "Barrier: {t}", ms: "Halangan: {t}" },
  "map.obstacleHere": { en: "Bzzt! Obstacle here", ms: "Bzzt! Ada halangan di sini" },
  "map.impassable": { en: "Impassable for your profile", ms: "Tidak boleh dilalui untuk profil anda" },
  "map.startTitle": { en: "Start: you are here", ms: "Mula: anda di sini" },
  "map.youAreHere": { en: "You are here", ms: "Anda di sini" },
  "map.buzzing": { en: "Buzzing along nicely.", ms: "Terbang dengan lancar." },
  "map.destination": { en: "Destination", ms: "Destinasi" },
  "map.altTitle": { en: "Alternative route (tap to use it)", ms: "Laluan alternatif (ketik untuk guna)" },
  "map.reportTitle": { en: "Report {ref}: {status}", ms: "Laporan {ref}: {status}" },
  "map.headline.unverified": { en: "Someone spotted something", ms: "Ada yang terjumpa sesuatu" },
  "map.headline.verified": { en: "Bzzt! Confirmed obstacle", ms: "Bzzt! Halangan disahkan" },
  "map.headline.in_progress": { en: "Busy bees are fixing this", ms: "Lebah sibuk sedang membaikinya" },
  "map.status": { en: "Status: {s}", ms: "Status: {s}" },
  "map.source": { en: "Source: {s}", ms: "Sumber: {s}" },
  "status.unverified": { en: "Unverified (not yet checked by staff)", ms: "Belum disahkan (belum disemak oleh staf)" },
  "status.verified": { en: "Confirmed", ms: "Disahkan" },
  "status.verifiedAi": { en: "Confirmed by AI", ms: "Disahkan oleh AI" },
  "status.in_progress": { en: "Being fixed", ms: "Sedang dibaiki" },
  "status.resolved": { en: "Resolved", ms: "Selesai" },
  "status.rejected": { en: "Rejected", ms: "Ditolak" },
  "source.reported": { en: "reported", ms: "dilaporkan" },
  "source.simulated": { en: "simulated", ms: "simulasi" },

  // --- barrier categories (resident wording) ---
  "cat.steps_no_ramp": { en: "Steps, no ramp", ms: "Tangga tanpa ramp" },
  "cat.high_kerb": { en: "High kerb", ms: "Kerb tinggi" },
  "cat.damaged_kerb": { en: "Damaged kerb", ms: "Kerb rosak" },
  "cat.missing_ramp": { en: "Missing ramp", ms: "Tiada ramp" },
  "cat.broken_paving": { en: "Broken paving", ms: "Laluan pejalan kaki rosak" },
  "cat.obstruction": { en: "Obstruction", ms: "Laluan terhalang" },
  "cat.steep_slope": { en: "Steep slope", ms: "Cerun curam" },
  "cat.no_crossing": { en: "No safe crossing", ms: "Tiada lintasan selamat" },
  "cat.other": { en: "Other", ms: "Lain-lain" },
  "cat.not_a_barrier": { en: "Not a barrier", ms: "Bukan halangan" },

  // --- map key ---
  "legend.aria": { en: "Map legend", ms: "Petunjuk peta" },
  "legend.beeable": { en: "BeeAble route", ms: "Laluan BeeAble" },
  "legend.alternative": { en: "Alternative route (tap to switch)", ms: "Laluan alternatif (ketik untuk tukar)" },
  "legend.shortest": { en: "Shortest route", ms: "Laluan terpendek" },
  "legend.obstacle": { en: "Obstacle on a route (tap for details)", ms: "Halangan pada laluan (ketik untuk butiran)" },
  "legend.unverified": { en: "Reported, not yet checked by staff", ms: "Dilaporkan, belum disemak oleh staf" },
  "legend.confirmed": { en: "Barrier confirmed (by AI or staff)", ms: "Halangan disahkan (oleh AI atau staf)" },
  "legend.fixing": { en: "Being fixed", ms: "Sedang dibaiki" },

  // --- turn-by-turn ---
  "turn.slight_left": { en: "Bear left", ms: "Condong ke kiri" },
  "turn.left": { en: "Turn left", ms: "Belok kiri" },
  "turn.sharp_left": { en: "Sharp left", ms: "Belok tajam ke kiri" },
  "turn.slight_right": { en: "Bear right", ms: "Condong ke kanan" },
  "turn.right": { en: "Turn right", ms: "Belok kanan" },
  "turn.sharp_right": { en: "Sharp right", ms: "Belok tajam ke kanan" },
  "turn.uturn": { en: "Turn around", ms: "Pusing balik" },
  "turn.arrive": { en: "Arrive at {dest}", ms: "Tiba di {dest}" },
  "unit.metres": { en: "metres", ms: "meter" },
  "unit.kilometres": { en: "kilometres", ms: "kilometer" },
  "journey.sayArrived": { en: "You have arrived at {dest}.", ms: "Anda telah tiba di {dest}." },
  "journey.sayRerouting": { en: "Finding a new route.", ms: "Mencari laluan baharu." },
  "journey.sayWalk": { en: "Walk {d}.", ms: "Berjalan {d}." },
  "journey.sayIn": { en: "In {d}, {turn}.", ms: "Dalam {d}, {turn}." },
  "journey.sayNewRoute": { en: "New route found.", ms: "Laluan baharu ditemui." },
  "journey.sayStarting": { en: "Starting your journey to {dest}.", ms: "Memulakan perjalanan anda ke {dest}." },
  "journey.sayNow": { en: "{turn} now.", ms: "{turn} sekarang." },
  "journey.sayObstacle": { en: "Heads up. Obstacle in {d}: {text}.", ms: "Awas. Halangan dalam {d}: {text}." },
  "journey.arrived": { en: "You've arrived!", ms: "Anda sudah tiba!" },
  "journey.done": { en: "Done", ms: "Selesai" },
  "journey.finding": { en: "Finding you on the map…", ms: "Mencari kedudukan anda pada peta…" },
  "journey.then": { en: "Then", ms: "Kemudian" },
  "journey.obstacleIn": { en: "Bzzt! Obstacle in {d}", ms: "Bzzt! Halangan dalam {d}" },
  "journey.trip": { en: "Trip", ms: "Perjalanan" },
  "journey.leftRoute": {
    en: "You've left the route. Finding a new one…",
    ms: "Anda telah terkeluar dari laluan. Mencari laluan baharu…",
  },
  "journey.weakGps": { en: "Weak GPS signal (±{m} m).", ms: "Isyarat GPS lemah (±{m} m)." },
  "journey.gpsLost": {
    en: "Lost the GPS signal. Keep walking; we'll pick it up again.",
    ms: "Isyarat GPS hilang. Teruskan berjalan; kami akan cuba mendapatkannya semula.",
  },
  "journey.gpsDenied": {
    en: "Can't use GPS. Check that location is turned on for BeeAble.",
    ms: "GPS tidak dapat digunakan. Pastikan lokasi dihidupkan untuk BeeAble.",
  },
  "journey.eta": { en: "{d} · arrive {eta}", ms: "{d} · tiba {eta}" },
  "journey.voiceOff": { en: "Voice directions off", ms: "Arahan suara dimatikan" },
  "journey.voiceOn": { en: "Voice directions on", ms: "Arahan suara dihidupkan" },
  "journey.end": { en: "End", ms: "Tamat" },

  // --- report ---
  "report.title": { en: "Report a barrier", ms: "Laporkan halangan" },
  "report.lead": {
    en: "Snap a photo of the steps, broken kerb or blocked path. Our AI describes and checks it, and staff fix it.",
    ms: "Ambil gambar tangga, kerb rosak atau laluan yang terhalang. AI kami menerangkan dan menyemaknya, dan staf membaikinya.",
  },
  "report.stepPhoto": { en: "Photo", ms: "Gambar" },
  "report.stepDetails": { en: "Details", ms: "Butiran" },
  "report.stepSend": { en: "Send", ms: "Hantar" },
  "report.stepLocation": { en: "Location", ms: "Lokasi" },
  "report.optionalSr": { en: " (optional)", ms: " (pilihan)" },
  "report.analysing": { en: "Looking at your photo…", ms: "Sedang meneliti gambar anda…" },
  "report.analyse": { en: "Analyse with AI", ms: "Analisis dengan AI" },
  "report.analyseFailed": {
    en: "The AI couldn't look at your photo right now. You can still send the report: staff will check the photo.",
    ms: "AI tidak dapat meneliti gambar anda sekarang. Anda masih boleh menghantar laporan: staf akan menyemak gambar itu.",
  },
  "report.addDetails": { en: "Add details", ms: "Tambah butiran" },
  "report.whatsProblem": { en: "What's the problem?", ms: "Apa masalahnya?" },
  "report.missed": { en: "Anything the AI missed? Add it here.", ms: "Ada apa-apa yang AI terlepas? Tambah di sini." },
  "report.notNeeded": {
    en: "Not needed with a photo, but it can help.",
    ms: "Tidak perlu jika ada gambar, tetapi ia boleh membantu.",
  },
  "report.locationIdle": {
    en: "We'll use your current location when you send. Stand near the problem if you can.",
    ms: "Kami akan menggunakan lokasi semasa anda apabila anda menghantar. Berdiri berhampiran masalah itu jika boleh.",
  },
  "report.needPhotoOrText": { en: "Add a photo or a short description first.", ms: "Tambah gambar atau penerangan ringkas dahulu." },
  "report.wentWrong": { en: "Something went wrong.", ms: "Ada masalah berlaku." },
  "report.couldNotSend": { en: "Could not send the report: {error}", ms: "Laporan tidak dapat dihantar: {error}" },
  "report.sending": { en: "Sending…", ms: "Menghantar…" },
  "report.reading": { en: "Reading your report…", ms: "Sedang membaca laporan anda…" },
  "report.send": { en: "Send report", ms: "Hantar laporan" },
  "report.conf.high": { en: "AI is fairly sure", ms: "AI agak pasti" },
  "report.conf.medium": { en: "AI is somewhat sure", ms: "AI kurang pasti" },
  "report.conf.low": { en: "AI is not sure", ms: "AI tidak pasti" },
  "report.aiFallback": {
    en: "We couldn't analyse the photo right now. Add a few words below if you can, or just send it. Staff will look at it.",
    ms: "Kami tidak dapat menganalisis gambar sekarang. Tambah beberapa patah perkataan di bawah jika boleh, atau hantar sahaja. Staf akan menelitinya.",
  },
  "report.aiSuggestion": { en: "AI suggestion", ms: "Cadangan AI" },
  "report.sampleOffline": { en: " (sample, server offline)", ms: " (contoh, pelayan di luar talian)" },
  "report.severity": { en: "{s} severity", ms: "keterukan {s}" },
  "sev.low": { en: "low", ms: "rendah" },
  "sev.medium": { en: "medium", ms: "sederhana" },
  "sev.high": { en: "high", ms: "tinggi" },
  "report.notBarrier": { en: "Doesn't look like a barrier", ms: "Nampaknya bukan halangan" },
  "report.affects": { en: "Affects: {list}", ms: "Menjejaskan: {list}" },
  "affect.wheelchair": { en: "wheelchair", ms: "kerusi roda" },
  "affect.stroller": { en: "stroller", ms: "kereta sorong bayi" },
  "affect.elderly": { en: "elderly", ms: "warga emas" },
  "affect.low_vision": { en: "low vision", ms: "kurang penglihatan" },
  "report.summaryEnglish": { en: "", ms: "Ringkasan AI (dalam bahasa Inggeris):" },
  "report.privacy": {
    en: "It may show a face or number plate. Staff blur these before anyone else sees it.",
    ms: "Gambar mungkin menunjukkan wajah atau nombor plat. Staf akan mengaburkannya sebelum orang lain melihatnya.",
  },
  "report.duplicate": {
    en: "Someone may have reported this already. Send it anyway: it helps staff prioritise.",
    ms: "Mungkin sudah ada yang melaporkan perkara ini. Hantar juga: ia membantu staf menentukan keutamaan.",
  },
  "report.gotWrong": {
    en: "If we got it wrong, say what the problem is below.",
    ms: "Jika kami silap, nyatakan masalahnya di bawah.",
  },
  "report.willAutoReject": {
    en: "If you send it like this, the AI closes it as not a barrier. Staff can still reopen it.",
    ms: "Jika dihantar begini, AI akan menutupnya sebagai bukan halangan. Staf masih boleh membukanya semula.",
  },
  "report.stale": {
    en: "You added details, so the AI will read them too when you send.",
    ms: "Anda menambah butiran, jadi AI akan membacanya juga semasa anda menghantar.",
  },
  "report.willConfirm": {
    en: "If it's clear, the AI confirms it when you send. Otherwise staff check it.",
    ms: "Jika jelas, AI akan mengesahkannya semasa anda menghantar. Jika tidak, staf akan menyemaknya.",
  },
  "report.cameraError": {
    en: "Couldn't open the camera or gallery. Check the app's permissions in Settings.",
    ms: "Kamera atau galeri tidak dapat dibuka. Semak kebenaran aplikasi dalam Tetapan.",
  },
  "report.previewAlt": { en: "The photo you are about to send", ms: "Gambar yang akan anda hantar" },
  "report.change": { en: "Change photo", ms: "Tukar gambar" },
  "report.take": { en: "Take a photo", ms: "Ambil gambar" },
  "report.gallery": { en: "Choose from gallery", ms: "Pilih dari galeri" },
  "report.photoHint": {
    en: "A photo is often enough: the AI can describe it for you. Avoid faces and number plates.",
    ms: "Gambar biasanya sudah cukup: AI boleh menerangkannya untuk anda. Elakkan wajah dan nombor plat.",
  },
  "report.describe": { en: "Describe the problem", ms: "Terangkan masalahnya" },
  "report.placeholder": {
    en: "e.g. Broken kerb by the road, hard for a wheelchair",
    ms: "cth. Kerb tepi jalan pecah, susah untuk kerusi roda",
  },
  "report.langHint": { en: "Bahasa Melayu or English are both fine.", ms: "Bahasa Melayu atau English, kedua-duanya boleh." },
  "report.quickGroup": { en: "Quick add a common problem", ms: "Tambah masalah biasa dengan pantas" },
  "quick.kerb.label": { en: "Broken kerb", ms: "Kerb rosak" },
  "quick.kerb.text": { en: "Broken kerb.", ms: "Kerb rosak." },
  "quick.steps.label": { en: "Steps, no ramp", ms: "Tangga tanpa ramp" },
  "quick.steps.text": { en: "Steps with no ramp.", ms: "Tangga tiada ramp." },
  "quick.blocked.label": { en: "Path blocked", ms: "Laluan terhalang" },
  "quick.blocked.text": { en: "Something is blocking the path.", ms: "Ada sesuatu menghalang laluan." },
  "quick.paving.label": { en: "Broken paving", ms: "Laluan pejalan kaki rosak" },
  "quick.paving.text": { en: "Broken or uneven paving.", ms: "Laluan pejalan kaki pecah atau tidak rata." },
  "quick.slope.label": { en: "Steep slope", ms: "Cerun curam" },
  "quick.slope.text": { en: "Very steep slope.", ms: "Cerun sangat curam." },
  "quick.crossing.label": { en: "No safe crossing", ms: "Tiada lintasan selamat" },
  "quick.crossing.text": { en: "No safe place to cross.", ms: "Tiada tempat selamat untuk melintas." },
  "sent.thanks": { en: "Thanks, your report is in", ms: "Terima kasih, laporan anda telah diterima" },
  "sent.yourRef": { en: "Your reference", ms: "Nombor rujukan anda" },
  "sent.copyRef": { en: "Copy reference number", ms: "Salin nombor rujukan" },
  "sent.copied": { en: "Copied.", ms: "Disalin." },
  "sent.next": { en: "What happens next", ms: "Apa seterusnya" },
  "sent.sent": { en: "Sent", ms: "Dihantar" },
  "sent.sentConfirmed": { en: "Sent and confirmed by the AI", ms: "Dihantar dan disahkan oleh AI" },
  "sent.confirmedRest": { en: " — routes now avoid it", ms: " — laluan kini mengelaknya" },
  "sent.unverifiedRest": { en: " — shown as Unverified on the map", ms: " — ditunjukkan sebagai Belum disahkan pada peta" },
  "sent.rejectedRest": {
    en: " — the AI thinks this isn't an accessibility barrier, so it's closed",
    ms: " — AI berpendapat ini bukan halangan aksesibiliti, jadi ia ditutup",
  },
  "sent.staffFix": { en: "Staff fix it", ms: "Staf membaikinya" },
  "sent.staffFixRest": { en: " or correct it if the AI got it wrong", ms: " atau membetulkannya jika AI silap" },
  "sent.staffCheck": { en: "Staff check it", ms: "Staf menyemaknya" },
  "sent.staffCheckRest": { en: " and confirm or correct the details", ms: " dan mengesahkan atau membetulkan butirannya" },
  "sent.staffReopen": { en: "Staff can reopen it", ms: "Staf boleh membukanya semula" },
  "sent.staffReopenRest": { en: " if the AI got it wrong", ms: " jika AI silap" },
  "sent.fixed": { en: "Fixed", ms: "Dibaiki" },
  "sent.fixedRest": { en: " — routes update for everyone", ms: " — laluan dikemas kini untuk semua" },
  "sent.waiting": { en: "Waiting for staff", ms: "Menunggu staf" },
  "sent.whatWeThink": { en: "What we think it is", ms: "Apa yang kami fikir" },
  "sent.couldntCategorise": {
    en: "We couldn't categorise it automatically. Staff will review it.",
    ms: "Kami tidak dapat mengkategorikannya secara automatik. Staf akan menelitinya.",
  },
  "sent.aiConfirmed": {
    en: "The AI confirmed this. Staff can still correct it.",
    ms: "AI telah mengesahkan ini. Staf masih boleh membetulkannya.",
  },
  "sent.aiRejected": {
    en: "The AI closed this as not a barrier. Staff can still reopen it.",
    ms: "AI telah menutup ini sebagai bukan halangan. Staf masih boleh membukanya semula.",
  },
  "sent.aiSuggestion": {
    en: "This is an AI suggestion. Staff confirm or correct it.",
    ms: "Ini cadangan AI. Staf akan mengesahkan atau membetulkannya.",
  },
  "sent.seeMap": { en: "See the map", ms: "Lihat peta" },
  "sent.another": { en: "Report another", ms: "Lapor lagi" },
} satisfies Record<string, Entry>;

export type TKey = keyof typeof S;
export type Vars = Record<string, string | number>;

/** One string in `lang`, with {placeholders} filled in. */
export function translate(lang: Language, key: TKey, vars?: Vars): string {
  let text = S[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

/** "1 known barrier" / "3 known barriers": picks `<key>.one` or `<key>.other`. */
export function plural(lang: Language, key: string, n: number): string {
  return translate(lang, `${key}.${n === 1 ? "one" : "other"}` as TKey, { n });
}

/** Locale for dates and times shown in `lang`. */
export const LOCALE: Record<Language, string> = { en: "en-MY", ms: "ms-MY" };

/** `t(key, vars)` in the app's language, or in `override` (e.g. the language being picked on the setup screen). */
export function useT(override?: Language) {
  const { language } = useAccount();
  const lang = override ?? language;
  const t = useCallback((key: TKey, vars?: Vars) => translate(lang, key, vars), [lang]);
  return { t, lang };
}
