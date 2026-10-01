/* ============================================================================
   AUDIO ENGINE — semua suara dibuat secara prosedural (Web Audio API)
   ----------------------------------------------------------------------------
   Tidak butuh file audio eksternal sehingga game langsung jalan offline.
   Ingin memakai rekaman asli? Ganti bagian "generator" di bawah dengan:
       const audio = new Audio("audio/alam.mp3"); audio.loop = true; ...
   Fitur:
   - Angin      : noise + filter lowpass (ber-LFO pelan)
   - Burung     : kicau acak (sine sweep ber-suku kata)
   - Musik latar: pentatonik gamelan lembut + dengung bass
   - SFX        : klik, kunjungan desa (chime), kemenangan (fanfare)
   ============================================================================ */

const AudioEngine = (() => {
  let ctx = null;             // AudioContext
  let master = null;          // gain utama (untuk mute)
  let mulai = false;          // apakah engine sudah dijalankan
  let bisu = false;
  let timerBurung = null;     // penjadwal kicau burung
  let timerMusik  = null;     // penjadwal nada musik

  /* Skala pentatonik gamelan-ish (C D E G A + oktaf) dalam Hz */
  const NADA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
  let indeksNada = 3;         // posisi acak-berjalan untuk melodi

  /* ------------------------------------------------------------------
     INISIALISASI — dipanggil dari gestur pengguna pertama (klik tombol)
  ------------------------------------------------------------------ */
  function init() {
    if (mulai) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                       // browser sangat lama: lewati
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    mulai = true;

    buatAngin();
    jadwalkanBurung();
    jadwalkanMusik();
  }

  /* Lanjutkan context bila diblokir kebijakan autoplay */
  function pastikanJalan() {
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  /* ------------------------------------------------------------------
     GENERATOR DASAR
  ------------------------------------------------------------------ */
  /* Buffer noise putih 2 detik (dipakai untuk angin) */
  function bufferNoise() {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* Satu nada "plucked" lembut (seperti petikan siter) */
  function nada(frek, waktu, volume = 0.05, durasi = 1.4) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc2.type = "triangle";
    osc.frequency.value = frek;
    osc2.frequency.value = frek * 2.001;         // harmonik tipis
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    osc2.connect(g2).connect(gain);
    osc.connect(gain);
    gain.connect(master);
    gain.gain.setValueAtTime(0.0001, waktu);
    gain.gain.exponentialRampToValueAtTime(volume, waktu + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, waktu + durasi);
    osc.start(waktu); osc2.start(waktu);
    osc.stop(waktu + durasi + 0.1); osc2.stop(waktu + durasi + 0.1);
  }

  /* ------------------------------------------------------------------
     ANGIN — noise di-loop melalui lowpass, volumenya bergelombang LFO
  ------------------------------------------------------------------ */
  function buatAngin() {
    const src = ctx.createBufferSource();
    src.buffer = bufferNoise();
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    filter.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0.035;

    // LFO mengatur tinggi-rendahnya angin
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);

    src.connect(filter).connect(gain).connect(master);
    src.start();
    lfo.start();
  }

  /* ------------------------------------------------------------------
     BURUNG — kicau 2-4 suku kata sine sweep, dijadwalkan acak
  ------------------------------------------------------------------ */
  function kicauBurung() {
    if (!ctx || bisu) return;
    const suku = 2 + Math.floor(Math.random() * 3);
    const dasar = 2100 + Math.random() * 1400;
    for (let i = 0; i < suku; i++) {
      const t = ctx.currentTime + i * (0.11 + Math.random() * 0.05);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const awal  = dasar + (Math.random() * 500 - 250);
      osc.frequency.setValueAtTime(awal, t);
      osc.frequency.exponentialRampToValueAtTime(awal * (1.2 + Math.random() * 0.4), t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(awal * 0.9, t + 0.1);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  function jadwalkanBurung() {
    timerBurung = setTimeout(() => {
      kicauBurung();
      jadwalkanBurung();                   // kicau berikutnya 2.5-8 detik lagi
    }, 2500 + Math.random() * 5500);
  }

  /* ------------------------------------------------------------------
     MUSIK LATAR — melodi pentatonik acak-berjalan + dengung bass
  ------------------------------------------------------------------ */
  function jadwalkanMusik() {
    const langkah = 0.78;                  // detik per ketukan
    timerMusik = setInterval(() => {
      if (!ctx || bisu) return;
      const t = ctx.currentTime + 0.05;

      // melodi : biasanya main, kadang jeda bernapas
      if (Math.random() < 0.78) {
        indeksNada += Math.floor(Math.random() * 5) - 2;
        indeksNada = Math.max(0, Math.min(NADA.length - 1, indeksNada));
        nada(NADA[indeksNada], t, 0.045);
        // balasan oktaf sesekali
        if (Math.random() < 0.25) nada(NADA[indeksNada] * 2, t + langkah / 2, 0.025);
      }
    }, langkah * 1000);

    // dengung bass panjang (drone), berganti nada tiap 14 detik
    const drone = ctx.createOscillator();
    const gDrone = ctx.createGain();
    drone.type = "sine";
    drone.frequency.value = NADA[0] / 2;
    gDrone.gain.value = 0.018;
    drone.connect(gDrone).connect(master);
    drone.start();
    setInterval(() => {
      if (!ctx || bisu) return;
      drone.frequency.linearRampToValueAtTime(
        NADA[Math.floor(Math.random() * 3)] / 2, ctx.currentTime + 2);
    }, 14000);
  }

  /* ------------------------------------------------------------------
     SFX
  ------------------------------------------------------------------ */
  function sfx(nama) {
    if (!ctx || bisu) return;
    const t = ctx.currentTime + 0.02;

    if (nama === "klik") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(720, t);
      osc.frequency.exponentialRampToValueAtTime(980, t + 0.06);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(master);
      osc.start(t); osc.stop(t + 0.12);
    }

    if (nama === "kunjungan") {            // chime naik saat mengunjungi desa
      [523.25, 659.25, 783.99].forEach((f, i) => nada(f, t + i * 0.12, 0.12, 1.6));
    }

    if (nama === "sukses") {               // fanfare penutup
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nada(f, t + i * 0.16, 0.14, 2.2));
      [1318.5, 1568].forEach((f, i) => nada(f, t + 1.0 + i * 0.2, 0.1, 2.6));
    }
  }

  /* ------------------------------------------------------------------
     MUTE / UNMUTE
  ------------------------------------------------------------------ */
  function setBisu(status) {
    bisu = status;
    if (!ctx) return;
    const target = bisu ? 0.0001 : 1;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.25);
  }

  return {
    init,
    pastikanJalan,
    sfx,
    setBisu,
    get bisu() { return bisu; },
  };
})();
