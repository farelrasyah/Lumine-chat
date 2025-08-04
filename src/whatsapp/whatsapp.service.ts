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
      for (const msg of messages) {
        if (!msg.message) continue;
        // Only process text messages from chats (not status/broadcast)
        if ((msg.message.conversation || msg.message.extendedTextMessage) && msg.key.remoteJid && !msg.key.remoteJid.endsWith('@broadcast')) {
          await this.handleIncomingMessage(msg);
        }
      }
    });
  }

  async handleIncomingMessage(msg: any) {
    try {
      const { reply, log } = await this.messageProcessor.processMessage(msg);
      if (reply) {
        await this.sendMessage(msg.key.remoteJid, reply, msg);
        this.logger.log(log);
      }
    } catch (e) {
      this.logger.error(`Error processing message: ${e}`);
      await this.sendMessage(msg.key.remoteJid, 'Maaf, Lumine sedang tidak bisa menjawab sekarang. Silakan coba beberapa saat lagi.', msg);
    }
  }

  async sendMessage(jid: string, text: string, msg: any) {
    // Split message if >1600 chars
    const chunks = text.match(/(.|\s){1,1600}/g) || [];
    for (const chunk of chunks) {
      await this.sock.sendMessage(jid, { text: chunk }, { quoted: msg });
    }
  }
}
