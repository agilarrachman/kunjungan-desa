/* ============================================================================
   MAIN — penghubung semua bagian game
   ----------------------------------------------------------------------------
   Isi :
   01. Pemeriksaan library & referensi DOM
   02. State permainan + utilitas
   03. Manajemen layar (landing / kustom / game / akhir)
   04. UI kustomisasi karakter (warna, gender, aksesoris, simpan/acak)
   05. Inisialisasi dunia 3D + karakter pemain
   06. Input : keyboard + kontrol sentuh
   07. Loop utama : gerak pemain, kamera, animasi, prompt desa, minimap
   08. Popup informasi desa (dengan placeholder ilustrasi SVG)
   09. Progres eksplorasi
   10. Layar akhir + confetti
   ============================================================================ */

/* ---------------------------------------------------------------------------
   01. PEMERIKSAAN LIBRARY & REFERENSI DOM
--------------------------------------------------------------------------- */
if (typeof THREE === "undefined") {
  document.getElementById("galat-lib").hidden = false;
  throw new Error("three.min.js gagal dimuat");
}

const $ = (id) => document.getElementById(id);
const el = {
  // layar
  landing: $("layar-landing"), kustom: $("layar-kustom"),
  game: $("layar-game"), akhir: $("layar-akhir"),
  // landing
  btnMulai: $("btn-mulai"),
  // kustomisasi
  previewLabel: $("preview-label"),
  genderWrap: document.querySelector(".pilihan-gender"),
  warnaKulit: $("warna-kulit"), warnaRambut: $("warna-rambut"), warnaPakaian: $("warna-pakaian"),
  kisiAksesoris: $("kisi-aksesoris"),
  btnAcak: $("btn-acak"), btnSimpan: $("btn-simpan"), btnJelajah: $("btn-jelajah"),
  // game / HUD
  kanvasDunia: $("kanvas-dunia"),
  progresJumlah: $("progres-jumlah"), progresTotal: $("progres-total"), progresIsi: $("progres-isi"),
  waktuMain: $("waktu-main"), daftarDesa: $("daftar-desa"),
  minimap: $("minimap"), tombolSuara: $("tombol-suara"),
  promptDesa: $("prompt-desa"), promptNama: $("prompt-nama"),
  indikatorLari: $("indikator-lari"),
  // popup
  popup: $("popup-desa"),
  popupTema: $("popup-tema"),
  popupImg: $("popup-img"), popupGaleri: $("popup-galeri"),
  popupDaerah: $("popup-daerah"), popupNama: $("popup-nama"),
  popupDeskripsi: $("popup-deskripsi"), popupCiriKhas: $("popup-cirikhas"),
  popupPenduduk: $("popup-penduduk"), popupLuas: $("popup-luas"),
  popupKeunggulan: $("popup-keunggulan"), popupProduk: $("popup-produk"),
  popupWisata: $("popup-wisata"), popupUmkm: $("popup-umkm"),
  popupTutup: $("popup-tutup"), popupTutupX: $("popup-tutup-x"), popupLanjut: $("popup-lanjut"),
  // akhir
  akhirDesa: $("akhir-desa"), akhirWaktu: $("akhir-waktu"),
  btnUlang: $("btn-ulang"), btnBeranda: $("btn-beranda"),
  toast: $("toast"),
};

const KUNCI_NAMA = { ArrowUp: "atas", ArrowDown: "bawah", ArrowLeft: "kiri", ArrowRight: "kanan",
                     KeyW: "atas", KeyS: "bawah", KeyA: "kiri", KeyD: "kanan" };

/* ---------------------------------------------------------------------------
   02. STATE PERMAINAN + UTILITAS
--------------------------------------------------------------------------- */
const state = {
  layar: "landing",
  karakter: muatKarakter(),
  dikunjungi: new Set(),
  waktu: 0,                 // detik eksplorasi berjalan
  popupTerbuka: false,
  desaDekat: null,          // desa dalam radius interaksi
  targetDesa: null,         // indeks desa tujuan (mercu tanda)
  ujungTersentuh: false,    // sudah sampai ujung jalan (pemicu ending)
  jedaKunjungOtomatis: 0,   // waktu minimum sebelum kunjungan otomatis lagi (mobile)
  bisu: false,
};

const pemain = {
  pos: new THREE.Vector3(0, 0, 18),
  yaw: Math.PI,             // menghadap ke depan (-Z)
  yawTarget: Math.PI,
  vx: 0, vz: 0,             // kecepatan terkini (dihaluskan)
  faseJalan: 0,
  sedangJalan: false,
  waktuMaju: 0,             // berapa lama tombol maju ditahan (untuk lari)
  faktorLari: 1,            // 1 = jalan, sampai CONFIG.faktorLari
};

const kunci = { atas: false, bawah: false, kiri: false, kanan: false };

function muatKarakter() {
  try {
    const simpan = localStorage.getItem("karakterDesa");
    if (simpan) return { ...konfigDefault(), ...JSON.parse(simpan) };
  } catch (e) { /* localStorage tidak tersedia : abaikan */ }
  return konfigDefault();
}

function simpanKarakter() {
  try { localStorage.setItem("karakterDesa", JSON.stringify(state.karakter)); } catch (e) {}
}

function formatWaktu(detik) {
  const m = String(Math.floor(detik / 60)).padStart(2, "0");
  const s = String(Math.floor(detik % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

/* damp antar sudut melalui jalur terpendek (untuk putaran mulus) */
function dampSudut(kini, target, lambda, dt) {
  let d = (target - kini) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return kini + d * (1 - Math.exp(-lambda * dt));
}

let toastTimer = null;
function tampilkanToast(pesan) {
  el.toast.textContent = pesan;
  el.toast.hidden = false;
  requestAnimationFrame(() => el.toast.classList.add("muncul"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.remove("muncul");
    setTimeout(() => { el.toast.hidden = true; }, 400);
  }, 2400);
}

/* ---------------------------------------------------------------------------
   03. MANAJEMEN LAYAR
--------------------------------------------------------------------------- */
function pindahLayar(nama) {
  state.layar = nama;
  el.landing.classList.toggle("aktif", nama === "landing");
  el.kustom.classList.toggle("aktif", nama === "kustom");
  el.game.classList.toggle("aktif", nama === "game");
  el.akhir.classList.toggle("aktif", nama === "akhir");
  if (nama === "kustom" && preview) preview.resize();
  if (nama === "game" && renderer) resizeDunia();
}

el.btnMulai.addEventListener("click", () => {
  AudioEngine.init();
  AudioEngine.pastikanJalan();
  AudioEngine.sfx("klik");
  if (!preview) buatPreview();          // preview 3D dibuat saat pertama dibutuhkan
  pindahLayar("kustom");
});

el.btnJelajah.addEventListener("click", () => {
  AudioEngine.sfx("klik");
  init3D();
  pasangKarakter();               // terapkan kustomisasi terbaru
  resetPermainan();
  pindahLayar("game");
  tampilkanToast(perangkatSentuh
    ? "Ketuk layar lalu geser untuk berjalan"
    : "Gunakan tombol panah untuk berjalan");
});

/* ---------------------------------------------------------------------------
   04. UI KUSTOMISASI KARAKTER
--------------------------------------------------------------------------- */
let preview = null;   // PreviewKarakter (dibuat saat pertama masuk layar kustom)

function buatPreview() {
  preview = new PreviewKarakter($("kanvas-preview"));
  preview.setKonfig(state.karakter);
}

/* tombol gender */
el.genderWrap.addEventListener("click", (e) => {
  const tombol = e.target.closest(".opsi-gender");
  if (!tombol) return;
  AudioEngine.sfx("klik");
  state.karakter.gender = tombol.dataset.gender;
  segarkanUIKustom();
  preview.setKonfig(state.karakter);
});

/* deret swatch warna + pemilih warna bebas */
function bangunDeretWarna(elem, properti) {
  elem.innerHTML = "";
  PALET[properti].forEach((warna) => {
    const t = document.createElement("button");
    t.className = "swatch";
    t.style.background = warna;
    t.dataset.warna = warna;
    t.title = warna;
    t.addEventListener("click", () => {
      AudioEngine.sfx("klik");
      state.karakter[properti] = warna;
      segarkanUIKustom();
      preview.setKonfig(state.karakter);
    });
    elem.appendChild(t);
  });
  /* pemilih warna kustom */
  const lain = document.createElement("label");
  lain.className = "swatch-lain";
  lain.title = "Warna pilihanmu";
  lain.textContent = "＋";
  const input = document.createElement("input");
  input.type = "color";
  input.value = state.karakter[properti];
  input.addEventListener("input", () => {
    state.karakter[properti] = input.value;
    segarkanUIKustom();
    preview.setKonfig(state.karakter);
  });
  lain.appendChild(input);
  elem.appendChild(lain);
}

/* kisi aksesoris (tanpa emoji di tombol, hanya nama) */
function bangunKisiAksesoris() {
  el.kisiAksesoris.innerHTML = "";
  AKSESORIS.forEach((a) => {
    const t = document.createElement("button");
    t.className = "kartu-aksesoris";
    t.dataset.id = a.id;
    t.textContent = a.nama;
    t.title = a.nama;
    t.addEventListener("click", () => {
      AudioEngine.sfx("klik");
      const daftar = new Set(state.karakter.aksesoris);
      if (daftar.has(a.id)) daftar.delete(a.id);
      else daftar.add(a.id);
      state.karakter.aksesoris = [...daftar];
      segarkanUIKustom();
      preview.setKonfig(state.karakter);
    });
    el.kisiAksesoris.appendChild(t);
  });
}

/* sinkronkan tampilan UI dengan state.karakter */
function segarkanUIKustom() {
  const k = state.karakter;
  el.genderWrap.querySelectorAll(".opsi-gender").forEach((t) => {
    t.classList.toggle("aktif", t.dataset.gender === k.gender);
  });
  [["warnaKulit", "kulit"], ["warnaRambut", "rambut"], ["warnaPakaian", "pakaian"]].forEach(([elNama, prop]) => {
    el[elNama].querySelectorAll(".swatch").forEach((s) => {
      s.classList.toggle("dipilih", s.dataset.warna.toLowerCase() === k[prop].toLowerCase());
    });
  });
  el.kisiAksesoris.querySelectorAll(".kartu-aksesoris").forEach((t) => {
    t.classList.toggle("aktif", k.aksesoris.includes(t.dataset.id));
  });
  el.previewLabel.textContent = k.gender === "laki" ? "Karakter Laki-laki" : "Karakter Perempuan";
}

el.btnAcak.addEventListener("click", () => {
  AudioEngine.sfx("klik");
  state.karakter = acakKonfig();
  segarkanUIKustom();
  preview.setKonfig(state.karakter);
});

el.btnSimpan.addEventListener("click", () => {
  simpanKarakter();
  AudioEngine.sfx("klik");
  tampilkanToast("💾 Karakter tersimpan!");
});

bangunDeretWarna(el.warnaKulit, "kulit");
bangunDeretWarna(el.warnaRambut, "rambut");
bangunDeretWarna(el.warnaPakaian, "pakaian");
bangunKisiAksesoris();
segarkanUIKustom();

/* ---------------------------------------------------------------------------
   05. DUNIA 3D + KARAKTER PEMAIN
   Dunia dibangun SEKALI sejak halaman dibuka agar bisa dipakai sebagai
   latar sinematik layar pembuka, lalu dipakai ulang saat bermain.
--------------------------------------------------------------------------- */
let renderer = null;
let dunia = null;
let scene = null;
let kamera = null;
let karakter = null;      // { grup, bagian }

function init3D() {
  if (renderer) return;                    // cukup sekali sepanjang sesi
  renderer = new THREE.WebGLRenderer({ canvas: el.kanvasDunia, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  kamera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 700);

  dunia = new Dunia();
  scene = dunia.scene;
  pasangKarakter();
  resizeDunia();
}

/* pasang / ganti model karakter sesuai kustomisasi terkini */
function pasangKarakter() {
  if (karakter) {
    scene.remove(karakter.grup);
    karakter.grup.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
  karakter = buildKarakter(state.karakter);
  scene.add(karakter.grup);
}

/* bangun ulang dunia dari nol (dipakai tombol "Ulangi Perjalanan"
   agar bendera kunjungan & progres visual ikut bersih) */
function bangunUlangDunia() {
  init3D();
  if (dunia) {
    dunia.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
  dunia = new Dunia();
  scene = dunia.scene;
  pasangKarakter();
  resizeDunia();
}

function resetPermainan() {
  state.dikunjungi.clear();
  state.waktu = 0;
  state.popupTerbuka = false;
  state.desaDekat = null;
  state.ujungTersentuh = false;
  state.jedaKunjungOtomatis = 0;
  pemain.pos.set(0, 0, 18);
  pemain.yaw = pemain.yawTarget = Math.PI;
  pemain.vx = pemain.vz = 0;
  pemain.waktuMaju = 0;
  pemain.faktorLari = 1;
  el.popup.classList.remove("tampil");
  el.popup.setAttribute("aria-hidden", "true");
  dunia.setTargetDesa(null);
  state.targetDesa = null;
  segarkanProgres();
  /* kamera langsung di posisi awal (tanpa ajutan) */
  kamera.position.set(0, 5.6, 28.5);
  kamera.fov = 55;
  kamera.updateProjectionMatrix();
  kamera.lookAt(0, 1.7, 11);
}

function resizeDunia() {
  renderer.setSize(innerWidth, innerHeight, false);
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
}

window.addEventListener("resize", () => {
  if (renderer) resizeDunia();
  if (preview) preview.resize();
});

/* ---------------------------------------------------------------------------
   06. INPUT — KEYBOARD + SENTUH
--------------------------------------------------------------------------- */
window.addEventListener("keydown", (e) => {
  const nama = KUNCI_NAMA[e.code];
  if (nama) {
    kunci[nama] = true;
    e.preventDefault();
    return;
  }
  if (state.layar !== "game") return;

  if (e.code === "KeyE") {
    if (state.popupTerbuka) tutupPopup();
    else if (state.desaDekat) kunjungiDesa(state.desaDekat);
  }
  if (e.code === "Escape" && state.popupTerbuka) tutupPopup();
  if (e.code === "KeyM") toggleSuara();
});

window.addEventListener("keyup", (e) => {
  const nama = KUNCI_NAMA[e.code];
  if (nama) kunci[nama] = false;
});

/* ---------------------------------------------------------------------------
   Kontrol sentuh : ANALOG TAP-LAYAR (tanpa UI tampil)
   - Ketuk & tahan di mana pun saat bermain, lalu geser jari :
     arah gerak mengikuti arah geseran (atas = maju, bawah = mundur, dst.)
   - Geseran kecil = jalan, geseran jauh = lari
   - Kunjungan desa otomatis saat karakter sampai dekat gapura
--------------------------------------------------------------------------- */
const perangkatSentuh = matchMedia("(pointer: coarse)").matches ||
  "ontouchstart" in window || navigator.maxTouchPoints > 0;

/* state analog : arah satuan (nx, ny) & besar dorongan (0..1) */
const analog = { aktif: false, nx: 0, ny: 0, mag: 0 };
let jariKendali = null;                  // pointerId jari yang mengendalikan
let asalX = 0, asalY = 0;                // titik ketukan pertama (pusat analog)
const MATI_PX = 12;                      // geseran di bawah ini = berdiri
const LARI_PX = 48;                      // geseran melebihi ini = lari
const AMBANG_LARI = 0.75;

function perbaruiKemudi(x, y) {
  let dx = x - asalX, dy = y - asalY;
  const jarak = Math.hypot(dx, dy);
  if (jarak < MATI_PX) {                  // belum digeser berarti : berdiri
    analog.aktif = false; analog.mag = 0; analog.nx = 0; analog.ny = 0;
    return;
  }
  analog.aktif = true;
  analog.mag = Math.min(jarak / LARI_PX, 1);
  analog.nx = dx / jarak;                 // arah satuan
  analog.ny = dy / jarak;
}

/* lepas kendali (mis. saat popup terbuka) */
function lepasKemudiPaksa() {
  jariKendali = null;
  analog.aktif = false; analog.mag = 0; analog.nx = 0; analog.ny = 0;
}

el.game.addEventListener("pointerdown", (e) => {
  if (!perangkatSentuh || state.layar !== "game" || state.popupTerbuka) return;
  if (jariKendali !== null) return;       // satu jari pengendali saja
  if (e.target.closest("button")) return; // sentuhan pada tombol UI diabaikan
  jariKendali = e.pointerId;
  asalX = e.clientX; asalY = e.clientY;   // pusat analog = titik ketukan
  perbaruiKemudi(e.clientX, e.clientY);
  try { el.game.setPointerCapture(e.pointerId); } catch (err) { /* aman diabaikan */ }
});
el.game.addEventListener("pointermove", (e) => {
  if (e.pointerId !== jariKendali) return;
  perbaruiKemudi(e.clientX, e.clientY);   // arah berubah mengikuti geseran jari
});
const lepasKemudi = (e) => {
  if (e.pointerId !== jariKendali) return;
  lepasKemudiPaksa();
};
el.game.addEventListener("pointerup", lepasKemudi);
el.game.addEventListener("pointercancel", lepasKemudi);

function toggleSuara() {
  state.bisu = !state.bisu;
  AudioEngine.setBisu(state.bisu);
  $("ikon-suara-nyala").hidden = state.bisu;
  $("ikon-suara-bisu").hidden = !state.bisu;
  el.tombolSuara.classList.toggle("bisu", state.bisu);
  el.tombolSuara.setAttribute("aria-label", `Suara: ${state.bisu ? "mati" : "nyala"}`);
}
el.tombolSuara.addEventListener("click", toggleSuara);

/* ---------------------------------------------------------------------------
   07. LOOP UTAMA
--------------------------------------------------------------------------- */
let waktuLalu = performance.now();
let waktuGlobal = 0;   // detik sejak halaman dibuka (untuk animasi ambient)

function siklus(saatIni) {
  requestAnimationFrame(siklus);
  const dt = Math.min((saatIni - waktuLalu) / 1000, 0.05);
  waktuLalu = saatIni;
  waktuGlobal += dt;

  if (state.layar === "landing" && dunia) {
    /* latar sinematik : kamera mengorbit pelan mengelilingi karakter */
    karakter.grup.position.set(pemain.pos.x, 0, pemain.pos.z);
    const b = karakter.bagian;
    const nafas = Math.sin(waktuGlobal * 2.2) * 0.012;
    b.badan.position.y = 0.62 + Math.sin(waktuGlobal * 2.2) * 0.007;
    b.badan.scale.set(1 + nafas, 1 + nafas * 0.6, 1 + nafas);
    b.kepala.position.y = 1.02;
    b.kepala.rotation.y = Math.sin(waktuGlobal * 0.6) * 0.12;
    b.tanganKiri.rotation.x = Math.sin(waktuGlobal * 1.8) * 0.06;
    b.tanganKanan.rotation.x = Math.sin(waktuGlobal * 1.8 + 1) * 0.06;

    const sudut = waktuGlobal * 0.10;
    const r = 8.6;
    kamera.position.set(
      pemain.pos.x + Math.sin(sudut) * r,
      3.4 + Math.sin(waktuGlobal * 0.35) * 0.5,
      pemain.pos.z + 2.5 + Math.cos(sudut) * r
    );
    kamera.lookAt(pemain.pos.x, 1.15, pemain.pos.z + 1);
    if (Math.abs(kamera.fov - 50) > 0.1) {
      kamera.fov = THREE.MathUtils.damp(kamera.fov, 50, 3, dt);
      kamera.updateProjectionMatrix();
    }
    dunia.update(dt, waktuGlobal, pemain.pos);
    renderer.render(scene, kamera);
  } else if (state.layar === "kustom" && preview) {
    preview.update(dt, waktuGlobal);
  } else if (state.layar === "game" && dunia) {
    perbaruiPermainan(dt);
  }
}
init3D();                       // dunia langsung hidup sebagai latar pembuka
requestAnimationFrame(siklus);

function perbaruiPermainan(dt) {
  state.waktu += dt;

  /* ---- gerakan pemain : keyboard (desktop) / analog (mobile) ---- */
  const pakaiAnalog = analog.aktif && !state.popupTerbuka;
  let tx = 0, tz = 0;
  if (!state.popupTerbuka) {
    if (pakaiAnalog) {
      tx = analog.nx;                  // arah satuan dari analog
      tz = analog.ny;                  // layar bawah (+y) = mundur (+Z)
    } else {
      if (kunci.atas) tz -= 1;         // maju = -Z
      if (kunci.bawah) tz += 1;
      if (kunci.kiri) tx -= 1;         // geser ke kiri layar
      if (kunci.kanan) tx += 1;        // geser ke kanan layar
    }
  }
  const panjang = Math.hypot(tx, tz);
  if (panjang > 0) { tx /= panjang; tz /= panjang; }

  /* lari : keyboard = tahan maju sebentar; analog = dorong jauh (>75%) */
  let targetLari;
  if (pakaiAnalog) {
    pemain.waktuMaju = 0;
    targetLari = analog.mag > AMBANG_LARI ? CONFIG.faktorLari : 1;
  } else if (kunci.atas && !kunci.bawah && !state.popupTerbuka) {
    pemain.waktuMaju += dt;
    targetLari = 1 + Math.min(pemain.waktuMaju / CONFIG.waktuTahanLari, 1) * (CONFIG.faktorLari - 1);
  } else {
    pemain.waktuMaju = Math.max(0, pemain.waktuMaju - dt * 3);
    targetLari = 1 + Math.min(pemain.waktuMaju / CONFIG.waktuTahanLari, 1) * (CONFIG.faktorLari - 1);
  }
  pemain.faktorLari = THREE.MathUtils.damp(pemain.faktorLari, targetLari, 6, dt);
  el.indikatorLari.hidden = pemain.faktorLari < 1.25;

  const v = CONFIG.kecepatanJalan * pemain.faktorLari;
  pemain.vx = THREE.MathUtils.damp(pemain.vx, tx * v, 8, dt);
  pemain.vz = THREE.MathUtils.damp(pemain.vz, tz * v, 8, dt);
  pemain.pos.x = THREE.MathUtils.clamp(pemain.pos.x + pemain.vx * dt, dunia.batas.xMin, dunia.batas.xMax);
  pemain.pos.z = THREE.MathUtils.clamp(pemain.pos.z + pemain.vz * dt, dunia.batas.zMin, dunia.batas.zMax);

  /* karakter menghadap arah gerakan (animasi belok = putaran halus) */
  const laju = Math.hypot(pemain.vx, pemain.vz);
  if (laju > 0.5) pemain.yawTarget = Math.atan2(pemain.vx, pemain.vz);
  pemain.yaw = dampSudut(pemain.yaw, pemain.yawTarget, 10, dt);
  karakter.grup.position.set(pemain.pos.x, 0, pemain.pos.z);
  karakter.grup.rotation.y = pemain.yaw;

  /* ---- animasi karakter : jalan / lari / idle ---- */
  const b = karakter.bagian;
  pemain.sedangJalan = laju > 0.6;
  if (pemain.sedangJalan) {
    pemain.faseJalan += dt * (9 + pemain.faktorLari * 3);
    const ayun = Math.sin(pemain.faseJalan);
    const langkah = 0.55 + pemain.faktorLari * 0.16;          // melangkah lebih lebar saat lari
    const bob = Math.abs(Math.cos(pemain.faseJalan)) * (0.045 + pemain.faktorLari * 0.02);
    b.kakiKiri.rotation.x = ayun * langkah;
    b.kakiKanan.rotation.x = -ayun * langkah;
    b.tanganKiri.rotation.x = -ayun * (0.45 + pemain.faktorLari * 0.25);
    b.tanganKanan.rotation.x = ayun * (0.45 + pemain.faktorLari * 0.25);
    b.badan.position.y = 0.62 + bob;
    b.kepala.position.y = 1.02 + bob;
    b.badan.rotation.x = 0.045 + pemain.faktorLari * 0.045;   // condong maju saat lari
  } else {
    b.kakiKiri.rotation.x = THREE.MathUtils.damp(b.kakiKiri.rotation.x, 0, 8, dt);
    b.kakiKanan.rotation.x = THREE.MathUtils.damp(b.kakiKanan.rotation.x, 0, 8, dt);
    b.tanganKiri.rotation.x = THREE.MathUtils.damp(b.tanganKiri.rotation.x, Math.sin(waktuGlobal * 1.8) * 0.06, 6, dt);
    b.tanganKanan.rotation.x = THREE.MathUtils.damp(b.tanganKanan.rotation.x, Math.sin(waktuGlobal * 1.8 + 1) * 0.06, 6, dt);
    const nafas = Math.sin(waktuGlobal * 2.2) * 0.012;
    b.badan.position.y = 0.62 + Math.sin(waktuGlobal * 2.2) * 0.007;
    b.badan.scale.set(1 + nafas, 1 + nafas * 0.6, 1 + nafas);
    b.badan.rotation.x = THREE.MathUtils.damp(b.badan.rotation.x, 0, 8, dt);
    b.kepala.position.y = 1.02;
    b.kepala.rotation.y = Math.sin(waktuGlobal * 0.6) * 0.12;
  }

  /* lampu minyak berkedip (jika dipakai) */
  if (b.lampuApi) b.lampuApi.material.emissiveIntensity = 1.7 + Math.sin(waktuGlobal * 12) * 0.6;

  /* ---- kamera mengikuti dengan lembut (FOV melebar saat lari) ---- */
  kamera.position.x = THREE.MathUtils.damp(kamera.position.x, pemain.pos.x, 4, dt);
  kamera.position.y = THREE.MathUtils.damp(kamera.position.y, 5.6, 4, dt);
  kamera.position.z = THREE.MathUtils.damp(kamera.position.z, pemain.pos.z + 10.2, 4, dt);
  kamera.lookAt(pemain.pos.x * 0.85, 1.7, pemain.pos.z - 7);
  kamera.fov = THREE.MathUtils.damp(kamera.fov, 55 + (pemain.faktorLari - 1) * 9, 6, dt);
  kamera.updateProjectionMatrix();

  /* ---- dunia ambient ---- */
  dunia.update(dt, waktuGlobal, pemain.pos);
  perbaruiPopProp(dt);

  /* ---- deteksi desa terdekat ---- */
  state.desaDekat = null;
  for (const desa of dunia.desaList) {
    if (pemain.pos.distanceTo(desa.titik) < CONFIG.jarakKunjungi) { state.desaDekat = desa; break; }
  }
  const dekat = state.desaDekat;
  el.promptDesa.hidden = !dekat || state.popupTerbuka || perangkatSentuh;
  if (dekat) el.promptNama.textContent = dekat.data.nama;

  /* perangkat sentuh : card desa terbuka otomatis saat sampai di gapura */
  if (dekat && perangkatSentuh && waktuGlobal > state.jedaKunjungOtomatis) {
    kunjungiDesa(dekat);
  }

  /* ---- NPC pinggir jalan menyapa lewat balon ucapan saat dilewati ---- */
  for (const npc of dunia.npcList) {
    if (pemain.pos.distanceTo(npc.titik) < 7.5 && waktuGlobal > npc.diamHingga) {
      npc.diamHingga = waktuGlobal + 10;       // jangan menyapa terus-menerus
      dunia.tampilkanUcapan(npc);
    }
  }

  /* ---- HUD waktu ---- */
  el.waktuMain.textContent = formatWaktu(state.waktu);

  /* ---- ujung jalan : kabut menutup, perjalanan berakhir (apa pun progres) ---- */
  if (pemain.pos.z < dunia.batas.zMin + 14 && !state.ujungTersentuh) {
    state.ujungTersentuh = true;
    tampilkanToast("🌫️ Kabut tipis mulai menutupi jalan…");
  }
  if (pemain.pos.z <= dunia.batas.zMin + 1.5 && !state.popupTerbuka) {
    tampilkanAkhir();
  }

  /* ---- minimap ---- */
  gambarMinimap();

  renderer.render(scene, kamera);
}

/* ---------------------------------------------------------------------------
   09. PROGRES EKSPLORASI
--------------------------------------------------------------------------- */
function bangunChipsDesa() {
  el.daftarDesa.innerHTML = "";
  DESA_LIST.forEach((d, i) => {
    const chip = document.createElement("div");
    chip.className = "chip-desa";
    chip.title = d.nama;
    chip.innerHTML = `<span class="titik"></span><span class="nama">${i + 1}. ${d.nama.replace(/^Desa\s+/i, "")}</span>`;
    el.daftarDesa.appendChild(chip);
  });
}
bangunChipsDesa();

function segarkanProgres() {
  const jumlah = state.dikunjungi.size;
  const total = DESA_LIST.length;
  el.progresJumlah.textContent = jumlah;
  el.progresTotal.textContent = total;
  el.progresIsi.style.width = (jumlah / total) * 100 + "%";
  el.daftarDesa.querySelectorAll(".chip-desa").forEach((chip, i) => {
    chip.classList.toggle("selesai", state.dikunjungi.has(i));
  });
}

/* ---------------------------------------------------------------------------
   MINI MAP
--------------------------------------------------------------------------- */
const mm = el.minimap.getContext("2d");

function gambarMinimap() {
  const W = el.minimap.width, H = el.minimap.height;
  /* rentang peta mengikuti panjang dunia saat ini */
  const zAtas = dunia.batas.zMax;
  const zBawah = dunia.batas.zMin;
  const petaY = (z) => 12 + ((zAtas - z) / (zAtas - zBawah)) * (H - 24);
  const petaX = (x) => W / 2 + x * 2.6;

  mm.clearRect(0, 0, W, H);

  /* badan jalan */
  mm.fillStyle = "rgba(23, 48, 31, .20)";
  mm.fillRect(W / 2 - 4, 12, 8, H - 24);

  /* sungai */
  mm.fillStyle = "rgba(70, 140, 200, .55)";
  mm.fillRect(6, petaY(dunia.posisiSungai) - 1.5, W - 12, 3);

  /* titik ujung jalan (kabut penutup cerita) */
  mm.fillStyle = "rgba(120, 130, 140, .45)";
  mm.fillRect(6, 10, W - 12, 2);

  /* desa */
  dunia.desaList.forEach((desa) => {
    const x = petaX(desa.sisi * 13);
    const y = petaY(desa.z);
    const selesai = state.dikunjungi.has(desa.index);
    const tujuan = state.targetDesa === desa.index;

    mm.beginPath();
    mm.arc(x, y, 4.2, 0, Math.PI * 2);
    if (selesai) {
      mm.fillStyle = "#2e8b57";
      mm.fill();
      mm.strokeStyle = "rgba(255,255,255,.9)";
      mm.lineWidth = 1.2;
      mm.stroke();
      /* tanda centang */
      mm.strokeStyle = "#fff";
      mm.lineWidth = 1.6;
      mm.beginPath();
      mm.moveTo(x - 2, y);
      mm.lineTo(x - 0.5, y + 2);
      mm.lineTo(x + 2.2, y - 2);
      mm.stroke();
    } else {
      mm.fillStyle = "rgba(255,255,255,.85)";
      mm.fill();
      mm.strokeStyle = tujuan ? "#d98314" : "rgba(23, 48, 31, .55)";
      mm.lineWidth = tujuan ? 2.4 : 1.4;
      mm.stroke();
    }

    /* cincin denyut untuk desa dalam jangkauan */
    if (state.desaDekat === desa) {
      mm.beginPath();
      mm.arc(x, y, 7 + Math.sin(waktuGlobal * 5) * 1.5, 0, Math.PI * 2);
      mm.strokeStyle = "#d98314";
      mm.lineWidth = 1.6;
      mm.stroke();
    }
  });

  /* pemain : segitiga arah hadap */
  const px = petaX(pemain.pos.x);
  const py = petaY(pemain.pos.z);
  mm.save();
  mm.translate(px, py);
  mm.rotate(pemain.yaw);
  mm.fillStyle = "#e53935";
  mm.strokeStyle = "#fff";
  mm.lineWidth = 1;
  mm.beginPath();
  mm.moveTo(0, -5.5);
  mm.lineTo(3.8, 4);
  mm.lineTo(0, 2);
  mm.lineTo(-3.8, 4);
  mm.closePath();
  mm.fill();
  mm.stroke();
  mm.restore();
}

/* ---------------------------------------------------------------------------
   08. POPUP INFORMASI DESA
--------------------------------------------------------------------------- */
/* Warna hex -> versi lebih gelap (untuk gradasi ilustrasi placeholder) */
function warnaGelap(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * f | 0;
  const g = ((n >> 8) & 255) * f | 0;
  const b = (n & 255) * f | 0;
  return `rgb(${r},${g},${b})`;
}

/* Ilustrasi placeholder (SVG data-URI) bergaya poskart desa — dipakai
   bila kolom foto di data.js masih kosong */
function ilustrasiDesa(desa, varian = 0) {
  const w = 640, h = 420;
  const gelap = warnaGelap(desa.warna, 0.55);
  const gelap2 = warnaGelap(desa.warna, 0.75);
  const matahariX = 110 + varian * 140;
  const geser = varian * 26;
  const nama = varian === 0 ? desa.nama : `Foto ${varian}`;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<defs>` +
    `<linearGradient id='langit' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='#8ecdf0'/><stop offset='0.7' stop-color='#e8f4f6'/><stop offset='1' stop-color='#fdf3d8'/>` +
    `</linearGradient>` +
    `<radialGradient id='matahari' cx='0.5' cy='0.5' r='0.5'>` +
    `<stop offset='0' stop-color='#fff8d8'/><stop offset='0.6' stop-color='#ffe89a'/><stop offset='1' stop-color='#ffe89a' stop-opacity='0'/>` +
    `</radialGradient>` +
    `</defs>` +
    /* langit + matahari */
    `<rect width='${w}' height='${h}' fill='url(#langit)'/>` +
    `<circle cx='${matahariX}' cy='92' r='70' fill='url(#matahari)'/>` +
    `<circle cx='${matahariX}' cy='92' r='26' fill='#fff4c1'/>` +
    `<ellipse cx='${480 - geser}' cy='70' rx='58' ry='16' fill='#ffffff' opacity='.85'/>` +
    `<ellipse cx='${540 - geser}' cy='56' rx='40' ry='12' fill='#ffffff' opacity='.85'/>` +
    /* gunung berlapis */
    `<path d='M-20 250 L130 130 L250 240 L360 150 L480 250 Z' fill='#7d9c8a'/>` +
    `<path d='M300 250 L440 140 L560 235 L660 170 L660 250 Z' fill='#6f8f7d'/>` +
    /* hamparan sawah / kebun */
    `<rect y='250' width='${w}' height='170' fill='${desa.warna}'/>` +
    `<rect y='250' width='${w}' height='170' fill='url(#g)' opacity='0'/>` +
    `<path d='M0 262 Q320 246 640 260 L640 284 Q320 270 0 284 Z' fill='#ffffff' opacity='.14'/>` +
    `<path d='M0 300 Q320 286 640 298 L640 322 Q320 310 0 322 Z' fill='#ffffff' opacity='.12'/>` +
    `<path d='M0 342 Q320 330 640 340 L640 364 Q320 354 0 364 Z' fill='#ffffff' opacity='.10'/>` +
    /* jalan setapak membelok masuk desa */
    `<path d='M268 420 L318 300 L346 300 L420 420 Z' fill='#d9c49a'/>` +
    /* rumah-rumah desa */
    `<g transform='translate(${96 + geser} 232)'>` +
    `<rect x='0' y='22' width='86' height='44' fill='#f4e8cd'/><path d='M-9 24 L43 -10 L95 24 Z' fill='#c0503a'/>` +
    `<rect x='12' y='34' width='17' height='32' fill='#6d4c41'/><rect x='48' y='36' width='20' height='17' fill='#bcdcec'/>` +
    `</g>` +
    `<g transform='translate(${452 - geser} 226) scale(.9)'>` +
    `<rect x='0' y='22' width='86' height='44' fill='#f0e2c2'/><path d='M-9 24 L43 -10 L95 24 Z' fill='#a8432f'/>` +
    `<rect x='12' y='34' width='17' height='32' fill='#6d4c41'/><rect x='48' y='36' width='20' height='17' fill='#bcdcec'/>` +
    `</g>` +
    /* pohon palem */
    `<g transform='translate(${40 - geser} 268)' fill='#2f6b3a'>` +
    `<path d='M6 44 q-4 -34 0 -56 q4 22 0 56 Z'/><path d='M6 -10 q-20 -10 -30 -4 q16 2 26 10 Z'/>` +
    `<path d='M6 -10 q20 -10 30 -4 q-16 2 -26 10 Z'/><path d='M6 -10 q-12 -16 -24 -18 q14 7 20 22 Z'/>` +
    `<path d='M6 -10 q12 -16 24 -18 q-14 7 -20 22 Z'/>` +
    `</g>` +
    /* pita nama desa */
    `<rect x='0' y='${h - 58}' width='${w}' height='58' fill='${gelap}' opacity='.82'/>` +
    `<text x='${w / 2}' y='${h - 20}' font-size='26' font-weight='800' text-anchor='middle' fill='#ffffff' ` +
    `font-family='Poppins, Segoe UI, sans-serif'>${nama}</text>` +
    /* lencana ikon tema */
    `<circle cx='64' cy='64' r='40' fill='#ffffff' opacity='.92'/>` +
    `<circle cx='64' cy='64' r='40' fill='none' stroke='${gelap2}' stroke-width='4'/>` +
    `<text x='64' y='82' font-size='44' text-anchor='middle'>${desa.ikon}</text>` +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function kunjungiDesa(desa) {
  const baru = !state.dikunjungi.has(desa.index);
  state.dikunjungi.add(desa.index);
  if (baru) {
    dunia.tandaiDikunjungi(desa.index);
    segarkanProgres();
    AudioEngine.sfx("kunjungan");
  }
  /* avatar otomatis memakai properti khas desa (catatan konsep: tiap desa
     punya properti berbeda — laptop untuk desa digital, dll.) */
  pasangPropTema(desa.data.propTema);
  bukaPopup(desa);
}

/* pasang / lepas properti tema pada karakter dengan animasi kecil muncul */
let popWaktu = -1;
function pasangPropTema(jenis) {
  const props = karakter.bagian.propsTema;
  for (const kunciProp in props) props[kunciProp].visible = kunciProp === jenis;
  if (jenis) {
    props[jenis].scale.setScalar(0.01);
    popWaktu = 0;
  }
}

function perbaruiPopProp(dt) {
  if (popWaktu < 0) return;
  popWaktu = Math.min(popWaktu + dt, 0.4);
  const t = popWaktu / 0.4;
  const s = 1 - Math.pow(1 - t, 3);                       // ease-out
  const props = karakter.bagian.propsTema;
  for (const kunciProp in props) {
    if (props[kunciProp].visible) props[kunciProp].scale.setScalar(0.01 + s * 0.99);
  }
  if (t >= 1) popWaktu = -1;
}

function bukaPopup(desa) {
  const d = desa.data;
  lepasKemudiPaksa();                       // lepas kendali sentuh selama card terbuka
  state.popupTerbuka = true;

  el.popupTema.textContent = `${d.ikon} ${d.tema}`;
  el.popupDaerah.textContent = "📍 " + d.daerah;
  el.popupNama.textContent = d.nama;
  el.popupDeskripsi.textContent = d.deskripsi;
  el.popupCiriKhas.textContent = d.ciriKhas;
  el.popupPenduduk.textContent = d.penduduk.toLocaleString("id-ID");
  el.popupLuas.textContent = d.luas.toLocaleString("id-ID");
  el.popupKeunggulan.innerHTML = d.keunggulan.map((t) => `<span class="chip">${t}</span>`).join("");
  el.popupProduk.innerHTML = d.produk.map((t) => `<span class="chip">${t}</span>`).join("");
  el.popupWisata.innerHTML = d.wisata.map((t) => `<li>${t}</li>`).join("");
  el.popupUmkm.innerHTML = d.umkm.map((t) => `<li>${t}</li>`).join("");

  /* foto utama + galeri mini (pakai placeholder bila kosong) */
  el.popupImg.src = d.foto || ilustrasiDesa(d, 0);
  el.popupGaleri.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const thumb = document.createElement("img");
    thumb.src = (d.galeri && d.galeri[i]) || ilustrasiDesa(d, i + 1);
    thumb.alt = `Galeri ${i + 1}`;
    if (i === 0) thumb.classList.add("dipilih");
    thumb.addEventListener("click", () => {
      el.popupImg.src = thumb.src;
      el.popupGaleri.querySelectorAll("img").forEach((t) => t.classList.remove("dipilih"));
      thumb.classList.add("dipilih");
    });
    el.popupGaleri.appendChild(thumb);
  }

  /* label tombol lanjut */
  const sisa = DESA_LIST.length - state.dikunjungi.size;
  el.popupLanjut.innerHTML = sisa > 0 ? "Desa Berikutnya →" : "Lihat Hasil";

  el.popup.classList.add("tampil");
  el.popup.setAttribute("aria-hidden", "false");
  el.promptDesa.hidden = true;
}

function tutupPopup() {
  state.popupTerbuka = false;
  el.popup.classList.remove("tampil");
  el.popup.setAttribute("aria-hidden", "true");
  /* jeda sebelum kunjungan otomatis boleh terpicu lagi (mobile),
     agar popup tidak langsung terbuka kembali saat masih di radius desa */
  state.jedaKunjungOtomatis = waktuGlobal + 6;
  /* jika semua desa sudah dikunjungi -> langsung ke layar akhir */
  if (state.dikunjungi.size >= DESA_LIST.length) setTimeout(tampilkanAkhir, 600);
}

/* tombol popup memakai pointerdown agar responsif & andal di layar sentuh —
   event click sering gagal terpicu bila konten popup bisa digulir.
   Guard popupTerbuka mencegah eksekusi ganda (pointerdown + click). */
function pasangTombolPopup(tombol, aksi) {
  const jalankan = () => {
    if (!state.popupTerbuka) return;
    AudioEngine.sfx("klik");
    aksi();
  };
  tombol.addEventListener("pointerdown", (e) => { e.preventDefault(); jalankan(); });
  tombol.addEventListener("click", jalankan);
}
pasangTombolPopup(el.popupTutup, tutupPopup);
pasangTombolPopup(el.popupTutupX, tutupPopup);

function aksiDesaBerikutnya() {
  const sisa = DESA_LIST.length - state.dikunjungi.size;
  if (sisa <= 0) { tutupPopup(); return; }

  /* cari desa berikutnya yang belum dikunjungi (berputar) */
  const kini = state.desaDekat ? state.desaDekat.index : -1;
  let target = null;
  for (let langkah = 1; langkah <= DESA_LIST.length; langkah++) {
    const i = (((kini + langkah) % DESA_LIST.length) + DESA_LIST.length) % DESA_LIST.length;
    if (!state.dikunjungi.has(i)) { target = i; break; }
  }
  if (target != null) {
    state.targetDesa = target;
    dunia.setTargetDesa(target);
    state.popupTerbuka = false;
    state.jedaKunjungOtomatis = waktuGlobal + 6;
    el.popup.classList.remove("tampil");
    tampilkanToast("Ikuti mercu cahaya ke " + DESA_LIST[target].nama);
  }
}
pasangTombolPopup(el.popupLanjut, aksiDesaBerikutnya);

/* ---------------------------------------------------------------------------
   10. LAYAR AKHIR — kabut awan menutup perjalanan (misterius, tanpa confetti)
--------------------------------------------------------------------------- */
function tampilkanAkhir() {
  if (state.layar === "akhir") return;
  el.akhirDesa.textContent = state.dikunjungi.size;
  el.akhirWaktu.textContent = formatWaktu(state.waktu);
  AudioEngine.sfx("sukses");
  pindahLayar("akhir");
}

el.btnUlang.addEventListener("click", () => {
  AudioEngine.sfx("klik");
  bangunUlangDunia();
  resetPermainan();
  pindahLayar("game");
});

el.btnBeranda.addEventListener("click", () => {
  AudioEngine.sfx("klik");
  pindahLayar("landing");
});

/* ---------------------------------------------------------------------------
   MODE PENGEMBANG — buka index.html#dev lalu gunakan konsol browser:
   __DESA.teleport(z)  : pindahkan pemain (z antara 20 s.d. -688)
   __DESA.kunjungiSemua() : tandai semua desa (untuk uji layar akhir)
--------------------------------------------------------------------------- */
if (location.hash.includes("dev")) {
  window.__DESA = {
    teleport(z) {
      pemain.pos.z = z;
      kamera.position.set(pemain.pos.x, 5.6, z + 10.2);
    },
    kunjungiSemua() {
      DESA_LIST.forEach((_, i) => {
        state.dikunjungi.add(i);
        dunia.tandaiDikunjungi(i);
      });
      segarkanProgres();
    },
    pemain, state,
  };
}