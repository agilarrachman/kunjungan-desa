/* ============================================================================
   DUNIA — pembangun lingkungan 3D desa (Three.js)
   ----------------------------------------------------------------------------
   Isi :
   - Jalan utama memanjang ke depan (-Z) + marka & bahu jalan
   - 10 desa bergantian kanan/kiri (gapura, papan nama, rumah, landmark)
   - Alam : pohon, pinus, palem, sawah, sungai + jembatan, gunung, awan, burung
   - Sumber cahaya : hemisphere (langit) + directional (matahari + bayangan)
   Semua objek dibuat prosedural -> tidak butuh file model/gambar eksternal.
   ============================================================================ */

class Dunia {
  constructor() {
    this.scene = new THREE.Scene();

    /* panjang dunia mengikuti jumlah desa & jarak antar desa di CONFIG.
       Ekor jalan setelah desa terakhir sengaja pendek — ujung jalan adalah
       tempat perjalanan diakhiri (pemicu layar penutup). */
    this.zMulai = 30;
    this.zAkhir = -(CONFIG.jarakAwalDesa + (DESA_LIST.length - 1) * CONFIG.jarakAntarDesa + 38);
    this.batas = { xMin: -18, xMax: 18, zMax: 28, zMin: this.zAkhir + 16 };

    /* titik sungai melintang jalan — di tengah celah antara dua desa tengah
       agar tidak pernah menabrak area desa manapun */
    const idxTengah = Math.floor(DESA_LIST.length / 2) - 1;
    this.posisiSungai = -(CONFIG.jarakAwalDesa + (idxTengah + 0.5) * CONFIG.jarakAntarDesa);

    /* langit gradasi + kabut jarak (memberi kesan kedalaman sinematik) */
    this.scene.background = this._teksturLangit();
    this.scene.fog = new THREE.Fog(this._warna("#e9f1ec"), 60, 340);

    this.desaList = [];
    this.npcList = [];         // penduduk & pedagang di pinggir jalan
    this._awan = [];
    this._burung = [];
    this._air = [];            // material air yang perlu dianimasikan
    this._turbin = [];         // baling-baling turbin angin
    this._lampuSinyal = [];    // lampu merah menara sinyal (berkedip)

    this._pasangCahaya();
    this._bangunTanah();
    this._bangunJalan();
    this._bangunSawah();
    this._bangunSungai();
    this._bangunGunung();
    this._bangunDesaSemua();
    this._sebarPohon();
    this._bangunAwan();
    this._bangunBurung();
    this._bangunMercuTanda();
    this._bangunNPC();
  }

  /* ==========================================================================
     CAHAYA & LANGIT
  ========================================================================== */
  _pasangCahaya() {
    /* cahaya langit dari segala arah (ambient lembut) */
    this.scene.add(new THREE.HemisphereLight(this._warna("#cfe3ff"), this._warna("#8fb56a"), 0.9));

    /* matahari sore hangat : mengikuti pemain agar bayangan selalu tajam */
    this.matahari = new THREE.DirectionalLight(this._warna("#ffe2b0"), 1.35);
    this.matahari.castShadow = true;
    this.matahari.shadow.mapSize.set(2048, 2048);
    const k = this.matahari.shadow.camera;
    k.left = -48; k.right = 48; k.top = 48; k.bottom = -48; k.near = 5; k.far = 200;
    this.matahari.shadow.bias = -0.0005;
    this.matahari.shadow.normalBias = 0.03;
    this.scene.add(this.matahari);
    this.scene.add(this.matahari.target);
  }

  _teksturLangit() {
    const c = document.createElement("canvas");
    c.width = 2; c.height = 512;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0,  "#3f8fd8");
    grad.addColorStop(0.5,  "#8ec9ef");
    grad.addColorStop(0.8,  "#e6f3fa");
    grad.addColorStop(1.0,  "#f6ead0");
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  /* ==========================================================================
     UTILITAS
  ========================================================================== */
  _acak(a, b) { return a + Math.random() * (b - a); }

  /* Konversi warna sRGB (hex di kode) -> linear ruang kerja renderer.
     Tanpa ini semua warna tampak pucat karena double-encoding. */
  _warna(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  _material(warna, opsi = {}) {
    return new THREE.MeshStandardMaterial({ color: this._warna(warna), roughness: 0.95, ...opsi });
  }

  _mesh(geo, mat, x, y, z, grup) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (grup || this.scene).add(m);
    return m;
  }

  /* ==========================================================================
     TANAH
  ========================================================================== */
  _bangunTanah() {
    const panjang = this.zMulai - this.zAkhir + 60;
    const tanah = new THREE.Mesh(
      new THREE.PlaneGeometry(640, panjang),
      this._material("#5f9a4b", { roughness: 1 })
    );
    tanah.rotation.x = -Math.PI / 2;
    tanah.position.z = (this.zMulai + this.zAkhir) / 2;
    tanah.receiveShadow = true;
    this.scene.add(tanah);

    /* bercak rumput agar tanah tidak monoton */
    for (let i = 0; i < 10; i++) {
      const bercak = new THREE.Mesh(
        new THREE.CircleGeometry(this._acak(7, 18), 20),
        this._material(i % 2 ? "#6cae54" : "#528a41", { roughness: 1 })
      );
      bercak.rotation.x = -Math.PI / 2;
      bercak.position.set(this._acak(-180, 180), 0.004, this._acak(this.zAkhir + 12, 22));
      bercak.receiveShadow = true;
      this.scene.add(bercak);
    }
  }

  /* ==========================================================================
     JALAN UTAMA + MARKA
  ========================================================================== */
  _bangunJalan() {
    const panjang = this.zMulai - this.zAkhir + 10;
    const tengahZ = (this.zMulai + this.zAkhir) / 2;

    const aspal = new THREE.Mesh(
      new THREE.PlaneGeometry(9, panjang),
      this._material("#4d555c", { roughness: 1 })
    );
    aspal.rotation.x = -Math.PI / 2;
    aspal.position.set(0, 0.012, tengahZ);
    aspal.receiveShadow = true;
    this.scene.add(aspal);

    /* bahu jalan tanah */
    [-1, 1].forEach((s) => {
      const bahu = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, panjang),
        this._material("#c0a678", { roughness: 1 })
      );
      bahu.rotation.x = -Math.PI / 2;
      bahu.position.set(5.3 * s, 0.006, tengahZ);
      bahu.receiveShadow = true;
      this.scene.add(bahu);
    });

    /* marka putih putus-putus */
    const mMarka = this._material("#f2f2f2", { roughness: 1 });
    for (let z = 24; z > this.zAkhir; z -= 20) {
      const garis = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2.3), mMarka);
      garis.rotation.x = -Math.PI / 2;
      garis.position.set(0, 0.02, z);
      garis.receiveShadow = true;
      this.scene.add(garis);
    }

    /* rumput kecil di tepi jalan */
    const mRumput = this._material("#3f7a2c", { flatShading: true });
    for (let i = 0; i < 70; i++) {
      const s = Math.random() < 0.5 ? -1 : 1;
      const rumpun = new THREE.Mesh(new THREE.ConeGeometry(0.16, this._acak(0.25, 0.5), 5), mRumput);
      rumpun.position.set(this._acak(4.8, 9.5) * s, 0.12, this._acak(this.zAkhir + 4, 24));
      rumpun.castShadow = true;
      this.scene.add(rumpun);
    }

    /* bunga kecil warna-warni di tepi jalan */
    const warnaBunga = ["#e5527c", "#f6c445", "#ffffff", "#b06fd8"];
    for (let i = 0; i < 46; i++) {
      const s = Math.random() < 0.5 ? -1 : 1;
      const bunga = new THREE.Group();
      const mKelopak = this._material(warnaBunga[i % warnaBunga.length]);
      this._mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 5), mRumput, 0, 0.14, 0, bunga);
      this._mesh(new THREE.SphereGeometry(0.06, 6, 5), mKelopak, 0, 0.32, 0, bunga);
      bunga.position.set(this._acak(4.9, 8.5) * s, 0, this._acak(this.zAkhir + 4, 24));
      this.scene.add(bunga);
    }
  }

  /* ==========================================================================
     SAWAH — petak petak bertekstur galengan di kedua sisi
  ========================================================================== */
  _teksturSawah() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#8fbe4c";
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      g.fillStyle = "#7cab3f";
      g.fillRect(0, y, 128, 5);
      g.fillStyle = "#a3d15f";
      g.fillRect(0, y + 9, 128, 2);
    }
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? "#9fce5a" : "#719c38";
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  _bangunSawah() {
    const teksturDasar = this._teksturSawah();
    for (let i = 0; i < 8; i++) {
      const s = i % 2 === 0 ? 1 : -1;
      const z = -18 - i * 28 - this._acak(0, 14);
      if (Math.abs(z - this.posisiSungai) < 16) continue;

      const w = this._acak(16, 22);
      const d = this._acak(10, 14);
      const grup = new THREE.Group();
      grup.position.set((26 + this._acak(0, 12)) * s, 0, z);

      const tex = teksturDasar.clone();
      tex.needsUpdate = true;
      tex.repeat.set(w / 5, d / 5);
      const petak = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this._material("#ffffff", { map: tex }));
      petak.rotation.x = -Math.PI / 2;
      petak.position.y = 0.05;
      petak.receiveShadow = true;
      grup.add(petak);

      /* galengan (pematang) keliling petak */
      const mGalengan = this._material("#9b8a5a");
      [
        [0, d / 2, w + 0.6, 0.6], [0, -d / 2, w + 0.6, 0.6],
        [w / 2, 0, 0.6, d + 0.6], [-w / 2, 0, 0.6, d + 0.6],
      ].forEach(([gx, gz, gw, gd]) => {
        const pematang = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.16, gd), mGalengan);
        pematang.position.set(gx, 0.08, gz);
        pematang.castShadow = true;
        pematang.receiveShadow = true;
        grup.add(pematang);
      });

      /* satu orong-orong di petak tertentu */
      if (i === 3) {
        const orong = new THREE.Group();
        const mKayu = this._material("#8d6e63");
        this._mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), mKayu, 0, 1.1, 0, orong);
        this._mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), mKayu, 0, 1.8, 0, orong).rotation.z = Math.PI / 2;
        this._mesh(new THREE.SphereGeometry(0.18, 10, 8), this._material("#e8d9b5"), 0, 2.5, 0, orong);
        this._mesh(new THREE.ConeGeometry(0.4, 0.3, 10), this._material("#c9a227"), 0, 2.72, 0, orong);
        this._mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), this._material("#c62828"), 0, 1.8, 0.05, orong);
        orong.position.set(2, 0.05, 2);
        grup.add(orong);
      }

      this.scene.add(grup);
    }
  }

  /* ==========================================================================
     SUNGAI MELINTANG + JEMBATAN
  ========================================================================== */
  _teksturAir() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#4aa3df";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = Math.random() < 0.5 ? "#7cc4ea" : "#e8f6ff";
      g.globalAlpha = 0.35;
      g.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * 256;
      const x = Math.random() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 20, y + 3, x + 40, y);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  _bangunSungai() {
    const z = this.posisiSungai;

    /* dasar sungai & air (lebar pas agar tetap terbaca sebagai sungai) */
    const dasar = this._mesh(new THREE.PlaneGeometry(50, 18), this._material("#2e6da4"), 0, -0.03, z);
    dasar.rotation.x = -Math.PI / 2;
    dasar.receiveShadow = true;
    const tex = this._teksturAir();
    const air = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 14),
      new THREE.MeshStandardMaterial({ color: this._warna("#9ed6f2"), map: tex, transparent: true, opacity: 0.82, roughness: 0.25 })
    );
    air.rotation.x = -Math.PI / 2;
    air.position.set(0, 0.045, z);
    air.receiveShadow = true;
    this.scene.add(air);
    this._air.push(tex);

    /* bibir sungai */
    [-1, 1].forEach((s) => {
      const bibir = new THREE.Mesh(new THREE.BoxGeometry(54, 0.14, 2), this._material("#9b8a5a"));
      bibir.position.set(0, 0.07, z + 8.4 * s);
      bibir.receiveShadow = true;
      this.scene.add(bibir);
    });

    /* jembatan : depan jalan tetap rata */
    const dek = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.18, 21), this._material("#7a6a55"));
    dek.position.set(0, 0.09, z);
    dek.receiveShadow = true;
    dek.castShadow = true;
    this.scene.add(dek);
    [-1, 1].forEach((s) => {
      const pag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 21), this._material("#8d7355"));
      pag.position.set(4.75 * s, 0.45, z);
      pag.castShadow = true;
      this.scene.add(pag);
      for (let pz = z - 9; pz <= z + 9; pz += 4.5) {
        const tiang = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), this._material("#6d5944"));
        tiang.position.set(4.75 * s, 0.45, pz);
        tiang.castShadow = true;
        this.scene.add(tiang);
      }
    });
  }

  /* ==========================================================================
     GUNUNG DI KENAIKAN / KAKI LANGIT
  ========================================================================== */
  _bangunGunung() {
    /* warna sengaja gelap : renderer memakai tone-mapping ACES + output sRGB
       yang membuat warna dasar tampak lebih terang, jadi nilai ini sudah
       dikompensasi agar di layar tampak sebagai siluet hijau-biru sedang.
       Posisi relatif terhadap ujung jalan (zAkhir). */
    const ujung = this.zAkhir;
    const dataGunung = [
      [-70, ujung - 100, 80, 68], [80, ujung - 128, 92, 80], [215, ujung - 78, 62, 52],
      [-215, ujung - 88, 70, 58], [-320, ujung + 150, 60, 48], [330, ujung + 180, 66, 44],
      [-350, -70, 52, 38], [360, -110, 56, 40],
    ];
    dataGunung.forEach(([x, z, r, h], i) => {
      /* material dasar (tanpa cahaya & tanpa kabut) -> tampilan konsisten */
      const gunung = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 7),
        new THREE.MeshBasicMaterial({ color: this._warna(i % 2 ? "#3f5a4e" : "#335044"), fog: false })
      );
      gunung.position.set(x, h / 2 - 2, z);
      this.scene.add(gunung);

      /* kabut pucat di puncak memberi kesan jarak */
      const kabut = new THREE.Mesh(
        new THREE.ConeGeometry(r * 0.4, h * 0.22, 7),
        new THREE.MeshBasicMaterial({ color: this._warna("#b9cec2"), transparent: true, opacity: 0.32, fog: false })
      );
      kabut.position.set(x, h - h * 0.11 - 2, z);
      this.scene.add(kabut);
    });
  }

  /* ==========================================================================
     DESA — gapura, papan nama, rumah, landmark, lampu jalan
  ========================================================================== */
  _bangunDesaSemua() {
    DESA_LIST.forEach((data, i) => {
      const sisi = i % 2 === 0 ? 1 : -1;               // desa ganjil kanan, genap kiri
      const z = -(CONFIG.jarakAwalDesa + i * CONFIG.jarakAntarDesa);
      const grup = new THREE.Group();
      this.scene.add(grup);

      /* tanah padat & jalan setapak dari jalan utama */
      const pad = new THREE.Mesh(new THREE.CircleGeometry(8.5, 26), this._material("#c2b280", { roughness: 1 }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(13 * sisi, 0.02, z);
      pad.receiveShadow = true;
      grup.add(pad);

      const setapak = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.6), this._material("#cbb488", { roughness: 1 }));
      setapak.rotation.x = -Math.PI / 2;
      setapak.position.set(12.5 * sisi, 0.03, z);
      setapak.receiveShadow = true;
      grup.add(setapak);

      this._bangunGapura(grup, sisi, z);
      this._bangunPapanNama(grup, data, sisi, z);

      /* tiga rumah khas */
      [
        [12.5, -6.5, 0.12], [14.6, 0.8, -0.08], [12.5, 7.5, 0.06],
      ].forEach(([dx, dz, putar]) => {
        this._bangunRumah(grup, dx * sisi, z + dz, -sisi * Math.PI / 2 + putar);
      });

      this._bangunLandmark(grup, data, sisi, z);

      /* dua lampu jalan desa */
      [[9, -4], [16, 3.5]].forEach(([dx, dz]) => {
        this._bangunLampuJalan(grup, dx * sisi, z + dz);
      });

      this.desaList.push({
        data,
        index: i,
        sisi,
        z,
        titik: new THREE.Vector3(8.2 * sisi, 0, z),   // titik pemicu interaksi
        grup,
      });
    });
  }

  /* --- gapura (gerbang belah khas nusantara) --- */
  _bangunGapura(grup, sisi, z) {
    const mBata = this._material("#a56b3f");
    const mTrim = this._material("#8d5630");
    [-1, 1].forEach((s) => {
      const p = new THREE.Group();
      p.position.set(6.2 * sisi, 0, z + 1.9 * s);
      this._mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), mTrim, 0, 0.25, 0, p);
      this._mesh(new THREE.BoxGeometry(0.72, 1.7, 0.72), mBata, 0, 1.35, 0, p);
      this._mesh(new THREE.BoxGeometry(0.56, 0.45, 0.56), mTrim, 0, 2.42, 0, p);
      const puncak = this._mesh(new THREE.ConeGeometry(0.5, 0.5, 4), mTrim, 0, 2.9, 0, p);
      puncak.rotation.y = Math.PI / 4;
      this._mesh(new THREE.SphereGeometry(0.08, 8, 8), this._material("#ffca28", { metalness: 0.5, roughness: 0.4 }), 0, 3.25, 0, p);
      grup.add(p);
    });
  }

  /* --- papan nama desa bertekstur kanvas --- */
  _teksturPapan(nama) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 224;
    const g = c.getContext("2d");
    g.fillStyle = "#f7f0dc";
    g.fillRect(0, 0, 512, 224);
    g.strokeStyle = "#8d6e63";
    g.lineWidth = 14;
    g.strokeRect(7, 7, 498, 210);
    g.fillStyle = "#6d8f4a";
    g.font = "600 30px 'Poppins', 'Segoe UI', sans-serif";
    g.textAlign = "center";
    g.fillText("DESA WISATA", 256, 64);
    g.fillStyle = "#33312e";
    g.font = "800 46px 'Poppins', 'Segoe UI', sans-serif";
    const pendek = nama.replace(/^Desa\s+/i, "");
    g.fillText(pendek, 256, 130);
    g.fillStyle = "#8d6e63";
    g.fillRect(150, 158, 212, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  _bangunPapanNama(grup, data, sisi, z) {
    const p = new THREE.Group();
    p.position.set(9.4 * sisi, 0, z + 3.1);
    p.rotation.y = -sisi * Math.PI / 2;              // menghadap jalan utama
    this._mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8), this._material("#6d4c41"), 0, 0.6, 0, p);
    const papan = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.1, 0.1),
      [
        this._material("#8d6e63"), this._material("#8d6e63"),
        this._material("#8d6e63"), this._material("#8d6e63"),
        new THREE.MeshStandardMaterial({ map: this._teksturPapan(data.nama), roughness: 0.8 }),
        this._material("#8d6e63"),
      ]
    );
    papan.position.set(0, 1.55, 0);
    papan.castShadow = true;
    p.add(papan);
    grup.add(p);
  }

  /* --- rumah khas : dinding lembut + atap joglo kerucut --- */
  _bangunRumah(grup, x, z, putar) {
    const rumah = new THREE.Group();
    rumah.position.set(x, 0, z);
    rumah.rotation.y = putar;

    const warnaDinding = ["#f7efe0", "#efe3cc", "#f3e6d0"][Math.floor(Math.random() * 3)];
    const warnaAtap = ["#8c3b2e", "#a04a34", "#6d4c41"][Math.floor(Math.random() * 3)];
    const mDinding = this._material(warnaDinding);
    const mAtap = this._material(warnaAtap, { flatShading: true });

    this._mesh(new THREE.BoxGeometry(3.4, 0.25, 2.8), this._material("#b0a08c"), 0, 0.125, 0, rumah);
    this._mesh(new THREE.BoxGeometry(3.1, 1.8, 2.5), mDinding, 0, 1.15, 0, rumah);
    const atap = this._mesh(new THREE.ConeGeometry(2.8, 1.3, 4), mAtap, 0, 2.2, 0, rumah);
    atap.rotation.y = Math.PI / 4;

    /* pintu, jendela, undakan */
    this._mesh(new THREE.BoxGeometry(0.7, 1.25, 0.07), this._material("#5d4037"), 0, 0.87, 1.28, rumah);
    [-1, 1].forEach((s) => {
      this._mesh(new THREE.BoxGeometry(0.55, 0.6, 0.07), this._material("#4e342e"), 0.95 * s, 1.45, 1.28, rumah);
      this._mesh(new THREE.BoxGeometry(0.4, 0.45, 0.02), this._material("#b3e5fc", { roughness: 0.2 }), 0.95 * s, 1.45, 1.33, rumah);
    });
    this._mesh(new THREE.BoxGeometry(0.95, 0.18, 0.55), this._material("#a1887f"), 0, 0.09, 1.5, rumah);

    grup.add(rumah);
  }

  /* --- lampu jalan desa --- */
  _bangunLampuJalan(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    this._mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.3, 8), this._material("#4e5a63"), 0, 1.15, 0, p);
    this._mesh(new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshStandardMaterial({
        color: this._warna("#fff3c4"), emissive: this._warna("#ffd54f"), emissiveIntensity: 0.7,
      }), 0, 2.42, 0, p);
    grup.add(p);
  }

  /* ==========================================================================
     LANDMARK — sesuai kolom 'landmark' pada data desa
  ========================================================================== */
  _bangunLandmark(grup, data, sisi, z) {
    const x = 17.2 * sisi;
    switch (data.landmark) {
      case "lumbung": this._lmLumbung(grup, x, z); break;
      case "menara":  this._lmMenara(grup, x, z); break;
      case "air":     this._lmAir(grup, x, z); break;
      case "gudang":  this._lmGudang(grup, x, z, sisi); break;
      case "candi":   this._lmCandi(grup, x, z); break;
      case "suar":    this._lmSuar(grup, x, z); break;
      case "sinyal":  this._lmSinyal(grup, x, z); break;
      case "panel":   this._lmPanel(grup, x, z); break;
      case "tugu":    this._lmTugu(grup, x, z); break;
      case "patung":  this._lmPatung(grup, x, z, data.patung); break;
      default:        this._lmTugu(grup, x, z);
    }
  }

  _lmLumbung(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const mKayu = this._material("#8d6e63");
    [[-0.9, -0.7], [0.9, -0.7], [-0.9, 0.7], [0.9, 0.7]].forEach(([px, pz]) => {
      this._mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 8), mKayu, px, 0.6, pz, p);
    });
    this._mesh(new THREE.BoxGeometry(2.6, 1.5, 1.9), this._material("#c9a35a"), 0, 1.95, 0, p);
    const atap = this._mesh(new THREE.ConeGeometry(2.5, 1.5, 4), this._material("#c9a227", { flatShading: true }), 0, 3.45, 0, p);
    atap.rotation.y = Math.PI / 4;
    /* tangga sederhana */
    this._mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), mKayu, -0.35, 0.8, 1.05, p);
    this._mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), mKayu, 0.35, 0.8, 1.05, p);
    for (let i = 0; i < 4; i++) this._mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), mKayu, 0, 0.35 + i * 0.42, 1.05, p);
    grup.add(p);
  }

  _lmMenara(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const mKayu = this._material("#795548");
    [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([px, pz]) => {
      this._mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8), mKayu, px, 1.7, pz, p);
    });
    this._mesh(new THREE.BoxGeometry(2.3, 0.16, 2.3), this._material("#a1887f"), 0, 3.5, 0, p);
    [-1, 1].forEach((s) => {
      this._mesh(new THREE.BoxGeometry(2.3, 0.5, 0.08), mKayu, 0, 3.85, 1.1 * s, p);
      this._mesh(new THREE.BoxGeometry(0.08, 0.5, 2.3), mKayu, 1.1 * s, 3.85, 0, p);
    });
    const atap = this._mesh(new THREE.ConeGeometry(2.0, 1.1, 4), this._material("#b04a34", { flatShading: true }), 0, 4.8, 0, p);
    atap.rotation.y = Math.PI / 4;
    grup.add(p);
  }

  _lmAir(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    /* tebing batu */
    const mBatu = this._material("#8a8a85", { flatShading: true });
    this._mesh(new THREE.BoxGeometry(2.6, 2.6, 1.6), mBatu, -1.2, 1.3, -0.6, p);
    this._mesh(new THREE.BoxGeometry(1.8, 3.4, 1.4), mBatu, 1.1, 1.7, -0.5, p);
    this._mesh(new THREE.BoxGeometry(1.4, 1.8, 1.2), mBatu, 0, 3.6, -0.4, p);
    /* air terjun (tekstur bergerak) */
    const tex = this._teksturAir().clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 2);
    const jurang = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 2.6),
      new THREE.MeshStandardMaterial({ color: this._warna("#d7f0fb"), map: tex, transparent: true, opacity: 0.85 })
    );
    jurang.position.set(0.15, 2.4, 0.36);
    p.add(jurang);
    this._air.push(tex);
    /* kolam embung */
    const kolam = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 24),
      new THREE.MeshStandardMaterial({ color: this._warna("#4aa3df"), transparent: true, opacity: 0.9, roughness: 0.3 })
    );
    kolam.rotation.x = -Math.PI / 2;
    kolam.position.set(0.15, 0.06, 1.4);
    kolam.receiveShadow = true;
    p.add(kolam);
    grup.add(p);
  }

  _lmGudang(grup, x, z, sisi) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = -sisi * Math.PI / 2;              // menghadap jalan utama
    this._mesh(new THREE.BoxGeometry(4.2, 2.3, 3.0), this._material("#d7ccc8"), 0, 1.15, 0, p);
    const atap = this._mesh(new THREE.BoxGeometry(4.6, 0.16, 3.5), this._material("#6d4c41"), 0, 2.42, 0, p);
    atap.rotation.z = 0.1;
    this._mesh(new THREE.BoxGeometry(1.5, 1.7, 0.08), this._material("#5d4037"), 0, 0.85, 1.52, p);
    /* peti & karung di samping */
    this._mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), this._material("#a1887f"), 2.6, 0.3, 1.2, p);
    this._mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), this._material("#8d6e63"), 2.5, 0.85, 1.15, p);
    grup.add(p);
  }

  _lmCandi(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const mBatu = this._material("#9e9484", { roughness: 1 });
    this._mesh(new THREE.BoxGeometry(3.6, 0.5, 3.6), mBatu, 0, 0.25, 0, p);
    this._mesh(new THREE.BoxGeometry(2.8, 0.55, 2.8), mBatu, 0, 0.78, 0, p);
    this._mesh(new THREE.BoxGeometry(2.1, 0.55, 2.1), mBatu, 0, 1.33, 0, p);
    this._mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), mBatu, 0, 1.85, 0, p);
    this._mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.55, 10), mBatu, 0, 2.4, 0, p);
    this._mesh(new THREE.ConeGeometry(0.5, 0.55, 10), mBatu, 0, 2.95, 0, p);
    this._mesh(new THREE.SphereGeometry(0.09, 8, 8), this._material("#ffca28", { metalness: 0.5, roughness: 0.4 }), 0, 3.3, 0, p);
    /* undakan menuju candi */
    this._mesh(new THREE.BoxGeometry(1.2, 0.2, 0.6), mBatu, 0, 0.1, 2.05, p);
    this._mesh(new THREE.BoxGeometry(1.2, 0.2, 0.6), mBatu, 0, 0.3, 1.75, p);
    grup.add(p);
  }

  _lmSuar(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    /* menara bergaris merah putih */
    const c = document.createElement("canvas");
    c.width = 64; c.height = 256;
    const g = c.getContext("2d");
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#e53935" : "#f5f5f5";
      g.fillRect(0, i * 32, 64, 32);
    }
    const texGaris = new THREE.CanvasTexture(c);
    texGaris.encoding = THREE.sRGBEncoding;
    this._mesh(
      new THREE.CylinderGeometry(0.55, 0.85, 4.6, 14),
      new THREE.MeshStandardMaterial({ map: texGaris, roughness: 0.9 }),
      0, 2.3, 0, p
    );
    this._mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.14, 14), this._material("#455a64"), 0, 4.65, 0, p);
    this._mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 12),
      new THREE.MeshStandardMaterial({
        color: this._warna("#fff59d"), emissive: this._warna("#ffe082"), emissiveIntensity: 0.9,
      }), 0, 5.0, 0, p);
    this._mesh(new THREE.ConeGeometry(0.62, 0.5, 12), this._material("#e53935"), 0, 5.55, 0, p);
    grup.add(p);
  }

  /* --- menara sinyal / BTS desa digital --- */
  _lmSinyal(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const mBaja = this._material("#546e7a", { metalness: 0.4, roughness: 0.5 });
    /* tiga kaki menara segitiga */
    [[-0.6, 0], [0.6, 0], [0, 0.65]].forEach(([px, pz]) => {
      const kaki = this._mesh(new THREE.CylinderGeometry(0.05, 0.09, 6.8, 6), mBaja, px, 3.4, pz, p);
      kaki.rotation.x = pz > 0 ? -0.07 : 0;
    });
    /* pengikat palang */
    for (let y = 1.2; y < 6.4; y += 1.3) {
      this._mesh(new THREE.BoxGeometry(1.3, 0.07, 0.07), mBaja, 0, y, 0.1, p);
      this._mesh(new THREE.BoxGeometry(0.07, 0.07, 0.75), mBaja, 0, y, 0.3, p);
    }
    /* antena & pelat di puncak */
    this._mesh(new THREE.BoxGeometry(0.9, 1.1, 0.22), this._material("#eceff1"), 0, 6.4, 0, p);
    this._mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), mBaja, 0, 7.4, 0, p);
    /* lampu merah berkedip */
    const lampu = this._mesh(new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({
        color: this._warna("#ff5252"), emissive: this._warna("#ff1744"), emissiveIntensity: 1.5,
      }), 0, 8.15, 0, p);
    this._lampuSinyal.push(lampu.material);
    /* parabola kecil di sisi */
    const dish = this._mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 14),
      this._material("#eceff1"), 0.75, 4.6, 0.2, p);
    dish.rotation.z = Math.PI / 2.4;
    grup.add(p);
  }

  /* --- instalasi energi : panel surya + turbin angin berputar --- */
  _lmPanel(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const mBingkai = this._material("#b0bec5", { metalness: 0.4, roughness: 0.4 });
    const mSel = new THREE.MeshStandardMaterial({
      color: this._warna("#1f4478"), emissive: this._warna("#16325e"), emissiveIntensity: 0.45,
      metalness: 0.55, roughness: 0.3,
    });
    /* dua baris panel surya miring */
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const px = (c - 1) * 2.1;
        const pz = r * 1.9 - 0.8;
        this._mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), mBingkai, px, 0.4, pz, p);
        this._mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), mBingkai, px + 0.55, 0.4, pz, p);
        const panel = this._mesh(new THREE.BoxGeometry(1.9, 0.07, 1.15), mSel, px + 0.27, 0.85, pz, p);
        panel.rotation.x = -0.42;
        this._mesh(new THREE.BoxGeometry(1.95, 0.03, 1.2), mBingkai, px + 0.27, 0.81, pz, p).rotation.x = -0.42;
      }
    }
    /* turbin angin */
    const t = new THREE.Group();
    t.position.set(1.4, 0, 2.6);
    this._mesh(new THREE.CylinderGeometry(0.09, 0.16, 6.4, 8), this._material("#eceff1"), 0, 3.2, 0, t);
    this._mesh(new THREE.BoxGeometry(0.55, 0.3, 0.3), this._material("#cfd8dc"), 0.1, 6.45, 0, t);
    const baling = new THREE.Group();
    baling.position.set(0.15, 6.45, 0.25);
    for (let i = 0; i < 3; i++) {
      const daun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.0, 0.16), this._material("#ffffff"));
      daun.position.y = 1.0;
      const pembawa = new THREE.Group();
      pembawa.rotation.z = (i / 3) * Math.PI * 2;
      pembawa.add(daun);
      baling.add(pembawa);
    }
    t.add(baling);
    this._turbin.push(baling);
    p.add(t);
    grup.add(p);
  }

  _lmTugu(grup, x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const mBatu = this._material("#b0a496", { roughness: 1 });
    this._mesh(new THREE.BoxGeometry(2.4, 0.4, 2.4), mBatu, 0, 0.2, 0, p);
    this._mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), mBatu, 0, 0.6, 0, p);
    const batang = this._mesh(new THREE.CylinderGeometry(0.32, 0.5, 3.2, 4), mBatu, 0, 2.4, 0, p);
    batang.rotation.y = Math.PI / 4;
    this._mesh(new THREE.SphereGeometry(0.3, 12, 12),
      this._material("#ffca28", { metalness: 0.6, roughness: 0.3 }), 0, 4.2, 0, p);
    grup.add(p);
  }

  _lmPatung(grup, x, z, varian) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    this._mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.0, 12), this._material("#b0a496"), 0, 0.5, 0, p);

    if (varian === "apel") {
      this._mesh(new THREE.SphereGeometry(0.75, 16, 14), this._material("#c62828", { roughness: 0.5 }), 0, 1.85, 0, p);
      const daun = this._mesh(new THREE.ConeGeometry(0.16, 0.4, 6), this._material("#43a047"), 0.28, 2.5, 0, p);
      daun.rotation.z = 1.1;
      this._mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), this._material("#5d4037"), 0, 2.6, 0, p);
    } else if (varian === "kopi") {
      const mPorselen = this._material("#f5f0e6", { roughness: 0.35 });
      this._mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 18), mPorselen, 0, 1.05, 0, p);
      this._mesh(new THREE.CylinderGeometry(0.62, 0.45, 0.9, 18), mPorselen, 0, 1.55, 0, p);
      this._mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.12, 18), this._material("#6f4e37"), 0, 1.95, 0, p);
      const gagang = this._mesh(new THREE.TorusGeometry(0.3, 0.07, 10, 18, Math.PI), mPorselen, 0.68, 1.6, 0, p);
      gagang.rotation.z = -Math.PI / 2;
    } else if (varian === "bambu") {
      const mBambu = this._material("#7cb342");
      [[-0.35, 2.6, 0.08], [0.1, 3.2, 0], [0.45, 2.8, -0.07]].forEach(([dx, h, miring], i) => {
        const batang = this._mesh(new THREE.CylinderGeometry(0.09, 0.1, h, 8), mBambu, dx, h / 2 + 0.9, i * 0.18 - 0.18, p);
        batang.rotation.z = miring;
        for (let j = 0.7; j < h; j += 0.8) {
          this._mesh(new THREE.TorusGeometry(0.105, 0.02, 6, 12), this._material("#558b2f"), dx, j + 0.9, i * 0.18 - 0.18, p).rotation.x = Math.PI / 2;
        }
      });
    } else {
      this._mesh(new THREE.SphereGeometry(0.5, 14, 12), this._material("#ffca28", { metalness: 0.5, roughness: 0.35 }), 0, 1.8, 0, p);
    }
    grup.add(p);
  }

  /* ==========================================================================
     PENYEBARAN POHON (hindari jalan, area desa, sungai)
  ========================================================================== */
  _sebarPohon() {
    const zDesa = this.desaList.map((d) => d.z);
    let terpasang = 0;
    let percobaan = 0;
    while (terpasang < 110 && percobaan < 700) {
      percobaan++;
      const s = Math.random() < 0.5 ? -1 : 1;
      const x = this._acak(10.5, 56) * s;
      const z = this._acak(this.zAkhir + 6, 24);

      if (Math.abs(z - this.posisiSungai) < 11) continue;                     // jangan di sungai
      let diDesa = false;
      for (const zd of zDesa) {
        if (Math.abs(z - zd) < 15 && x * s > 3 && x * s < 26) { diDesa = true; break; }
      }
      if (diDesa) continue;

      const jenis = Math.random();
      let pohon;
      if (jenis < 0.55) pohon = this._buatPohonRimba();
      else if (jenis < 0.8) pohon = this._buatPinus();
      else pohon = this._buatPalem();

      pohon.position.set(x, 0, z);
      pohon.rotation.y = Math.random() * Math.PI * 2;
      const skala = this._acak(0.8, 1.6);
      pohon.scale.setScalar(skala);
      this.scene.add(pohon);
      terpasang++;
    }
  }

  _buatPohonRimba() {
    const p = new THREE.Group();
    const mKayu = this._material("#6d4c41");
    const hijau = ["#4e8f3a", "#5da344", "#3f7d33"][Math.floor(Math.random() * 3)];
    const mDaun = this._material(hijau, { flatShading: true });
    this._mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.8, 8), mKayu, 0, 0.9, 0, p);
    this._mesh(new THREE.SphereGeometry(1.15, 9, 8), mDaun, 0, 2.5, 0, p);
    this._mesh(new THREE.SphereGeometry(0.85, 9, 8), mDaun, 0.55, 2.0, 0.25, p);
    this._mesh(new THREE.SphereGeometry(0.8, 9, 8), mDaun, -0.5, 2.1, -0.3, p);
    return p;
  }

  _buatPinus() {
    const p = new THREE.Group();
    const mKayu = this._material("#5d4037");
    const mDaun = this._material("#33684a", { flatShading: true });
    this._mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 8), mKayu, 0, 0.7, 0, p);
    this._mesh(new THREE.ConeGeometry(1.25, 1.5, 8), mDaun, 0, 1.8, 0, p);
    this._mesh(new THREE.ConeGeometry(1.0, 1.3, 8), mDaun, 0, 2.6, 0, p);
    this._mesh(new THREE.ConeGeometry(0.7, 1.1, 8), mDaun, 0, 3.35, 0, p);
    return p;
  }

  _buatPalem() {
    const p = new THREE.Group();
    const mBatang = this._material("#8d6e63");
    const mDaun = this._material("#4e9a3a", { flatShading: true });
    /* batang menekuk sedikit */
    this._mesh(new THREE.CylinderGeometry(0.13, 0.19, 1.4, 8), mBatang, 0, 0.7, 0, p);
    this._mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.4, 8), mBatang, 0.14, 2.05, 0, p);
    this._mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 8), mBatang, 0.32, 3.3, 0, p);
    /* janur : kerucut pipih dikancing keluar */
    for (let i = 0; i < 7; i++) {
      const sudut = (i / 7) * Math.PI * 2;
      const janur = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.9, 4), mDaun);
      janur.position.set(0.4 + Math.cos(sudut) * 0.75, 3.95 - Math.abs(Math.sin(sudut)) * 0.25, Math.sin(sudut) * 0.75);
      janur.rotation.z = Math.cos(sudut) > 0 ? -1.15 : 1.15;
      janur.rotation.x = Math.sin(sudut) * 0.8;
      janur.castShadow = true;
      p.add(janur);
    }
    this._mesh(new THREE.SphereGeometry(0.12, 6, 6), this._material("#6d4c41"), 0.42, 3.75, 0.15, p);
    this._mesh(new THREE.SphereGeometry(0.12, 6, 6), this._material("#6d4c41"), 0.3, 3.72, -0.12, p);
    return p;
  }

  /* ==========================================================================
     AWAN & BURUNG
  ========================================================================== */
  _bangunAwan() {
    const mAwan = new THREE.MeshStandardMaterial({
      color: "#ffffff", emissive: "#9fb4c4", emissiveIntensity: 0.35,
      roughness: 1, flatShading: true,
    });
    for (let i = 0; i < 9; i++) {
      const awan = new THREE.Group();
      const nBulat = 3 + Math.floor(Math.random() * 3);
      for (let b = 0; b < nBulat; b++) {
        const r = this._acak(4, 8);
        const bulat = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7), mAwan);
        bulat.position.set(b * r * 0.9 - r, this._acak(-1, 1), this._acak(-2, 2));
        bulat.scale.y = 0.55;
        awan.add(bulat);
      }
      awan.position.set(this._acak(-240, 240), this._acak(46, 70), this._acak(this.zAkhir - 40, 0));
      awan.userData.kecepatan = this._acak(0.8, 1.8);
      this._awan.push(awan);
      this.scene.add(awan);
    }
  }

  _bangunBurung() {
    const mSayap = this._material("#37474f");
    for (let f = 0; f < 2; f++) {
      const pusat = {
        x: this._acak(-50, 50),
        y: this._acak(22, 32),
        z: this.zAkhir * 0.35 - f * 60 - this._acak(0, 30),
        r: this._acak(28, 48),
        w: (f % 2 ? 0.16 : -0.12),
      };
      for (let i = 0; i < 4; i++) {
        const burung = new THREE.Group();
        const sayapKiri = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.03, 0.22), mSayap);
        sayapKiri.position.x = 0.42;
        const sayapKanan = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.03, 0.22), mSayap);
        sayapKanan.position.x = -0.42;
        burung.add(sayapKiri, sayapKanan);
        burung.userData = {
          pusat, fase: (i / 4) * Math.PI * 2,
          sayapKiri, sayapKanan,
          besar: this._acak(0.8, 1.3),
        };
        burung.scale.setScalar(burung.userData.besar);
        this._burung.push(burung);
        this.scene.add(burung);
      }
    }
  }

  /* ==========================================================================
     NPC PINGGIR JALAN — tukang bakso, tukang jamu, warung, warga berjalan.
     Saat pemain lewat, NPC menyapa (suara + balon ucapan).
  ========================================================================== */
  _bangunNPC() {
    this._npcBakso(6.7, -22);
    this._npcWarga(-6.6, -56, 18);
    this._npcJamu(6.7, -68);          // di daratan sebelum sungai, bukan di air
    this._npcWarung(-6.9, -134);
    this._npcWarga(6.6, -168, 14);
  }

  /* karakter penjual memakai gaya avatar yang sama, menghadap jalan */
  _buatPenjual(grup, x, z, aksesoris) {
    const cfg = acakKonfig();
    cfg.aksesoris = aksesoris || [];
    const c = buildKarakter(cfg);
    c.grup.position.set(x, 0, z);
    c.grup.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;   // menghadap jalan
    grup.add(c.grup);
    return c.bagian;
  }

  /* balon ucapan (sprite bertekstur kanvas), awalnya transparan.
     Ukuran font menyesuaikan otomatis agar teks selalu muat di dalam balon */
  _buatUcapan(grup, y, teks) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const g = c.getContext("2d");

    /* cari ukuran font terbesar yang masih muat di dalam balon */
    let ukuran = 44;
    const muat = () => {
      g.font = `700 ${ukuran}px 'Plus Jakarta Sans', 'Segoe UI', sans-serif`;
      return g.measureText(teks).width;
    };
    while (muat() > 420 && ukuran > 20) ukuran -= 2;

    g.fillStyle = "rgba(252, 248, 238, 0.96)";
    g.strokeStyle = "rgba(28, 58, 40, 0.85)";
    g.lineWidth = 5;
    const r = 34;
    g.beginPath();
    g.moveTo(24 + r, 14);
    g.arcTo(488, 14, 488, 92, r);
    g.arcTo(488, 92, 24, 92, r);
    g.lineTo(226, 92);
    g.lineTo(256, 120);
    g.lineTo(286, 92);
    g.arcTo(24, 92, 24, 14, r);
    g.arcTo(24, 14, 488, 14, r);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#1c3a28";
    g.font = `700 ${ukuran}px 'Plus Jakarta Sans', 'Segoe UI', sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(teks, 256, 52);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    sprite.scale.set(3.1, 0.78, 1);
    sprite.position.y = y;
    grup.add(sprite);
    return sprite;
  }

  _daftarkanNPC(jenis, grup, titik, sprite, teks, bagian, walker) {
    this.npcList.push({ jenis, grup, titik, sprite, teks, bagian, walker, diamHingga: 0 });
  }

  _npcBakso(x, z) {
    const grup = new THREE.Group();
    grup.position.set(x, 0, z);
    grup.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;      // gerobak memanjang di tepi

    const mKayu = this._material("#8d6e63");
    const mKayuTua = this._material("#6d4c41");
    /* gerobak */
    this._mesh(new THREE.BoxGeometry(1.5, 0.14, 0.8), mKayu, -0.5, 0.85, 0, grup);
    this._mesh(new THREE.BoxGeometry(1.5, 0.5, 0.72), this._material("#a1887f"), -0.5, 0.55, 0, grup);
    /* kaca pajangan */
    const kaca = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.5, 0.6),
      new THREE.MeshStandardMaterial({
        color: this._warna("#d7ecf5"), transparent: true, opacity: 0.4, roughness: 0.15,
      })
    );
    kaca.position.set(-0.5, 1.2, 0);
    kaca.castShadow = true;
    grup.add(kaca);
    /* mangkuk di atas */
    [-0.85, -0.5, -0.15].forEach((bx) => {
      this._mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.08, 10), this._material("#f2efe6"), bx, 1.5, 0, grup);
    });
    /* roda & gagang */
    [-0.42, 0.42].forEach((wz) => {
      const roda = this._mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 14), mKayuTua, -1.05, 0.3, wz, grup);
      roda.rotation.x = Math.PI / 2;
    });
    this._mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), mKayuTua, 0.28, 1.05, 0, grup);
    /* tiang payung kecil */
    this._mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 8), this._material("#c8a557"), 0.15, 1.9, 0.28, grup);
    const tudung = this._mesh(new THREE.ConeGeometry(0.55, 0.24, 10), this._material("#f3e5ab", { roughness: 1 }), 0.15, 2.85, 0.28, grup);
    tudung.rotation.x = 0.06;

    this._buatPenjual(grup, 0.75, 0, ["caping"]);
    const sprite = this._buatUcapan(grup, 3.0, "Baksooo... baksooo...");
    this.scene.add(grup);
    this._daftarkanNPC("bakso", grup, new THREE.Vector3(x, 0, z), sprite, "Baksooo...", null, null);
  }

  _npcJamu(x, z) {
    const grup = new THREE.Group();
    grup.position.set(x, 0, z);
    grup.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;

    const mKayu = this._material("#8d6e63");
    /* meja jamu */
    this._mesh(new THREE.BoxGeometry(1.15, 0.08, 0.6), mKayu, -0.35, 0.82, 0, grup);
    [[-0.85, -0.22], [-0.85, 0.22], [0.15, -0.22], [0.15, 0.22]].forEach(([lx, lz]) => {
      this._mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.82, 8), mKayu, lx, 0.41, lz, grup);
    });
    /* botol jamu warna-warni */
    const warnaBotol = ["#8d4a26", "#3e7a2b", "#b3541e", "#6b4423", "#2e6b4f", "#a33327"];
    warnaBotol.forEach((warna, i) => {
      const bx = -0.78 + (i % 3) * 0.3;
      const bz = i < 3 ? -0.12 : 0.12;
      this._mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.2, 8), this._material(warna), bx, 0.96, bz, grup);
      this._mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6), this._material("#d9a441"), bx, 1.09, bz, grup);
    });
    /* payung pembuka */
    this._mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 8), this._material("#c8a557"), 0.35, 1.75, 0, grup);
    this._mesh(new THREE.ConeGeometry(0.85, 0.32, 12), this._material("#c0392b", { roughness: 1 }), 0.35, 2.8, 0, grup);

    this._buatPenjual(grup, 0.75, 0, ["ikat"]);
    const sprite = this._buatUcapan(grup, 3.0, "Jamu kak? Jamuu...");
    this.scene.add(grup);
    this._daftarkanNPC("jamu", grup, new THREE.Vector3(x, 0, z), sprite, "Jamu kak?...", null, null);
  }

  _npcWarung(x, z) {
    const grup = new THREE.Group();
    grup.position.set(x, 0, z);
    grup.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;

    const mKayu = this._material("#8d6e63");
    const mAtap = this._material("#c9a227", { roughness: 1 });
    /* tiang & atap miring */
    [[-0.95, -0.55], [0.95, -0.55], [-0.95, 0.55], [0.95, 0.55]].forEach(([px, pz]) => {
      this._mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.1, 8), mKayu, px, 1.05, pz, grup);
    });
    const atap = this._mesh(new THREE.BoxGeometry(2.5, 0.09, 1.8), mAtap, 0, 2.2, 0, grup);
    atap.rotation.x = 0.14;
    /* etalase barang */
    this._mesh(new THREE.BoxGeometry(2.1, 0.5, 0.55), this._material("#a1887f"), 0, 0.75, 0.45, grup);
    this._mesh(new THREE.BoxGeometry(2.1, 0.06, 0.65), mKayu, 0, 1.03, 0.45, grup);
    const buah = ["#e07b39", "#c0392b", "#f4b942", "#7cb342", "#e5c04b", "#8e24aa"];
    buah.forEach((warna, i) => {
      this._mesh(new THREE.SphereGeometry(0.085, 10, 8), this._material(warna), -0.8 + i * 0.32, 1.15, 0.45, grup);
    });
    /* papan nama warung */
    this._mesh(new THREE.BoxGeometry(1.5, 0.4, 0.06), this._material("#f7f0dc"), 0, 1.85, -0.58, grup);

    this._buatPenjual(grup, 0, -0.35, ["tas"]);
    const sprite = this._buatUcapan(grup, 2.75, "Mampir kak...");
    this.scene.add(grup);
    this._daftarkanNPC("warung", grup, new THREE.Vector3(x, 0, z), sprite, "Mampir kak...", null, null);
  }

  _npcWarga(x, z, rentang) {
    const grup = new THREE.Group();
    const cfg = acakKonfig();
    cfg.aksesoris = Math.random() < 0.5 ? ["tas"] : [];
    const c = buildKarakter(cfg);
    grup.add(c.grup);
    grup.position.set(x, 0, z);
    this.scene.add(grup);

    const sprite = this._buatUcapan(grup, 2.1, "Halo...");
    this._daftarkanNPC("warga", grup, new THREE.Vector3(x, 0, z), sprite, "Halo...", c.bagian,
      { zAwal: z - rentang / 2, zAkhir: z + rentang / 2, arah: Math.random() < 0.5 ? 1 : -1, kecepatan: 1.05 });
  }

  /* tunjukkan balon ucapan NPC */
  tampilkanUcapan(npc) {
    npc.sprite.material.opacity = 1;
    npc.sprite.userData.punah = 3.2;         // detik sebelum memudar (dihitung di update)
  }

  /* ==========================================================================
     MERCU TANDA (penunjuk desa tujuan berikutnya)
  ========================================================================== */
  _bangunMercuTanda() {
    const grup = new THREE.Group();
    const kolom = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.35, 8, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: this._warna("#ffd54f"), transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    kolom.position.y = 4;
    const cincin = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.07, 10, 26),
      new THREE.MeshBasicMaterial({ color: this._warna("#ffd54f"), transparent: true, opacity: 0.85 })
    );
    cincin.rotation.x = Math.PI / 2;
    cincin.position.y = 0.25;
    const panah = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.75, 4),
      new THREE.MeshBasicMaterial({ color: this._warna("#ffca28") })
    );
    panah.rotation.x = Math.PI;
    panah.position.y = 5.6;
    grup.add(kolom, cincin, panah);
    grup.visible = false;
    this._mercu = { grup, kolom, cincin, panah };
    this.scene.add(grup);
  }

  setTargetDesa(i) {
    if (i == null) { this._mercu.grup.visible = false; return; }
    const desa = this.desaList[i];
    this._mercu.grup.position.set(desa.sisi * 13, 0, desa.z);
    this._mercu.grup.visible = true;
  }

  /* tandai desa selesai dikunjungi : pasang bendera merah-putih di gapura */
  tandaiDikunjungi(i) {
    const desa = this.desaList[i];
    const flag = new THREE.Group();
    const xGapura = 6.2 * desa.sisi;
    flag.position.set(xGapura, 3.2, desa.z - 1.9);
    this._mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), this._material("#9e9e9e"), 0, 0.5, 0, flag);
    this._mesh(new THREE.BoxGeometry(0.65, 0.22, 0.02), this._material("#e53935"), 0.34, 0.88, 0, flag);
    this._mesh(new THREE.BoxGeometry(0.65, 0.22, 0.02), this._material("#fafafa"), 0.34, 0.66, 0, flag);
    desa.grup.add(flag);
  }

  /* ==========================================================================
     PEMBARUAN PER FRAME
  ========================================================================== */
  update(dt, waktu, posisiPemain) {
    /* matahari mengikuti pemain -> bayangan selalu bagus di sekitar pemain */
    this.matahari.position.set(posisiPemain.x + 30, 46, posisiPemain.z + 20);
    this.matahari.target.position.set(posisiPemain.x, 0, posisiPemain.z);
    this.matahari.target.updateMatrixWorld();

    /* awan berarak pelan */
    for (const awan of this._awan) {
      awan.position.x += awan.userData.kecepatan * dt;
      if (awan.position.x > 300) awan.position.x = -300;
    }

    /* burung berputar + mengepak */
    for (const burung of this._burung) {
      const u = burung.userData;
      const sudut = u.fase + waktu * u.pusat.w;
      burung.position.set(
        u.pusat.x + Math.cos(sudut) * u.pusat.r,
        u.pusat.y + Math.sin(waktu * 0.7 + u.fase) * 1.2,
        u.pusat.z + Math.sin(sudut) * u.pusat.r
      );
      burung.rotation.y = -sudut + (u.pusat.w > 0 ? 0 : Math.PI);
      const kepak = Math.sin(waktu * 9 + u.fase) * 0.55 + 0.15;
      u.sayapKiri.rotation.z = kepak;
      u.sayapKanan.rotation.z = -kepak;
    }

    /* permukaan air & air terjun mengalir */
    for (const tex of this._air) tex.offset.x = (tex.offset.x + dt * 0.045) % 1;

    /* turbin angin berputar pelan */
    for (const baling of this._turbin) baling.rotation.z += dt * 2.1;

    /* NPC : warga berjalan bolak-balik & balon ucapan memudar */
    for (const npc of this.npcList) {
      if (npc.walker) {
        const w = npc.walker;
        npc.grup.position.z += w.arah * w.kecepatan * dt;
        if (npc.grup.position.z > w.zAkhir) { npc.grup.position.z = w.zAkhir; w.arah = -1; }
        if (npc.grup.position.z < w.zAwal)  { npc.grup.position.z = w.zAwal;  w.arah = 1; }
        npc.grup.rotation.y = w.arah > 0 ? 0 : Math.PI;       // hadap arah jalan
        npc.titik.set(npc.grup.position.x, 0, npc.grup.position.z);
        /* langkah kaki & tangan saat berjalan */
        if (npc.bagian) {
          const fase = waktu * 7.5;
          const ayun = Math.sin(fase) * 0.5;
          npc.bagian.kakiKiri.rotation.x = ayun;
          npc.bagian.kakiKanan.rotation.x = -ayun;
          npc.bagian.tanganKiri.rotation.x = -ayun * 0.7;
          npc.bagian.tanganKanan.rotation.x = ayun * 0.7;
          npc.bagian.badan.position.y = 0.62 + Math.abs(Math.cos(fase)) * 0.03;
        }
      }
      /* balon ucapan memudar */
      if (npc.sprite.userData.punah > 0) {
        npc.sprite.userData.punah -= dt;
        npc.sprite.material.opacity = Math.max(0, Math.min(1, npc.sprite.userData.punah / 0.8));
        npc.sprite.position.y = (npc.walker ? 2.1 : 3.0) + Math.sin(waktu * 2) * 0.05;
      }
    }

    /* lampu menara sinyal berkedip */
    for (const m of this._lampuSinyal) m.emissiveIntensity = Math.sin(waktu * 3.4) > 0 ? 2.2 : 0.25;

    /* mercu tanda berdenyut */
    if (this._mercu.grup.visible) {
      this._mercu.kolom.material.opacity = 0.16 + Math.sin(waktu * 3.2) * 0.08;
      this._mercu.cincin.rotation.z += dt * 1.2;
      this._mercu.panah.position.y = 5.6 + Math.sin(waktu * 3) * 0.3;
      this._mercu.panah.rotation.y += dt * 2.4;
    }
  }
}
