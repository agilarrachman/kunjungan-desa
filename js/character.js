/* ============================================================================
   KARAKTER — pembuatan avatar 3D + sistem kustomisasi + preview interaktif
   ----------------------------------------------------------------------------
   Gaya karakter mengikuti referensi "toy/chibi game": kepala besar bulat,
   wajah sederhana (mata oval + senyum tipis), rambut glossy menutup setengah
   kepala, baju oversize, kaki ramping, dan sepatu chunky — namun tetap
   berpenampilan orang desa (caping, sarung, dsb.) lengkap dengan pilihan
   gender & aksesoris.
   Arah hadap model = sumbu +Z. Proporsi : pinggul 0,62 · bahu 1,02 ·
   kepala pusat 1,36 (r 0,30).
   ============================================================================ */

/* ---------------------------------------------------------------------------
   PALET WARNA — tambah/ubah pilihan warna di sini
--------------------------------------------------------------------------- */
const PALET = {
  kulit:   ["#f8ddc0", "#f0cba6", "#dfae7a", "#c08c55", "#96602f", "#6b4423"],
  rambut:  ["#141210", "#2f2410", "#4b2e18", "#7a4a21", "#a56b2c", "#e8d39a", "#9aa0a6"],
  pakaian: ["#2e7d32", "#1565c0", "#c0392b", "#ef6c00", "#8e24aa", "#00838f", "#f9a825", "#37474f"],
};

/* ---------------------------------------------------------------------------
   DAFTAR AKSESORIS — id dipakai konfigurasi, emoji dipakai label popup.
--------------------------------------------------------------------------- */
const AKSESORIS = [
  { id: "caping",    nama: "Topi Caping",        emoji: "👒" },
  { id: "sarung",    nama: "Sarung",             emoji: "🧣" },
  { id: "tas",       nama: "Tas Anyaman",        emoji: "🧺" },
  { id: "pentungan", nama: "Pentungan Keamanan", emoji: "🪄" },
  { id: "lampu",     nama: "Lampu Minyak",       emoji: "🏮" },
  { id: "keranjang", nama: "Keranjang Panen",    emoji: "🌽" },
  { id: "cangkul",   nama: "Cangkul",            emoji: "⛏️" },
  { id: "pikul",     nama: "Bambu Pikul",        emoji: "🥢" },
  { id: "ikat",      nama: "Ikat Kepala",        emoji: "🎗️" },
  { id: "rompi",     nama: "Rompi Taruna",       emoji: "🦺" },
  { id: "boot",      nama: "Sepatu Boot Sawah",  emoji: "🥾" },
  { id: "payung",    nama: "Payung Bambu",       emoji: "☂️" },
];

/* ---------------------------------------------------------------------------
   KONFIGURASI KARAKTER
--------------------------------------------------------------------------- */
function konfigDefault() {
  return {
    gender: "laki",
    kulit: PALET.kulit[1],
    rambut: PALET.rambut[1],
    pakaian: PALET.pakaian[0],
    aksesoris: ["caping"],
  };
}

/* Acak total — dipakai tombol "Random Character" */
function acakKonfig() {
  const pilih = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const teracak = AKSESORIS.slice().sort(() => Math.random() - 0.5);
  const jumlah = 2 + Math.floor(Math.random() * 3);           // 2-4 aksesoris
  return {
    gender: Math.random() < 0.5 ? "laki" : "perempuan",
    kulit: pilih(PALET.kulit),
    rambut: pilih(PALET.rambut),
    pakaian: pilih(PALET.pakaian),
    aksesoris: teracak.slice(0, jumlah).map((a) => a.id),
  };
}

/* ---------------------------------------------------------------------------
   UTILITAS KECIL
--------------------------------------------------------------------------- */
function gelapkan(hex, faktor = 0.7) {         // gelapkan warna hex
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * faktor);
  const g = Math.round(((n >> 8) & 255) * faktor);
  const b = Math.round((n & 255) * faktor);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

function mat(warna, opsi = {}) {               // material standar karakter
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(warna).convertSRGBToLinear(),
    roughness: 0.65,
    metalness: 0.0,
    ...opsi,
  });
}

/* Tambahkan mesh siap-pakai ke sebuah grup */
function tambah(parent, geo, material, o = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(o.x || 0, o.y || 0, o.z || 0);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
  parent.add(m);
  return m;
}

/* Tekstur kotak-kotak (sarung) — dibuat via canvas supaya tak butuh file */
function teksturKotak(warna) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = warna;
  g.fillRect(0, 0, 128, 128);
  g.globalAlpha = 0.32; g.fillStyle = "#000";
  for (let i = 0; i < 128; i += 16) { g.fillRect(i, 0, 6, 128); g.fillRect(0, i, 128, 6); }
  g.globalAlpha = 0.5; g.fillStyle = "#fff";
  for (let i = 8; i < 128; i += 32) { g.fillRect(i, 0, 2, 128); g.fillRect(0, i, 128, 2); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/* ---------------------------------------------------------------------------
   PEMBANGUN KARAKTER (gaya toy/chibi)
   Hasil : { grup, bagian: {kakiKiri, kakiKanan, tanganKiri, tanganKanan,
            badan, kepala, lampuApi, propsTema} }
--------------------------------------------------------------------------- */
function buildKarakter(cfg) {
  const mKulit   = mat(cfg.kulit, { roughness: 0.5 });
  const mRambut  = mat(cfg.rambut, { roughness: 0.35 });            // glossy seperti referensi
  const mPakaian = mat(cfg.pakaian, { roughness: 0.8 });
  const mHem     = mat(gelapkan(cfg.pakaian, 0.8), { roughness: 0.8 });
  const mCelana  = mat(gelapkan(cfg.pakaian, 0.5), { roughness: 0.8 });
  const mSepatu  = mat("#43413e", { roughness: 0.55 });
  const mSolet   = mat("#f0ece2", { roughness: 0.6 });
  const mBambu   = mat("#c8a557");
  const mAnyam   = mat("#d9a441", { roughness: 0.95 });

  const grup = new THREE.Group();

  /* ---------- KAKI (pivot di pinggul) : ramping + celana pendek + sepatu ---------- */
  function buatKaki(sisi) {
    const pivot = new THREE.Group();
    pivot.position.set(0.105 * sisi, 0.62, 0);
    // celana pendek menutupi pangkal paha
    tambah(pivot, new THREE.CylinderGeometry(0.088, 0.08, 0.24, 12), mCelana, { y: -0.10 });
    // kaki ramping terbuka (kulit) seperti referensi
    tambah(pivot, new THREE.CylinderGeometry(0.062, 0.052, 0.42, 12), mKulit, { y: -0.42 });
    // sepatu chunky : sol tebal putih + upper gelap
    tambah(pivot, new THREE.BoxGeometry(0.15, 0.055, 0.27), mSolet, { y: -0.655, z: 0.05 });
    tambah(pivot, new THREE.BoxGeometry(0.135, 0.075, 0.24), mSepatu, { y: -0.595, z: 0.04 });
    grup.add(pivot);
    return pivot;
  }
  const kakiKiri = buatKaki(1);
  const kakiKanan = buatKaki(-1);

  /* ---------- BADAN (pivot di pinggul) : baju oversize membulat ---------- */
  const badan = new THREE.Group();
  badan.position.set(0, 0.62, 0);
  // torso oversize : melebar ke bawah, bahu membulat
  const torso = tambah(badan, new THREE.CylinderGeometry(0.185, 0.235, 0.42, 16), mPakaian, { y: 0.21 });
  tambah(badan, new THREE.SphereGeometry(0.19, 16, 12), mPakaian, { y: 0.40, sy: 0.72 });   // bahu membulat
  // bidang bawah baju (hem)
  tambah(badan, new THREE.CylinderGeometry(0.237, 0.237, 0.05, 16), mHem, { y: 0.015 });
  // leher pendek
  tambah(badan, new THREE.CylinderGeometry(0.055, 0.06, 0.09, 10), mKulit, { y: 0.45 });
  grup.add(badan);

  /* ---------- TANGAN (pivot di bahu) : lengan baju longgar + telapak kecil ---------- */
  function buatTangan(sisi) {
    const pivot = new THREE.Group();
    pivot.position.set(0.235 * sisi, 1.02, 0);
    pivot.rotation.z = sisi * 0.10;                       // sedikit terbuka ke samping
    tambah(pivot, new THREE.CylinderGeometry(0.078, 0.062, 0.34, 12), mPakaian, { y: -0.17 }); // lengan baju
    tambah(pivot, new THREE.SphereGeometry(0.05, 10, 8), mKulit, { y: -0.365 });               // telapak
    grup.add(pivot);
    return pivot;
  }
  const tanganKiri = buatTangan(1);
  const tanganKanan = buatTangan(-1);

  /* ---------- KEPALA (pivot di leher) : bulat besar + wajah toy ---------- */
  const kepala = new THREE.Group();
  kepala.position.set(0, 1.06, 0);
  const kepalaBulat = tambah(kepala, new THREE.SphereGeometry(0.30, 28, 22), mKulit, { y: 0.30 });
  kepalaBulat.scale.set(1, 1.02, 0.97);
  // telinga (anting hanya untuk perempuan — ditambahkan di blok rambut)
  [-1, 1].forEach((s) => {
    tambah(kepala, new THREE.SphereGeometry(0.055, 10, 8), mKulit, { x: 0.295 * s, y: 0.30, sz: 0.7 });
  });
  // mata : oval hitam solid
  [-1, 1].forEach((s) => {
    const mata = tambah(kepala, new THREE.SphereGeometry(0.048, 12, 10), mat("#20242a", { roughness: 0.25 }),
      { x: 0.105 * s, y: 0.29, z: 0.252, sy: 1.4, sz: 0.55 });
    mata.rotation.x = -0.05;
    // kilau kecil di mata
    tambah(kepala, new THREE.SphereGeometry(0.013, 6, 6), mat("#ffffff", { roughness: 0.2 }),
      { x: 0.105 * s + 0.016 * s, y: 0.325, z: 0.285 });
  });
  // alis tipis
  [-1, 1].forEach((s) => {
    tambah(kepala, new THREE.BoxGeometry(0.05, 0.009, 0.01), mRambut,
      { x: 0.108 * s, y: 0.395, z: 0.258, rz: s * -0.07 });
  });
  // senyum tipis melengkung
  const senyum = tambah(kepala, new THREE.TorusGeometry(0.05, 0.011, 8, 16, Math.PI * 0.8),
    mat("#8a4a3a", { roughness: 0.4 }), { y: 0.215, z: 0.262, rz: Math.PI + Math.PI * 0.1 });
  senyum.rotation.x = 0.25;
  // blush lembut
  [-1, 1].forEach((s) => {
    tambah(kepala, new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f0a58e").convertSRGBToLinear(),
        transparent: true, opacity: 0.5, roughness: 0.8,
      }), { x: 0.20 * s, y: 0.245, z: 0.185, sz: 0.4, sy: 0.55 });
  });

  /* rambut glossy merapat ke kepala + gaya khas per gender */
  const cap = tambah(kepala, new THREE.SphereGeometry(0.308, 24, 18), mRambut, { y: 0.375, z: -0.075 });
  cap.scale.set(1.0, 0.88, 1.02);

  if (cfg.gender === "perempuan") {
    // anting emas kecil
    [-1, 1].forEach((s) => {
      tambah(kepala, new THREE.SphereGeometry(0.02, 8, 6),
        mat("#e8b64c", { metalness: 0.6, roughness: 0.3 }), { x: 0.302 * s, y: 0.235 });
    });
    // belahan rambut tengah
    const belah = tambah(kepala, new THREE.BoxGeometry(0.035, 0.09, 0.2), mKulit, { y: 0.515, z: 0.07 });
    belah.rotation.x = 0.35;
    // rambut panjang jatuh di belakang bahu sampai punggung
    tambah(kepala, new THREE.BoxGeometry(0.46, 0.62, 0.22), mRambut, { y: -0.04, z: -0.17 });
    tambah(kepala, new THREE.CylinderGeometry(0.075, 0.055, 0.24, 10), mRambut,
      { x: 0.19, y: -0.34, z: -0.14 });
    tambah(kepala, new THREE.CylinderGeometry(0.075, 0.055, 0.24, 10), mRambut,
      { x: -0.19, y: -0.34, z: -0.14 });
    // ikatan rambut belakang
    tambah(kepala, new THREE.SphereGeometry(0.115, 12, 10), mRambut, { y: 0.42, z: -0.28 });
  } else {
    // LAKI-LAKI : rambut pendek rapat, tanpa anting & tanpa kumis
    const poni = tambah(kepala, new THREE.BoxGeometry(0.32, 0.045, 0.045), mRambut, { y: 0.45, z: 0.20 });
    poni.rotation.x = 0.4;
    [-1, 1].forEach((s) => {
      tambah(kepala, new THREE.CylinderGeometry(0.048, 0.032, 0.09, 8), mRambut,
        { x: 0.256 * s, y: 0.31, z: 0.03 });
    });
    // potongan belakang leher (rapat)
    tambah(kepala, new THREE.CylinderGeometry(0.24, 0.27, 0.14, 18, 1, true, 0, Math.PI), mRambut,
      { y: 0.30, z: -0.02, rx: Math.PI / 2, ry: Math.PI });
  }
  grup.add(kepala);

  /* ------------------------------------------------------------------
     AKSESORIS — dipasang sesuai id konfigurasi
  ------------------------------------------------------------------ */
  const pakai = new Set(cfg.aksesoris);
  let lampuApi = null;

  if (pakai.has("caping")) {                   // topi kerucut petani
    tambah(kepala, new THREE.ConeGeometry(0.52, 0.22, 18), mat("#d9b36c", { roughness: 1 }), { y: 0.66, rx: 0.04 });
    tambah(kepala, new THREE.SphereGeometry(0.038, 8, 8), mat("#b98a4a"), { y: 0.78 });
  }

  if (pakai.has("ikat")) {                     // ikat kepala tradisional
    tambah(kepala, new THREE.TorusGeometry(0.295, 0.035, 10, 24), mat("#c62828"), { y: 0.46, rx: Math.PI / 2 });
    tambah(kepala, new THREE.BoxGeometry(0.05, 0.2, 0.02), mat("#c62828"), { x: 0.16, y: 0.34, z: -0.26, rz: 0.35 });
  }

  if (pakai.has("sarung")) {                   // sarung menutupi kaki
    const mSarung = new THREE.MeshStandardMaterial({ map: teksturKotak(cfg.pakaian), roughness: 0.9 });
    tambah(badan, new THREE.CylinderGeometry(0.225, 0.29, 0.60, 16), mSarung, { y: -0.27 });
  }

  if (pakai.has("tas")) {                      // tas anyaman selempang
    tambah(badan, new THREE.BoxGeometry(0.05, 0.48, 0.02), mat("#8d6e63"), { y: 0.20, z: 0.17, rz: -0.5 });
    tambah(badan, new THREE.BoxGeometry(0.17, 0.2, 0.09), mAnyam, { x: 0.235, y: -0.02, z: 0.14, ry: 0.25 });
  }

  if (pakai.has("pentungan")) {
    const t = new THREE.Group();
    t.position.set(0, -0.38, 0.07);
    t.rotation.x = 0.14;
    tambah(t, new THREE.CylinderGeometry(0.026, 0.032, 0.95, 8), mat("#795548"));
    tambah(t, new THREE.TorusGeometry(0.034, 0.009, 8, 14), mat("#4e342e"), { y: 0.32, rx: Math.PI / 2 });
    tambah(t, new THREE.TorusGeometry(0.034, 0.009, 8, 14), mat("#4e342e"), { y: -0.28, rx: Math.PI / 2 });
    tanganKanan.add(t);
  }

  if (pakai.has("lampu")) {                    // lampu minyak di tangan kiri
    const t = new THREE.Group();
    t.position.set(0, -0.42, 0.1);
    tambah(t, new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), mat("#616161"), { y: 0.02 });
    tambah(t, new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ffe9b0").convertSRGBToLinear(),
        transparent: true, opacity: 0.55, roughness: 0.3,
      }), { y: -0.1 });
    tambah(t, new THREE.ConeGeometry(0.08, 0.055, 12), mat("#8d6e63"), { y: -0.015 });
    tambah(t, new THREE.CylinderGeometry(0.073, 0.073, 0.02, 12), mat("#8d6e63"), { y: -0.165 });
    const api = tambah(t, new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ff9800").convertSRGBToLinear(),
        emissive: new THREE.Color("#ff6d00").convertSRGBToLinear(),
        emissiveIntensity: 2,
      }), { y: -0.1 });
    lampuApi = api;
    const cahaya = new THREE.PointLight(0xffb74d, 0.55, 2.6);
    cahaya.position.y = -0.1;
    t.add(cahaya);
    tanganKiri.add(t);
  }

  if (pakai.has("keranjang")) {                // keranjang panen di punggung
    const t = new THREE.Group();
    t.position.set(0, 0.14, -0.27);
    t.rotation.x = -0.14;
    tambah(t, new THREE.BoxGeometry(0.36, 0.28, 0.18), mAnyam);
    tambah(t, new THREE.BoxGeometry(0.30, 0.24, 0.06), mat("#8a5f28"), { z: 0.085 });
    tambah(t, new THREE.SphereGeometry(0.05, 8, 8), mat("#e07b39"), { x: 0.065, y: 0.16 });
    tambah(t, new THREE.SphereGeometry(0.05, 8, 8), mat("#7cb342"), { x: -0.065, y: 0.16, z: 0.03 });
    tambah(t, new THREE.SphereGeometry(0.046, 8, 8), mat("#f4b942"), { y: 0.18, z: -0.05 });
    badan.add(t);
  }

  if (pakai.has("cangkul")) {
    const t = new THREE.Group();
    t.position.set(0, -0.34, 0.07);
    t.rotation.x = 0.16;
    tambah(t, new THREE.CylinderGeometry(0.021, 0.025, 0.9, 8), mat("#a1887f"));
    tambah(t, new THREE.BoxGeometry(0.05, 0.2, 0.02),
      mat("#8f9aa5", { metalness: 0.65, roughness: 0.35 }), { y: -0.52, rz: 0.5 });
    tanganKanan.add(t);
  }

  if (pakai.has("pikul")) {                    // bambu pikul + dua keranjang
    tambah(badan, new THREE.CylinderGeometry(0.018, 0.018, 1.3, 8), mBambu, { y: 0.44, rz: Math.PI / 2 });
    [-1, 1].forEach((s) => {
      tambah(badan, new THREE.CylinderGeometry(0.004, 0.004, 0.13, 4), mat("#8d6e63"), { x: 0.52 * s, y: 0.385 });
      tambah(badan, new THREE.CylinderGeometry(0.004, 0.004, 0.13, 4), mat("#8d6e63"), { x: 0.70 * s, y: 0.385 });
      tambah(badan, new THREE.CylinderGeometry(0.10, 0.07, 0.12, 10), mAnyam, { x: 0.61 * s, y: 0.30 });
      tambah(badan, new THREE.SphereGeometry(0.042, 8, 8), mat("#7cb342"), { x: 0.585 * s, y: 0.375 });
      tambah(badan, new THREE.SphereGeometry(0.042, 8, 8), mat("#e07b39"), { x: 0.64 * s, y: 0.375 });
    });
  }

  if (pakai.has("rompi")) {                    // rompi karang taruna di atas baju
    tambah(badan, new THREE.CylinderGeometry(0.215, 0.258, 0.40, 16), mat("#37474f"), { y: 0.22 });
    tambah(badan, new THREE.TorusGeometry(0.215, 0.026, 8, 18), mat("#263238"), { y: 0.41, rx: Math.PI / 2 });
    tambah(badan, new THREE.CylinderGeometry(0.042, 0.042, 0.012, 12),
      mat("#ffca28", { metalness: 0.4, roughness: 0.4 }), { x: 0.10, y: 0.28, z: 0.205, rx: Math.PI / 2 });
  }

  if (pakai.has("boot")) {                     // boot sawah menggantikan sepatu
    [kakiKiri, kakiKanan].forEach((kaki) => {
      tambah(kaki, new THREE.CylinderGeometry(0.09, 0.098, 0.20, 10), mat("#263238"), { y: -0.53 });
      tambah(kaki, new THREE.BoxGeometry(0.145, 0.075, 0.18), mat("#1c262b"), { y: -0.645, z: 0.045 });
    });
  }

  if (pakai.has("payung")) {                   // payung bambu di tangan kiri
    const t = new THREE.Group();
    t.position.set(0, -0.38, 0.12);
    tambah(t, new THREE.CylinderGeometry(0.015, 0.015, 1.25, 8), mBambu, { y: 0.52 });
    tambah(t, new THREE.ConeGeometry(0.5, 0.25, 14), mat("#f3e5ab", { roughness: 1 }), { y: 1.13 });
    tambah(t, new THREE.ConeGeometry(0.19, 0.115, 10), mat("#e6d08f"), { y: 1.275 });
    tambah(t, new THREE.SphereGeometry(0.02, 6, 6), mBambu, { y: 1.36 });
    tanganKiri.add(t);
  }

  /* ---------- properti tema desa (disembunyikan, aktif saat berkunjung) ---------- */
  const propsTema = buatSemuaPropTema(badan, tanganKiri, tanganKanan);

  /* ---------- bayangan ---------- */
  grup.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
  });

  return {
    grup,
    bagian: {
      kakiKiri, kakiKanan,
      tanganKiri, tanganKanan,
      badan, kepala,
      lampuApi,
      propsTema,
    },
  };
}

/* ---------------------------------------------------------------------------
   PROPERTI TEMA — kamera (wisata), laptop (digital), malai padi (pangan),
   panel surya mini (energi). Disembunyikan lalu diaktifkan saat berkunjung.
--------------------------------------------------------------------------- */
function buatSemuaPropTema(badan, tanganKiri, tanganKanan) {
  const props = {};

  /* --- wisata : kamera gantung di dada --- */
  {
    const t = new THREE.Group();
    tambah(t, new THREE.BoxGeometry(0.19, 0.13, 0.085), mat("#37474f", { roughness: 0.5 }), { y: 0.18, z: 0.235 });
    tambah(t, new THREE.CylinderGeometry(0.052, 0.052, 0.03, 14),
      mat("#263238", { metalness: 0.4, roughness: 0.3 }), { y: 0.18, z: 0.283, rx: Math.PI / 2 });
    tambah(t, new THREE.CylinderGeometry(0.028, 0.028, 0.012, 12),
      mat("#9ecbff", { emissive: "#5b8dd6", emissiveIntensity: 0.6 }), { y: 0.18, z: 0.30, rx: Math.PI / 2 });
    tambah(t, new THREE.BoxGeometry(0.028, 0.3, 0.01), mat("#5d4037"), { x: 0.12, y: 0.33, z: 0.13, rz: 0.5 });
    tambah(t, new THREE.BoxGeometry(0.028, 0.3, 0.01), mat("#5d4037"), { x: -0.12, y: 0.33, z: 0.13, rz: -0.5 });
    t.visible = false;
    badan.add(t);
    props.wisata = t;
  }

  /* --- digital : laptop di tangan kiri --- */
  {
    const t = new THREE.Group();
    t.position.set(0, -0.37, 0.1);
    const mCasing = mat("#455a64", { roughness: 0.4, metalness: 0.3 });
    tambah(t, new THREE.BoxGeometry(0.32, 0.014, 0.22), mCasing, { y: 0.01 });
    const layar = tambah(t, new THREE.BoxGeometry(0.32, 0.21, 0.012), mCasing, { y: 0.115, z: -0.105, rx: -0.32 });
    tambah(layar, new THREE.PlaneGeometry(0.29, 0.18),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#8fc7ff").convertSRGBToLinear(),
        emissive: new THREE.Color("#3d7dd6").convertSRGBToLinear(),
        emissiveIntensity: 0.9,
      }), { z: 0.008 });
    t.visible = false;
    tanganKiri.add(t);
    props.digital = t;
  }

  /* --- pangan : malai padi di tangan kanan --- */
  {
    const t = new THREE.Group();
    t.position.set(0, -0.36, 0.06);
    for (let i = 0; i < 7; i++) {
      const malai = tambah(t, new THREE.CylinderGeometry(0.008, 0.011, 0.48, 5), mat("#c8b04b"),
        { y: -0.1, z: 0.02, rx: -0.5 + (i - 3) * 0.09, rz: (i - 3) * 0.1 });
      malai.position.y = -0.1;
      const bulir = tambah(t, new THREE.ConeGeometry(0.025, 0.105, 6), mat("#e5c04b"),
        { x: Math.sin((i - 3) * 0.1) * 0.21, y: -0.30, z: -0.17 + Math.abs(i - 3) * 0.015, rx: -2.6 });
      bulir.rotation.z = (i - 3) * 0.1;
    }
    tambah(t, new THREE.CylinderGeometry(0.033, 0.033, 0.05, 8), mat("#b3541e"), { y: 0.115 });
    t.visible = false;
    tanganKanan.add(t);
    props.pangan = t;
  }

  /* --- energi : panel surya mini di tangan kiri --- */
  {
    const t = new THREE.Group();
    t.position.set(0, -0.36, 0.1);
    t.rotation.x = 0.35;
    tambah(t, new THREE.BoxGeometry(0.38, 0.02, 0.28), mat("#37474f"), { y: 0 });
    const mSel = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1c3a66").convertSRGBToLinear(),
      emissive: new THREE.Color("#12305e").convertSRGBToLinear(),
      emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3,
    });
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        tambah(t, new THREE.BoxGeometry(0.078, 0.005, 0.058), mSel,
          { x: (j - 1.5) * 0.09, y: 0.013, z: (i - 1) * 0.088 });
      }
    }
    t.visible = false;
    tanganKiri.add(t);
    props.energi = t;
  }

  return props;
}

/* ---------------------------------------------------------------------------
   PREVIEW KARAKTER 3D (layar kustomisasi)
--------------------------------------------------------------------------- */
class PreviewKarakter {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa77, 0.95));
    const mata = new THREE.DirectionalLight(0xfff2d8, 1.15);
    mata.position.set(2.5, 4, 3);
    mata.castShadow = true;
    mata.shadow.mapSize.set(1024, 1024);
    mata.shadow.camera.left = -2.5; mata.shadow.camera.right = 2.5;
    mata.shadow.camera.top = 3;     mata.shadow.camera.bottom = -2;
    mata.shadow.bias = -0.0004;
    this.scene.add(mata);

    const lantai = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 40),
      new THREE.ShadowMaterial({ opacity: 0.28 })
    );
    lantai.rotation.x = -Math.PI / 2;
    lantai.receiveShadow = true;
    this.scene.add(lantai);
    const pijakan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 0.08, 36),
      new THREE.MeshStandardMaterial({ color: "#c9a35a", roughness: 1 })
    );
    pijakan.position.y = -0.04;
    pijakan.receiveShadow = true;
    this.scene.add(pijakan);

    this.kamera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    this.kamera.position.set(0.3, 1.15, 3.4);
    this.kamera.lookAt(0, 0.88, 0);

    this.karakter = null;
    this.yaw = Math.PI;
    this.yawTarget = Math.PI;
    this.sedangDrag = false;

    this._pasangDrag();
    this.resize();
  }

  _pasangDrag() {
    const el = this.canvas;
    let xTerakhir = 0;
    el.addEventListener("pointerdown", (e) => {
      this.sedangDrag = true;
      xTerakhir = e.clientX;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.sedangDrag) return;
      this.yawTarget += (e.clientX - xTerakhir) * 0.012;
      xTerakhir = e.clientX;
    });
    const lepas = () => { this.sedangDrag = false; };
    el.addEventListener("pointerup", lepas);
    el.addEventListener("pointercancel", lepas);
  }

  setKonfig(cfg) {
    if (this.karakter) {
      this.scene.remove(this.karakter.grup);
      this.karakter.grup.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    }
    this.karakter = buildKarakter(cfg);
    this.karakter.grup.rotation.y = this.yaw;
    this.scene.add(this.karakter.grup);
  }

  update(dt, waktu) {
    if (!this.karakter) return;

    if (!this.sedangDrag) this.yawTarget += dt * 0.45;
    this.yaw = THREE.MathUtils.damp(this.yaw, this.yawTarget, 6, dt);
    this.karakter.grup.rotation.y = this.yaw;

    const b = this.karakter.bagian;
    const nafas = Math.sin(waktu * 2.2) * 0.012;
    b.badan.scale.set(1 + nafas, 1 + nafas * 0.7, 1 + nafas);
    b.badan.position.y = 0.62 + Math.sin(waktu * 2.2) * 0.007;
    b.tanganKiri.rotation.x = Math.sin(waktu * 1.8) * 0.06;
    b.tanganKanan.rotation.x = Math.sin(waktu * 1.8 + 1) * 0.06;
    b.kepala.rotation.y = Math.sin(waktu * 0.7) * 0.12;

    this.renderer.render(this.scene, this.kamera);
  }

  resize() {
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    this.kamera.aspect = w / h;
    this.kamera.updateProjectionMatrix();
  }
}
