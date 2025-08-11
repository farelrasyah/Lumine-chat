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
      // Get message text
      const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      
      // Check if message is directed to bot (contains @lumine)
      const isBotMention = messageText.toLowerCase().includes('@lumine');
      
      let progressMessageId: string | null = null;
      let progressTimeout: NodeJS.Timeout | null = null;
      
      // Only set up progress message for bot mentions
      if (isBotMention) {
        progressTimeout = setTimeout(async () => {
          try {
            this.logger.debug('Sending progress message for bot mention...');
            const progressText = "Lumine sedang menyiapkan jawabannya...";
            const progressMessage = await this.sock.sendMessage(msg.key.remoteJid, {
              text: progressText
            }, { quoted: msg });
            progressMessageId = progressMessage?.key?.id || null;
            this.logger.debug(`Progress message sent with ID: ${progressMessageId}`);
          } catch (error) {
            this.logger.warn(`Failed to send progress message: ${error.message}`);
          }
        }, 200); // Show progress after 1 second
      }

      // Process message
      const startTime = Date.now();
      const response = await this.messageProcessor.processMessage(msg);
      const processingTime = Date.now() - startTime;
      
      // Clear progress timeout if processing finished quickl
      
      let log = '';
      
      // Handle different response types
      if (response) {
        log = response.log;
        
        // If response includes an image (for chart commands)
        if (response.image && response.imageCaption) {
          // Check if this is a PDF (for PDF reports)
          if (response.log && response.log.includes('PDF Report')) {
            // Send as document for PDF
            await this.sock.sendMessage(msg.key.remoteJid, {
              document: response.image,
              fileName: `Laporan_Keuangan_${new Date().toISOString().split('T')[0]}.pdf`,
              mimetype: 'application/pdf',
              caption: response.imageCaption
            }, { quoted: msg });
          } else {
            // Send as image for charts
            await this.sock.sendMessage(msg.key.remoteJid, {
              image: response.image,
              caption: response.imageCaption
            }, { quoted: msg });
          }
          
          this.logger.log(log);
        } 
        // Standard text reply
        else if (response.reply) {
          // Send text reply
          await this.sock.sendMessage(msg.key.remoteJid, { text: response.reply }, { quoted: msg });
          this.logger.log(log);
        }
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

  /**
   * Check if the message requires long-running operations
   */
  private isLongRunningOperation(messageText: string): boolean {
    const longRunningPatterns = [
      /chart/i,                    // Chart generation
      /analisis/i,                 // Analysis operations
      /laporan/i,                  // Report generation
      /statistik/i,                // Statistics
      /ringkasan/i,                // Summary
      /budget.*alert/i,            // Budget alerts
      /pengeluaran.*hari/i,        // Daily spending analysis
      /pengeluaran.*minggu/i,      // Weekly spending analysis
      /pengeluaran.*bulan/i,       // Monthly spending analysis
      /total.*pengeluaran/i        // Total spending calculations
    ];

    return longRunningPatterns.some(pattern => pattern.test(messageText));
  }

  /**
   * Get appropriate progress message based on operation type
   */
  private getProgressMessage(messageText: string): string {
    if (/chart/i.test(messageText)) {
      return '📊 Lumine sedang membuat chart untuk Anda...';
    }
    if (/analisis/i.test(messageText)) {
      return '🔍 Lumine sedang menganalisis data Anda...';
    }
    if (/laporan|ringkasan/i.test(messageText)) {
      return '📋 Lumine sedang menyiapkan laporan...';
    }
    if (/budget/i.test(messageText)) {
      return '💰 Lumine sedang mengecek budget Anda...';
    }
    if (/pengeluaran/i.test(messageText)) {
      return '📈 Lumine sedang menghitung pengeluaran...';
    }
    
    return 'Lumine sedang menyiapkan jawabannya...';
  }
}
