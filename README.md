# 🏞️ Jelajahi Pesona Desa Indonesia

Game eksplorasi 3D bertema desa Nusantara untuk **media promosi & edukasi desa**.
Dibangun dengan HTML5 + CSS3 + JavaScript murni dan library **Three.js** (sudah
di-bundle lokal, tanpa backend, tanpa build step).

## Cara Menjalankan

Buka `index.html` di browser (double-click sudah cukup — semua asset lokal).

> Kalau ingin lebih rapi saat presentasi: `python -m http.server 8080`
> lalu buka `http://localhost:8080`.

## Struktur Proyek

```
index.html        → kerangka 4 layar (opening, kustomisasi, game, penutup)
css/style.css     → seluruh tampilan UI (glassmorphism, HUD, popup, animasi)
js/
├─ lib/three.min.js → library 3D (jangan diubah)
├─ data.js         → ✏️ DATA DESA + pengaturan game (titik edit utama!)
├─ audio.js        → mesin suara prosedural (angin, burung, musik, SFX)
├─ character.js    → pembuatan avatar 3D, palet warna, daftar aksesoris
├─ world.js        → dunia 3D (jalan, desa, sawah, sungai, gunung, awan, burung)
└─ main.js         → alur permainan, kontrol, minimap, popup, progres, ending
```

## Titik-Titik Edit Penting

| Ingin mengubah…              | Buka file       | Bagian                                   |
| ---------------------------- | --------------- | ---------------------------------------- |
| Data 4 desa tematik / tambah desa | `js/data.js` | array `DESA_LIST` & `CONFIG`          |
| Jarak antar desa / kecepatan / lari | `js/data.js` | `CONFIG` (`jarakAntarDesa`, `faktorLari`, dst.) |
| Foto asli desa               | `js/data.js`    | isi `foto:` & `galeri:` (mis. `"images/desa1.jpg"`) |
| Properti tema avatar         | `js/character.js` | `buatSemuaPropTema` (kamera/laptop/padi/panel) |
| Palet warna & aksesoris      | `js/character.js` | `PALET` & `AKSESORIS`                  |
| Warna UI, glassmorphism      | `css/style.css` | variabel di `:root`                      |
| Suara                        | `js/audio.js`   | ganti generator dengan `new Audio(...)`  |

## Konsep: Desa Tematik

Empat tema mengikuti program prioritas Kemendes PDT (Wisata, Digital, Pangan, Energi),
satu desa per tema. Saat mengunjungi sebuah desa, avatar otomatis memakai
**properti khas desanya** (kamera / laptop / malai padi / panel surya mini).

## Kontrol Permainan

- **↑ ↓** — jalan maju / mundur
- **← →** — geser kiri / kanan
- **Tahan ↑** — setelah ±1 detik karakter mulai **berlari** (kecepatan naik halus)
- **E** — kunjungi desa (saat dekat gapura)
- **M** — mute/unmute suara · **Esc** — tutup popup
- **Perangkat sentuh** : tanpa tombol arah — gunakan **analog virtual** di kiri
  bawah (geser = maju/mundur/kiri/kanan, **dorong jauh = lari**). Card penjelasan
  desa **terbuka otomatis** saat karakter sampai di gapura desa.

## Mode Pengembang

Buka `index.html#dev` untuk helper pengujian di konsol browser:

```js
__DESA.teleport(-60)      // pindah pemain ke dekat desa 1
__DESA.kunjungiSemua()    // tandai semua desa dikunjungi (uji ending)
```
