import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import makeWASocket, { DisconnectReason, useMultiFileAuthState, WASocket, AnyMessageContent } from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as path from 'path';
import { Boom } from '@hapi/boom';
import { MessageProcessorService } from './message-processor.service';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private sock: WASocket;
  private readonly logger = new Logger(WhatsAppService.name);
  constructor(private readonly messageProcessor: MessageProcessorService) {}

  async onModuleInit() {
    await this.initWhatsApp();
  }

  async initWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve('baileys_auth_info'));
    this.sock = makeWASocket({
      auth: state
    });
    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error instanceof Boom && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(`Connection closed. Reconnecting: ${shouldReconnect}`);
        if (shouldReconnect) this.initWhatsApp();
      } else if (connection === 'open') {
        this.logger.log('WhatsApp connected!');
      }
      if (qr) {
        this.logger.log('Scan QR code to connect Lumine WhatsApp bot.');
        qrcode.generate(qr, { small: true });
      }
    });
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      // Proses semua pesan secara paralel
      await Promise.all(messages.map(async (msg) => {
        if (!msg.message) return;
        // Only process text messages from chats (not status/broadcast)
        if ((msg.message.conversation || msg.message.extendedTextMessage) && msg.key.remoteJid && !msg.key.remoteJid.endsWith('@broadcast')) {
          await this.handleIncomingMessage(msg);
        }
      }));
    });
  }

  async handleIncomingMessage(msg: any) {
    try {
      let typingSent = false;
      let typingMsg;
      let typingTimeout: NodeJS.Timeout | undefined;
      // Mulai proses AI dan timeout bersamaan
      const aiPromise = this.messageProcessor.processMessage(msg);
      const timeoutPromise = new Promise<void>(resolve => {
        typingTimeout = setTimeout(async () => {
          typingSent = true;
          typingMsg = await this.sock.sendMessage(msg.key.remoteJid, { text: 'Lumine sedang menyiapkan jawabannya...' }, { quoted: msg });
          resolve();
        }, 1500);
      });
      // Tunggu mana yang lebih dulu selesai: AI atau timeout
      const result = await Promise.race([aiPromise.then(() => 'ai'), timeoutPromise.then(() => 'timeout')]);
      let reply, log;
      if (result === 'ai') {
        // AI selesai duluan, batalkan timeout
        if (typingTimeout) clearTimeout(typingTimeout);
        ({ reply, log } = await aiPromise);
      } else {
        // Timeout duluan, tunggu AI selesai
        ({ reply, log } = await aiPromise);
      }
      if (reply) {
        await this.sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
        this.logger.log(log);
      }
    } catch (e) {
      this.logger.error(`Error processing message: ${e}`);
      await this.sendMessage(msg.key.remoteJid, 'Maaf, Lumine sedang tidak bisa menjawab sekarang. Silakan coba beberapa saat lagi.', msg);
    }
  }

  async sendMessage(jid: string, text: string, msg: any) {
    // Kirim jawaban dalam satu bubble, apapun panjangnya
    await this.sock.sendMessage(jid, { text }, { quoted: msg });
  }
}
