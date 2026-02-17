# @xstbot/cloudku ☁️

[![npm version](https://img.shields.io/npm/v/@xstbot/cloudku.svg?style=flat-square&color=2ecc71)](https://www.npmjs.com/package/@xstbot/cloudku)
[![license](https://img.shields.io/npm/l/@xstbot/cloudku.svg?style=flat-square&color=blue)](https://github.com/xstbot/cloudku)

**@xstbot/cloudku** adalah SDK resmi untuk layanan CloudKu CDN. Library ini memudahkan pengembang untuk mengunggah file ke server CDN CloudKu secara asinkron dengan integrasi yang sangat mudah pada aplikasi Node.js atau TypeScript.

---

## 🚀 Dokumentasi Lengkap
Untuk panduan visual, skema respons API, dan contoh integrasi yang lebih detail, silakan kunjungi:
👉 **[https://cloudku.sbs/npm](https://cloudku.sbs/npm)**

---

## 📦 Instalasi

Gunakan manager paket favorit Anda untuk menginstal:

\`\`\`bash
npm install @xstbot/cloudku
\`\`\`

## 🛠️ Cara Penggunaan

### JavaScript (CommonJS)
\`\`\`javascript
const { CloudKu } = require('@xstbot/cloudku');
const fs = require('fs');

async function CloudKu() {
    try {
        const buffer = fs.readFileSync('./my-photo.jpg');
        const response = await CloudKu(buffer, 'my-photo.jpg');

        if (response.status === 'success') {
            console.log('URL File:', response.url);
        } else {
            console.error('Gagal:', response.message);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

CloudKu();
\`\`\`

## 📋 Fitur Utama
- **Ringan & Cepat**: Tanpa dependensi berat.
- **Promise Based**: Mendukung penuh async/await.
- **TypeScript Ready**: Sudah termasuk file deklarasi tipe data (.d.ts).

## 📄 Lisensi
MIT © 2026 CloudKu
