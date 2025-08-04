<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Lumine - WhatsApp AI Bot

Lumine adalah bot WhatsApp berbasis AI yang terintegrasi dengan Baileys dan NestJS. Bot ini hanya merespons pesan yang mengandung `@lumine` dan menggunakan layanan AI untuk menjawab pertanyaan Anda.

---

## 🚀 Instalasi

1. **Clone repository & install dependencies**

```bash
git clone <repo-anda>
cd lumine-chat
npm install
```

2. **Jalankan Project**

```bash
npm run start
```

3. **Koneksi WhatsApp (Scan QR)**

- Saat pertama kali dijalankan, terminal akan menampilkan QR code.
- Scan QR code tersebut menggunakan aplikasi WhatsApp Anda (menu: WhatsApp Web/Desktop).
- Setelah berhasil, bot akan aktif dan siap menerima pesan.

---

## 💡 Cara Menggunakan

- Kirim pesan ke WhatsApp bot atau grup yang sudah terhubung.
- Sertakan `@lumine` di awal pesan agar bot merespons. Contoh:

```
@lumine jelaskan fotosintesis dalam 3 poin
```

- Bot akan membalas dengan jawaban dari AI.

---

## ⚙️ Fitur

- Hanya merespons pesan dengan trigger `@lumine` (case-insensitive).
- Jawaban panjang otomatis dipecah jika lebih dari 1600 karakter.
- Menyimpan histori pertanyaan dan jawaban.
- Logging pertanyaan dan jawaban di console.
- Error handling: jika AI error, balasan: `Maaf, Lumine sedang tidak bisa menjawab sekarang. Silakan coba beberapa saat lagi.`

---

## ☁️ Deployment ke Cloudflare

- Project siap untuk dideploy ke Cloudflare Workers/Pages Functions.
- Pastikan endpoint yang diperlukan sudah diatur sesuai kebutuhan deployment Cloudflare.

---

## 🧪 Contoh Interaksi

**User WhatsApp:**
```
@lumine apa itu integral tak tentu?
```

**Response Bot:**
```
Integral tak tentu adalah bentuk integral yang tidak memiliki batas atas dan bawah. Biasanya ditulis dengan tanda ∫f(x)dx dan hasilnya termasuk konstanta C.
```

---

## 🔑 API Key AI

API Key AI sudah diintegrasikan di kode (env/service). Jika ingin mengganti, edit file `src/whatsapp/message-processor.service.ts`.

---

## Catatan

- Bot hanya menjawab pesan chat (bukan broadcast/status).
- Untuk fitur pengingat (Scheduler), struktur sudah disiapkan dan dapat dikembangkan lebih lanjut.

---

Selamat menggunakan Lumine! 🚀

$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
