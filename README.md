# @xstbot/cloudku

> **CloudKu Official SDK** — Solusi integrasi CDN yang cepat, aman, dan dirancang khusus untuk pengembang modern.

[![NPM Version](https://img.shields.io/npm/v/@xstbot/cloudku)](https://www.npmjs.com/package/@xstbot/cloudku)
[![License](https://img.shields.io/npm/l/@xstbot/cloudku)](https://www.npmjs.com/package/@xstbot/cloudku)
[![Status](https://img.shields.io/badge/status-stable-brightgreen)]()

📦 NPM Package : https://www.npmjs.com/package/@xstbot/cloudku  
📖 Dokumentasi : https://cloudku.sbs/npm

---

## 📋 Daftar Isi

- [Tentang](#tentang)
- [Instalasi](#instalasi)
- [Penggunaan](#penggunaan)
  - [JavaScript (CommonJS)](#javascript-commonjs)
  - [TypeScript](#typescript)
- [Response Schema](#response-schema)
- [Contoh Lengkap](#contoh-lengkap)
- [Error Handling](#error-handling)
- [Lisensi](#lisensi)

---

## 📌 Tentang

`@xstbot/cloudku` adalah SDK resmi dari **CloudKu CDN** yang memungkinkan pengembang mengunggah file ke jaringan CDN secara mudah dan cepat. Library ini mendukung JavaScript (CommonJS) dan TypeScript, sehingga cocok digunakan di berbagai lingkungan pengembangan modern.

---

## 🚀 Instalasi

Pasang library melalui NPM dengan perintah berikut:

```bash
npm install @xstbot/cloudku
```

Atau menggunakan Yarn:

```bash
yarn add @xstbot/cloudku
```

---

## 📖 Penggunaan

### JavaScript (CommonJS)

Gunakan `require` untuk integrasi cepat pada proyek Node.js atau Express.

```js
const { CloudKu } = require('@xstbot/cloudku');

/**
 * Fungsi untuk menangani upload file
 * @param {Buffer} fileBuffer - Data buffer dari file
 * @param {String} fileName - Nama file yang diinginkan
 */
async function handleFileUpload(fileBuffer, fileName) {
  try {
    const result = await CloudKu(fileBuffer, fileName);

    if (result.status === 'success') {
      console.log('✅ File Berhasil Diunggah:', result.url);
    } else {
      console.error('❌ API Error:', result.message);
    }
  } catch (err) {
    console.error('🔥 System Error:', err.message);
  }
}
```

---

### TypeScript

Dukungan penuh tipe data untuk pengalaman pengembangan yang lebih aman dan terstruktur.

```ts
import { CloudKu, CloudKuResponse } from '@xstbot/cloudku';

const uploadToCDN = async (buffer: Buffer, name: string): Promise<void> => {
  const response: CloudKuResponse = await CloudKu(buffer, name);

  if (response.status === 'success') {
    // Properti 'url' sudah terdefinisi secara otomatis
    process.stdout.write(`✅ File live at: ${response.url}`);
  }
};
```

---

## 📊 Response Schema

Struktur data yang dikembalikan oleh setiap permintaan API:

| Property  | Type                  | Description                                         |
|-----------|-----------------------|-----------------------------------------------------|
| `status`  | `string`              | Mengembalikan `"success"` atau `"error"`            |
| `message` | `string`              | Detail pesan respons atau informasi error           |
| `url`     | `string \| undefined` | URL publik permanen file (hanya jika status sukses) |

---

## 💡 Contoh Lengkap

Berikut contoh penggunaan lengkap untuk upload file dari sistem lokal:

```js
const { CloudKu } = require('@xstbot/cloudku');
const fs = require('fs');
const path = require('path');

async function uploadLocalFile(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  console.log(`📤 Mengupload: ${fileName}`);

  const result = await CloudKu(fileBuffer, fileName);

  if (result.status === 'success') {
    console.log('✅ Upload berhasil!');
    console.log('🔗 URL File:', result.url);
  } else {
    console.error('❌ Upload gagal:', result.message);
  }
}

// Contoh pemanggilan
uploadLocalFile('./foto.jpg');
```

---

## ⚠️ Error Handling

Selalu gunakan `try/catch` untuk menangani error yang mungkin terjadi:

```js
const { CloudKu } = require('@xstbot/cloudku');

async function safeUpload(buffer, filename) {
  try {
    const result = await CloudKu(buffer, filename);

    if (result.status === 'success') {
      return result.url;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Upload gagal:', error.message);
    return null;
  }
}
```

---

## 🔗 Tautan Penting

| Sumber         | URL                                               |
|----------------|---------------------------------------------------|
| NPM Package    | https://www.npmjs.com/package/@xstbot/cloudku     |
| Dokumentasi    | https://cloudku.sbs/npm                           |
| CloudKu Utama  | https://cloudku.sbs                               |

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi yang tercantum pada halaman NPM resmi.  
Kunjungi: https://www.npmjs.com/package/@xstbot/cloudku

---

> © 2026 CloudKu CDN API • Developed for Modern Apps
