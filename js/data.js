/* ============================================================================
   DATA DESA — EDIT DI FILE INI untuk mengubah / menambah desa
   ----------------------------------------------------------------------------
   Konsep "Desa Tematik" : jelajahi desa berdasarkan kekuatan uniknya.
   Empat tema : WISATA, DIGITAL, PANGAN, ENERGI (satu desa per tema).
   Posisi kanan/kiri otomatis bergantian (desa ganjil = kanan jalan).

   - 'foto' dan 'galeri' : isi path gambar, mis. "images/desa1.jpg".
     Jika kosong ("") otomatis memakai ilustrasi placeholder sesuai 'warna'.
   - 'landmark' : bangunan ikonik di dunia 3D. Pilihan:
       "menara" (menara pandang) | "sinyal" (menara BTS/digital)
       "lumbung" (lumbung padi)  | "panel" (PLTS + turbin angin)
   - 'propTema' : properti yang otomatis dikenakan avatar saat mengunjungi
       desa ini : "wisata" (kamera) | "digital" (laptop)
                  "pangan" (malai padi) | "energi" (panel surya mini)
   ============================================================================ */

const CONFIG = {
  jumlahDesaDibutuhkan : 4,      // target kunjungan untuk menamatkan game
  jarakAntarDesa       : 38,     // meter (satuan dunia 3D) antar desa — dekat agar seru
  jarakAwalDesa        : 40,     // jarak desa pertama dari titik start
  jarakKunjungi        : 9.5,    // radius "Tekan E untuk Mengunjungi"
  kecepatanJalan       : 5.8,    // kecepatan normal (satuan/detik)
  faktorLari           : 1.55,   // perkalian kecepatan saat berlari
  waktuTahanLari       : 1.1,    // detik menahan maju sebelum mulai lari
  warnaLangit          : "#dfeef8",
};

const DESA_LIST = [
  {
    tema: "Desa Wisata",
    nama: "Desa Wisata Nglanggeran",
    daerah: "Kabupaten Gunungkidul, Yogyakarta",
    deskripsi:
      "Desa di lereng gunung api purba yang mengubah dirinya dari daerah terpencil " +
      "menjadi destinasi wisata favorit. Warga bersama mengelola homestay, pemanduan, " +
      "dan spot sunrise yang terkenal hingga luar daerah.",
    keunggulan: ["Ekowisata gunung api purba", "Homestay dikelola warga", "Sunrise point terkenal"],
    ciriKhas:
      "Bukit berkabut saat pagi, jejak lava purba berusia jutaan tahun, dan gotong royong " +
      "warga menjaga trail tetap asri.",
    produk: ["Olahan durian", "Kopi robusta desa", "Kerajinan anyaman"],
    wisata: ["Sunrise point Bukit Panguk", "Track gunung api purba", "Embung Nglanggeran"],
    umkm: ["Homestay Nglanggeran Utama", "Kedai kopi Bukit Tua", "Oleh-oleh Durian Ngglanggeran"],
    penduduk: 2845,
    luas: 358,
    warna: "#3f8f5f",
    ikon: "🏝️",
    landmark: "menara",
    propTema: "wisata",
    foto: "",
    galeri: ["", "", ""],
  },
  {
    tema: "Desa Digital",
    nama: "Desa Digital Sukamaju",
    daerah: "Kabupaten Bantul, Yogyakarta",
    deskripsi:
      "Desa yang layanan publik dan UMKM-nya berjalan serba digital: antrean online, " +
      "pembayaran QRIS, sampai bazar produk desa di marketplace. Pemuda desa berperan " +
      "sebagai kreator konten dan pendamping literasi digital warga.",
    keunggulan: ["Layanan administrasi online", "UMKM masuk marketplace", "Kreator konten lokal"],
    ciriKhas:
      "Menara sinyal desa menjadi penanda kemajuan: hampir seluruh rumah punya akses " +
      "internet dan setiap dusun punya admin media sosialnya sendiri.",
    produk: ["Keripik singkong", "Kopi kemasan desa", "Craft digital-print"],
    wisata: ["Kelas literasi digital", "Studio kreator desa", "Mural spot foto interaktif"],
    umkm: ["Toko online Sukamaju", "Jasa desain grafis desa", "Bazar digital rutin"],
    penduduk: 2130,
    luas: 186,
    warna: "#2e86ab",
    ikon: "💻",
    landmark: "sinyal",
    propTema: "digital",
    foto: "",
    galeri: ["", "", ""],
  },
  {
    tema: "Desa Pangan",
    nama: "Desa Swasembada Pangan Mekar Sari",
    daerah: "Kabupaten Sleman, Yogyakarta",
    deskripsi:
      "Lumbung pangan kelurahan dengan sawah yang dikelola secara berkelanjutan. " +
      "Petani menggunakan benih lokal dan pupuk organik sehingga produksi beras " +
      "stabil dan harga pangan di pasar desa tetap terjangkau.",
    keunggulan: ["Produksi beras organik stabil", "Benih lokal & pupuk organik", "Pertanian presisi"],
    ciriKhas:
      "Hamparan sawah hijau bertgaleng dengan lumbung padi desa di tengahnya; " +
      "panen raya menjadi perayaan bersama seluruh warga.",
    produk: ["Beras organik premium", "Jagung & umbi lokal", "Tepung mocaf"],
    wisata: ["Wisata edukasi panen padi", "Lumbung padi desa", "Kebun bibit komunal"],
    umkm: ["Penggilingan beras Mekar", "Keripik pangan lokal", "Koperasi tani sumber pangan"],
    penduduk: 3960,
    luas: 520,
    warna: "#c99a2e",
    ikon: "🌾",
    landmark: "lumbung",
    propTema: "pangan",
    foto: "",
    galeri: ["", "", ""],
  },
  {
    tema: "Desa Energi",
    nama: "Desa Energi Sumber Rejo",
    daerah: "Kabupaten Klaten, Jawa Tengah",
    deskripsi:
      "Desa yang membangkitkan listriknya sendiri dari matahari dan biogas kandang sapi. " +
      "Panel surya komunal menerangi balai desa dan jalan utama, sedangkan biogas " +
      "menghidupkan dapur-produksi tahu warga.",
    keunggulan: ["PLTS komunal", "Biogas dari kandang sapi", "Bank energi desa"],
    ciriKhas:
      "Turbin angin kecil berputar di sisi sawah dan atap-atap rumah berselimut panel " +
      "surya — tagihan listrik warga jauh lebih hemat.",
    produk: ["Briket biomassa", "Tahu uap biogas", "Sayur hidroponik"],
    wisata: ["Edukasi pembangkit listrik desa", "Kumbung biogas", "Taman panel surya"],
    umkm: ["Produksi briket Sumber Rejo", "Pabrik tahu Ambarukmo", "Hidroponik Energi Hijau"],
    penduduk: 1740,
    luas: 240,
    warna: "#ef8f2e",
    ikon: "⚡",
    landmark: "panel",
    propTema: "energi",
    foto: "",
    galeri: ["", "", ""],
  },
];

/* ---------------------------------------------------------------------------
   Pemeriksaan kecil : pastikan jumlah desa sesuai target config.
--------------------------------------------------------------------------- */
if (DESA_LIST.length !== CONFIG.jumlahDesaDibutuhkan) {
  console.warn(
    `[data.js] Jumlah desa di DESA_LIST (${DESA_LIST.length}) berbeda dari ` +
    `CONFIG.jumlahDesaDibutuhkan (${CONFIG.jumlahDesaDibutuhkan}). ` +
    `Permainan tetap berjalan, target penyelesaian mengikuti jumlah desa.`
  );
}
