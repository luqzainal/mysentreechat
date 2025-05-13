const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal'); // Untuk debug QR di terminal
const fs = require('fs-extra'); // Import fs-extra
// Tukar import kepada require dan tambah .js
const WhatsappDevice = require('../models/WhatsappDevice.js');

// Tukar import model lain kepada require
// import OpenAI from 'openai'; // Biarkan jika OpenAI guna ES Module
const AutoresponderSetting = require('../models/AutoresponderSetting.js');
const User = require('../models/User.js');
const WhatsappConnection = require('../models/WhatsappConnection.js');
const Message = require('../models/Message.js');
// import path from 'path'; // Mungkin perlu require jika fail ini CommonJS
// import { fileURLToPath } from 'url';
// import { processSpintax } from '../utils/spintaxUtils.js'; // Tukar jika utils guna CommonJS
const path = require('path');
const { fileURLToPath } = require('url'); // url sepatutnya boleh di-require
const { processSpintax } = require('../utils/spintaxUtils.js');

// Dapatkan __dirname (kod ini mungkin tidak berfungsi dengan require, perlu disemak)
// const __filename = fileURLToPath(import.meta.url); // import.meta.url tidak wujud dalam CommonJS
// const __dirname = path.dirname(__filename);
// Guna __dirname terus dalam CommonJS

// Pemetaan Pelan ke Had Sambungan
const PLAN_LIMITS = {
    'Free': 1,
    'Basic': 2, // Contoh, sesuaikan ikut pelan anda
    'Pro': 5,
    // Default jika pelan tidak dikenali (atau beri ralat)
    'default': 1 
};

// Gunakan Map untuk menyimpan instance client per userId
const clients = new Map(); // Map<userId, Client>
let globalIO = null; // Simpan instance IO global

// Fungsi utiliti untuk kelewatan
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi untuk menghantar mesej teks
async function sendMessage(userId, jid, text) {
    const client = clients.get(userId); // Dapatkan client spesifik untuk user
    if (!client) {
        console.error(`Attempted to send message for user ${userId} but client is not initialized.`);
        throw new Error('WhatsApp client is not initialized for this user.');
    }
    try {
        const chatId = jid.endsWith('@g.us') ? jid : jid.replace(/@c.us$/, '') + '@c.us'; // Pastikan format @c.us
        console.log(`Sending message via service for user ${userId} to ${chatId}: ${text}`);
        // client.sendMessage memerlukan chatId, bukan jid penuh? Semak dokumentasi. Ya, perlukan chatId.
        const sentMessage = await client.sendMessage(chatId, text);
        console.log(`Message sent successfully via service for user ${userId}, info:`, sentMessage.id._serialized);
        return sentMessage; // Kembalikan objek mesej yang dihantar
    } catch (error) {
        console.error(`Error sending message for user ${userId} to ${jid} via service:`, error);
        throw new Error(error.message || `Failed to send message via WhatsApp service for user ${userId}.`);
    }
}

// Fungsi untuk menyambung ke WhatsApp
async function connectToWhatsApp(userId) {
    // DIKELUARKAN: Pemeriksaan klien sedia ada yang menghalang sambungan baru
    // if (clients.has(userId)) {
    //     console.log(`Client untuk user ${userId} sudah wujud atau sedang cuba bersambung.`);
    //     // Mungkin hantar status semasa jika perlu
    //     try {
    //        const state = await clients.get(userId).getState();
    //        if(globalIO) globalIO.to(userId).emit('whatsapp_status', state || 'connecting');
    //     } catch (e) {
    //        console.warn(`Gagal dapatkan state client sedia ada untuk user ${userId}: ${e.message}`);
    //     }
    //     return; // Jangan cipta client baru jika sudah ada
    // }

    // --- SEMAKAN HAD SAMBUNGAN (berdasarkan WhatsappDevice) ---
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`Pengguna ${userId} tidak ditemui.`);
            if (globalIO) globalIO.to(userId).emit('error_message', 'Pengguna tidak ditemui.');
            return;
        }

        const plan = user.membershipPlan || 'Free';
        const limit = PLAN_LIMITS[plan] || PLAN_LIMITS['default'];

        // Kira sambungan yang statusnya 'connected' dalam WhatsappDevice
        const currentActiveDevices = await WhatsappDevice.countDocuments({ userId, connectionStatus: 'connected' });

        console.log(`Pelan pengguna ${userId}: ${plan}, Had: ${limit}, Peranti aktif semasa (WhatsappDevice): ${currentActiveDevices}`);

        if (currentActiveDevices >= limit) {
            console.warn(`Had sambungan peranti (${limit}) untuk pengguna ${userId} (pelan ${plan}) telah dicapai.`);
            if (globalIO) {
                globalIO.to(userId).emit('whatsapp_status', 'limit_reached');
                globalIO.to(userId).emit('error_message', `Had sambungan peranti (${limit}) untuk pelan ${plan} anda telah dicapai.`);
            }
            return; // Hentikan proses sambungan
        }

        // Jika ada client lama untuk userId ini, musnahkan dahulu
        if (clients.has(userId)) {
            console.log(`Memusnahkan client sedia ada untuk user ${userId} sebelum memulakan sesi QR baru.`);
            await destroyClientByUserId(userId, false); 
        }

        // === PEMBERSIHAN SESI LEBIH AGRESIF ===
        const sessionPath = path.join(__dirname, 'sessions', userId);
        const oldSessionPath = path.join(__dirname, 'sessions', `${userId}_${Date.now()}_old`); // Tambah timestamp unik
        try {
            if (await fs.pathExists(sessionPath)) { // Semak jika folder wujud
                console.log(`[${userId}] Cuba tukar nama folder sesi: ${sessionPath} -> ${oldSessionPath}`);
                await fs.rename(sessionPath, oldSessionPath);
                console.log(`[${userId}] Berjaya tukar nama folder sesi.`);
                console.log(`[${userId}] Cuba padam folder sesi lama (dinamakan semula): ${oldSessionPath}`);
                await fs.remove(oldSessionPath);
                console.log(`[${userId}] Folder sesi lama (dinamakan semula) berjaya dipadam.`);
            } else {
                console.log(`[${userId}] Folder sesi ${sessionPath} tidak wujud, tidak perlu padam.`);
            }
             // Tambah kelewatan kecil
             const cleanupDelay = 200; // 200ms
             console.log(`[${userId}] Menunggu ${cleanupDelay}ms selepas pembersihan sesi...`);
             await delay(cleanupDelay);
             console.log(`[${userId}] Kelewatan selesai.`);

        } catch (err) {
            console.error(`[${userId}] Ralat semasa pembersihan sesi agresif (rename/delete/delay):`, err);
            // Mungkin tidak kritikal jika folder sudah tiada, teruskan?
            // Jika ralat serius, mungkin patut berhenti?
             if (globalIO) globalIO.to(userId).emit('error_message', 'Ralat semasa persediaan sesi baru.');
             return; // Hentikan jika pembersihan gagal teruk
        }
        // === AKHIR PEMBERSIHAN AGRESIF ===

    } catch (dbError) {
         console.error("Ralat DB semasa menyemak had sambungan atau memusnahkan klien lama:", dbError);
         if (globalIO) globalIO.to(userId).emit('error_message', 'Ralat pelayan semasa persediaan sambungan.');
         return;
    }
    // --- AKHIR SEMAKAN HAD ---

    console.log(`Memulakan sambungan WhatsApp BARU untuk pengguna: ${userId}...`);
    // Kemaskini status ke 'connecting' dalam DB (WhatsappConnection mungkin boleh dipertimbangkan untuk dibuang jika WhatsappDevice memadai)
    try {
        await WhatsappConnection.findOneAndUpdate(
             // Cari rekod yang sesuai untuk disambungkan (atau cipta baru jika tiada)
             // Logik ini mungkin perlu disemak semula bergantung pada bagaimana anda mahu handle multiple devices
             { userId, status: { $nin: ['connected', 'limit_reached'] } }, // Cari yang belum bersambung atau had
             { userId, status: 'connecting', qrCode: null, phoneNumber: 'pending', jid: 'pending' },
             { upsert: true, new: true, sort: { createdAt: -1 } }
        );
         if (globalIO) globalIO.to(userId).emit('whatsapp_status', 'connecting');
     } catch(dbError) {
         console.error(`Ralat mengemaskini status DB ke connecting untuk user ${userId}:`, dbError);
         // Teruskan?
     }

    // Cipta instance client baru untuk pengguna ini
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: userId, dataPath: `sessions` }), // Simpan sesi dalam sessions/userId
        puppeteer: {
            // headless: false, // Set false untuk debug jika perlu lihat browser
             args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                // '--single-process', // Hanya jika perlu
                '--disable-gpu'
            ],
            // executablePath: '/usr/bin/google-chrome-stable' // Tetapkan jika perlu (terutama di Linux)
        },
         // Opsyen lain seperti userAgent, dll. boleh ditambah di sini
         // browser: ['WaziperV2', 'Chrome', '1.0.0'], // wwebjs mungkin ada cara lain utk set User Agent
    });

    // Simpan client dalam Map
    clients.set(userId, client);

    // Listener untuk QR Code
    client.on('qr', async (qr) => {
        const handlerUserId = client.options.authStrategy.clientId; // Dapatkan userId lagi untuk kepastian
        console.log(`[${handlerUserId}] Handler client.on('qr') dimasuki.`); // Log masuk

        try {
            console.log(`[${handlerUserId}] String QR diterima: ${qr ? qr.substring(0, 50) + '...' : 'null/kosong'}`); // Log permulaan QR

            if (globalIO) {
                console.log(`[${handlerUserId}] Menghantar whatsapp_status: waiting_qr`);
                globalIO.to(handlerUserId).emit('whatsapp_status', 'waiting_qr');

                console.log(`[${handlerUserId}] Menghantar whatsapp_qr...`);
                globalIO.to(handlerUserId).emit('whatsapp_qr', qr);
                console.log(`[${handlerUserId}] Berjaya menghantar whatsapp_qr.`);

            } else {
                console.warn(`[${handlerUserId}] globalIO tidak tersedia dalam handler QR.`);
            }

            console.log(`[${handlerUserId}] Cuba kemaskini status DB ke waiting_qr...`);
            await WhatsappConnection.updateOne(
                { userId: handlerUserId, status: 'connecting' },
                { status: 'waiting_qr', qrCode: qr }
            );
            console.log(`[${handlerUserId}] Status DB dikemaskini ke waiting_qr.`);

        } catch (error) {
            console.error(`[${handlerUserId}] Ralat di dalam handler client.on('qr'):`, error); // Log sebarang ralat dalam handler
        }
    });

    // Listener untuk sedia digunakan
    client.on('ready', async () => {
        const appUserId = client.options.authStrategy.clientId; // Ini adalah ID pengguna aplikasi
        console.log(`[whatsappService] Client READY for app user: ${appUserId}`);
        
        if (globalIO) {
            globalIO.to(appUserId).emit('whatsapp_status', 'connected');
            globalIO.to(appUserId).emit('whatsapp_qr', null); 
        }

        const clientInfo = client.info;
        const actualWhatsAppJid = clientInfo.wid._serialized; // JID WhatsApp sebenar, cth: "60123456789@c.us"
        const actualPhoneNumber = clientInfo.wid.user;    // Nombor telefon sahaja, cth: "60123456789"

        console.log(`[whatsappService] Connected WhatsApp JID: ${actualWhatsAppJid}, Number: ${actualPhoneNumber}`);

        try {
            // 1. Pastikan semua peranti lain untuk appUserId ini ditanda disconnected dahulu
            // Ini penting jika kita hanya benarkan satu sesi aktif per appUserId melalui LocalAuth({clientId: userId})
            await WhatsappDevice.updateMany(
                { userId: appUserId, deviceId: { $ne: actualWhatsAppJid } }, // Jangan sentuh peranti semasa jika rekodnya dah ada dgn JID ini
                { connectionStatus: 'disconnected' }
            );
            console.log(`[whatsappService] Marked other devices for user ${appUserId} as disconnected.`);

            // 2. Cari atau cipta/kemaskini rekod WhatsappDevice untuk peranti yang baru bersambung ini
            let deviceRecord = await WhatsappDevice.findOne({ userId: appUserId, deviceId: actualWhatsAppJid });

            if (deviceRecord) {
                console.log(`[whatsappService] Found existing WhatsappDevice record: ${deviceRecord.deviceId}, updating status.`);
                deviceRecord.connectionStatus = 'connected';
                deviceRecord.name = deviceRecord.name || `Device ${actualPhoneNumber}`; // Kemaskini nama jika belum ada
                deviceRecord.number = actualPhoneNumber;
                deviceRecord.jid = actualWhatsAppJid; // Pastikan JID adalah yang terkini
                deviceRecord.lastConnectedAt = new Date();
                await deviceRecord.save();
            } else {
                console.log(`[whatsappService] No existing WhatsappDevice record for JID ${actualWhatsAppJid}, creating new one for user ${appUserId}.`);
                deviceRecord = await WhatsappDevice.create({
                    userId: appUserId,
                    deviceId: actualWhatsAppJid, // Gunakan JID sebagai deviceId unik
                    name: `Device ${actualPhoneNumber}`,
                    number: actualPhoneNumber,
                    jid: actualWhatsAppJid,
                    connectionStatus: 'connected',
                    isAiEnabled: false, // Default untuk peranti baru
                    lastConnectedAt: new Date()
                });
                console.log(`[whatsappService] Created new WhatsappDevice: ${deviceRecord.deviceId}`);
            }

            // 3. Kemaskini juga rekod WhatsappConnection (jika model ini masih digunakan secara aktif untuk status)
            // Ini adalah logik sedia ada, pastikan ia konsisten atau buang jika WhatsappDevice sudah mencukupi.
            await WhatsappConnection.updateOne(
                { userId: appUserId, status: { $in: ['waiting_qr', 'connecting'] } }, 
                {
                    status: 'connected',
                    qrCode: null,
                    jid: actualWhatsAppJid, 
                    phoneNumber: actualPhoneNumber,
                    lastConnectedAt: new Date()
                },
                 { upsert: false } 
            );
            console.log(`[whatsappService] WhatsappConnection status updated to 'connected' for user ${appUserId}`);

        } catch (dbError) {
            console.error(`[whatsappService] DB error during client.on('ready') for user ${appUserId}:`, dbError);
        }
    });

    // Listener untuk mesej masuk
    client.on('message', async (msg) => {
         const sessionIdentifier = client.options.authStrategy.clientId; // Ini adalah userId pengguna aplikasi
         
         let deviceRecord = null;
         let actualUserId = null;
         let actualDeviceId = null; // Untuk simpan deviceId sebenar

         try {
             // Cari rekod WhatsappDevice yang aktif untuk userId (sessionIdentifier) ini
             deviceRecord = await WhatsappDevice.findOne({
                 userId: sessionIdentifier, 
                 connectionStatus: 'connected' 
             });

             if (deviceRecord) {
                 actualUserId = deviceRecord.userId; // Sepatutnya sama dengan sessionIdentifier
                 actualDeviceId = deviceRecord.deviceId; // Ini deviceId yang akan kita guna
             } else {
                 console.error(`[whatsappService] No active WhatsappDevice record found for user (session identifier): ${sessionIdentifier}. Cannot process incoming message.`);
                 return; 
             }
         } catch (dbError) {
             console.error(`[whatsappService] DB error fetching active WhatsappDevice for user ${sessionIdentifier}:`, dbError);
             return;
         }

         if (msg.id.fromMe) {
             console.log(`[whatsappService] Ignoring own message for user ${actualUserId}, device ${actualDeviceId}`);
             return;
         };
         
         const sender = msg.from;
         const messageText = msg.body;
         const timestamp = new Date(msg.timestamp * 1000);
         const messageId = msg.id._serialized;

         console.log(`[whatsappService] Message received from ${sender} for user ${actualUserId} on device ${actualDeviceId}: ${messageText}`);

         try {
             const newMessage = new Message({
                 user: actualUserId,
                 chatJid: sender,
                 body: messageText,
                 timestamp: timestamp,
                 fromMe: false, 
                 messageId: messageId,
                 status: 'received',
                 sourceDeviceId: actualDeviceId // Guna actualDeviceId
             });
             await newMessage.save();
             console.log(`[whatsappService] Received message saved to DB for user ${actualUserId}, device ${actualDeviceId}.`);
         } catch (dbError) {
              if (dbError.code === 11000) {
                  console.warn(`[whatsappService] Message ${messageId} already exists for user ${actualUserId}, device ${actualDeviceId}.`);
              } else {
                 console.error(`[whatsappService] Failed to save received message for user ${actualUserId}, device ${actualDeviceId}:`, dbError);
              }
         }

         if (globalIO) {
             const messageData = {
                 id: messageId,
                 sender: sender,
                 body: messageText,
                 timestamp: timestamp.toISOString(),
                 fromMe: false,
                 sourceDeviceId: actualDeviceId // Hantar actualDeviceId
             };
             globalIO.to(actualUserId.toString()).emit('new_whatsapp_message', messageData);
             console.log(`[whatsappService] Emitted new_whatsapp_message to user room: ${actualUserId} for device ${actualDeviceId}`);
         }

         // 3. Logik Autoresponder (jika ada dan perlu disesuaikan dengan peranti)
         try {
             const settings = await AutoresponderSetting.findOne({ user: actualUserId });
             if (settings && settings.isEnabled) {
                 let replyToSend = null;
                 if (settings.useAI && settings.openaiApiKey && messageText) {
                     console.log(`AI Autoresponder active for user ${actualUserId}. Processing...`);
                     try {
                         const openai = new OpenAI({ apiKey: settings.openaiApiKey });
                         const completion = await openai.chat.completions.create({
                             model: "gpt-3.5-turbo",
                             messages: [
                                 { role: "system", content: settings.prompt },
                                 { role: "user", content: messageText }
                             ],
                         });
                         const aiReply = completion.choices[0]?.message?.content;
                         if (aiReply) {
                             replyToSend = aiReply;
                             console.log(`OpenAI Reply: ${replyToSend}`);
                         } else {
                             console.log('No reply from OpenAI. Using default if available.');
                             if (settings.defaultReply) {
                                  replyToSend = processSpintax(settings.defaultReply);
                                  console.log(`Using default reply (spun): ${replyToSend}`);
                             }
                         }
                     } catch (openaiError) {
                         console.error('OpenAI API error:', openaiError.message);
                         if (settings.defaultReply) {
                             replyToSend = processSpintax(settings.defaultReply);
                             console.log(`Using default reply (spun) after AI error: ${replyToSend}`);
                         }
                     }
                 } else if (settings.defaultReply) {
                     replyToSend = processSpintax(settings.defaultReply);
                     console.log(`Using default reply (spun): ${replyToSend}`);
                 }

                 if (replyToSend) {
                      console.log(`Sending auto-reply to ${sender}: ${replyToSend}`);
                      try {
                          // Guna msg.reply untuk membalas terus ke mesej asal
                           const sentReply = await msg.reply(replyToSend);
                           // Simpan juga mesej auto-reply ke DB
                           try {
                              const autoReplyMessage = new Message({
                                  user: actualUserId,
                                  chatJid: sender,
                                  body: replyToSend,
                                  timestamp: new Date(sentReply.timestamp * 1000), // Guna timestamp dari balasan
                                  fromMe: true,
                                  messageId: sentReply.id._serialized, // Guna ID dari balasan
                                  status: 'sent'
                              });
                              await autoReplyMessage.save();
                          } catch (dbSaveError) {
                               if (dbSaveError.code === 11000) {
                                   console.warn(`Auto-reply message ${sentReply.id._serialized} already exists in DB for user ${actualUserId}.`);
                               } else {
                                  console.error("Failed to save auto-reply message to DB:", dbSaveError);
                               }
                          }
                      } catch (replyError) {
                           console.error(`Failed to send auto-reply to ${sender} for user ${actualUserId}:`, replyError);
                      }
                 }
             } else {
                  if (!settings) console.log(`Tiada tetapan autoresponder ditemui untuk pengguna ${actualUserId}.`);
                  else if (!settings.isEnabled) console.log(`Autoresponder tidak aktif untuk pengguna ${actualUserId}.`);
             }

         } catch (dbError) {
           console.error('Ralat mendapatkan tetapan autoresponder dari DB:', dbError);
         }
    });

    // Listener untuk diskonek
    client.on('disconnected', async (reason) => {
         const localUserId = client.options.authStrategy.clientId; 
         console.log(`[whatsappService] client.on('disconnected') event. User: ${localUserId}, Reason: ${reason}`);

         if (globalIO) {
            console.log(`[whatsappService] Emitting 'whatsapp_status: disconnected' to user ${localUserId}`);
            globalIO.to(localUserId).emit('whatsapp_status', 'disconnected');
            globalIO.to(localUserId).emit('whatsapp_qr', null);
         }
         
         try {
            // Kemaskini WhatsappConnection
            console.log(`[whatsappService] Updating WhatsappConnection status to disconnected for user ${localUserId}`);
            await WhatsappConnection.updateOne(
                { userId: localUserId, status: 'connected' }, 
                { status: 'disconnected', qrCode: null }
            );
            console.log(`[whatsappService] WhatsappConnection status updated for user ${localUserId}`);

            // === TAMBAHAN: Kemaskini juga WhatsappDevice ===
            console.log(`[whatsappService] Updating WhatsappDevice status to disconnected for user ${localUserId}`);
            // Andaikan hanya ada satu peranti aktif per clientId LocalAuth pada satu masa
            await WhatsappDevice.updateMany(
                { userId: localUserId, connectionStatus: 'connected' }, 
                { connectionStatus: 'disconnected' }
            );
            console.log(`[whatsappService] WhatsappDevice status updated for user ${localUserId}`);
            // === AKHIR TAMBAHAN ===

         } catch (dbError) {
             console.error(`[whatsappService] DB error updating status to disconnected for user ${localUserId}:`, dbError);
         }

         // Cuba bersihkan sesi jika perlu
         if (reason === 'LOGGED_OUT' || reason === 'NAVIGATION' || reason === 'CONFLICT') { 
               console.log(`[whatsappService] Reason is ${reason}, attempting to clear session folder for ${localUserId}`);
               const fs = require('fs-extra');
               const sessionPath = path.join(__dirname, 'sessions', localUserId);
               try {
                   await fs.remove(sessionPath);
                   console.log(`[whatsappService] Session folder ${sessionPath} removed successfully.`);
               } catch (err) {
                   console.error(`[whatsappService] Error removing session folder ${sessionPath}:`, err);
               }
         }

         console.log(`[whatsappService] Attempting to delete client from Map for user ${localUserId}. Current size: ${clients.size}`);
         const deleted = clients.delete(localUserId);
         console.log(`[whatsappService] Client for user ${localUserId} deleted from Map: ${deleted}. New size: ${clients.size}`);
         console.log(`[whatsappService] Does client still exist in Map for ${localUserId}? ${clients.has(localUserId)}`);
    });

    // Listener untuk ralat pengesahan
    client.on('auth_failure', async (msg) => {
         const localUserId = client.options.authStrategy.clientId; // Cuba dapatkan userId jika boleh
         console.error(`Kegagalan Pengesahan untuk user ${localUserId || 'unknown'}:`, msg);
          if (localUserId && globalIO) {
            globalIO.to(localUserId).emit('whatsapp_status', 'auth_failure');
            globalIO.to(localUserId).emit('error_message', `Authentication failed: ${msg}. Please try reconnecting.`);
            globalIO.to(localUserId).emit('whatsapp_qr', null);
         }
          // Kemaskini DB ke status error atau disconnected
          if (localUserId) {
              try {
                  await WhatsappConnection.updateOne(
                      { userId: localUserId },
                      { status: 'disconnected', qrCode: null } // Atau 'error'
                  );
              } catch (dbError) {
                  console.error(`Ralat mengemaskini status DB ke disconnected (auth fail) untuk user ${localUserId}:`, dbError);
              }
              // Hapus client dari Map
              clients.delete(localUserId);
              console.log(`Client instance for user ${localUserId} removed due to auth failure.`);
          }
    });

     // Listener untuk ralat umum lain (jika ada)
     client.on('error', (err) => {
         const localUserId = client.options.authStrategy.clientId;
         console.error(`Ralat pada client user ${localUserId}:`, err);
         // Mungkin perlu handle spesifik berdasarkan jenis ralat
     });


    // Mulakan proses inisialisasi client
    client.initialize().catch(async err => {
        console.error(`Gagal menginisialisasi client untuk user ${userId}:`, err);
         // Pastikan client dihapus jika gagal initialize
         clients.delete(userId);
         // Kemaskini status DB ke disconnected/error
          try {
             await WhatsappConnection.updateOne({ userId, status: 'connecting' }, { status: 'disconnected' });
          } catch(dbErr) {/* ignore */}
        if (globalIO) {
            globalIO.to(userId).emit('whatsapp_status', 'disconnected');
             globalIO.to(userId).emit('error_message', `Failed to initialize WhatsApp connection: ${err.message}`);
        }
        // **KEMASKINI DB**: Pastikan status error jika initialize gagal
        try {
            await WhatsappDevice.updateOne({ userId: userId }, { connectionStatus: 'error' });
            console.log(`DB status updated to error (initialize failed) for user ${userId}`);
        } catch (dbError) {
             console.error(`Error updating DB status to error (initialize failed) for user ${userId}:`, dbError);
        }
    });

    console.log(`Listener untuk pengguna ${userId} telah disediakan.`);
}

// Terima userId semasa initialize
function initializeWhatsAppService(io) {
  globalIO = io;
  console.log('Servis WhatsApp diinisialisasi dengan Socket.IO');

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId; // Dapatkan userId dari query semasa sambungan socket.io
    if (userId) {
        socket.join(userId); // Sertai bilik berdasarkan userId
        console.log(`Pengguna Frontend ${socket.id} (User ID: ${userId}) bersambung dan menyertai bilik.`);

        // Hantar status semasa untuk pengguna ini jika client wujud
        const client = clients.get(userId);
        if (client) {
            client.getState().then(state => {
                 socket.emit('whatsapp_status', state || 'connecting'); // Hantar state semasa
                 // Jika state waiting_qr, cuba hantar QR lagi? Perlu QR disimpan? Ya, dari DB.
                 if (state === 'waiting_qr') {
                      WhatsappConnection.findOne({ userId, status: 'waiting_qr' }).then(conn => {
                          if (conn && conn.qrCode) {
                              socket.emit('whatsapp_qr', conn.qrCode);
                          }
                      });
                 }
            }).catch(e => {
                 console.warn(`Tidak dapat get state client untuk user ${userId}: ${e.message}`);
                 // Mungkin hantar status dari DB sebagai fallback?
                 WhatsappConnection.findOne({ userId }).sort({createdAt: -1}).then(conn => {
                      socket.emit('whatsapp_status', conn?.status || 'disconnected');
                 });
            });
        } else {
            // Jika client tiada, hantar status dari DB
             WhatsappConnection.findOne({ userId }).sort({createdAt: -1}).then(conn => {
                 socket.emit('whatsapp_status', conn?.status || 'disconnected');
             });
        }
    } else {
         console.log(`Pengguna Frontend ${socket.id} bersambung tanpa userId.`);
    }


    socket.on('whatsapp_connect_request', async (reqUserId) => {
      console.log(`Terima whatsapp_connect_request untuk user: ${reqUserId} dari socket ${socket.id}`);
      // Pastikan reqUserId sepadan dengan userId socket ini
      if (!userId || userId !== reqUserId) {
           console.warn(`Mismatch userId: socket user ${userId}, request user ${reqUserId}. Menolak.`);
           socket.emit('error_message', 'User ID mismatch.');
           return;
      }
       // Tidak perlu semak client lain sebab kita guna Map based on userId
       // if (clients.has(userId)) -> semakan ini sudah ada di connectToWhatsApp
       await connectToWhatsApp(userId);
    });

    socket.on('whatsapp_disconnect_request', async (reqUserId) => {
      console.log(`Terima whatsapp_disconnect_request untuk user ${reqUserId} dari socket ${socket.id}`);
       // Pastikan reqUserId sepadan dengan userId socket ini
      if (!userId || userId !== reqUserId) {
           console.warn(`Mismatch userId: socket user ${userId}, request user ${reqUserId}. Menolak.`);
           socket.emit('error_message', 'User ID mismatch.');
           return;
      }

      const client = clients.get(userId);
      if (client) {
        try {
           console.log(`Melakukan logout untuk client user ${userId}...`);
           await client.logout(); // Ini akan trigger event 'disconnected'
           // Event 'disconnected' akan handle pembersihan client dan kemaskini DB
           console.log(`Logout dipanggil untuk user ${userId}. Menunggu event disconnected...`);
        } catch (error) {
             console.error(`Ralat semasa memanggil logout untuk user ${userId}:`, error);
             // Cuba kemaskini DB secara manual jika logout gagal teruk
             try {
                 await WhatsappConnection.updateOne({ userId, status: { $ne: 'disconnected' } }, { status: 'disconnected', qrCode: null });
                 if(globalIO) globalIO.to(userId).emit('whatsapp_status', 'disconnected');
             } catch (dbErr) { /* ignore */ }
             // Hapus client dari Map secara manual
             clients.delete(userId);
        }
      } else {
        console.log(`Tiada sambungan aktif untuk diputuskan bagi user ${userId}.`);
        // Pastikan status DB betul
         try {
             await WhatsappConnection.updateOne({ userId, status: { $ne: 'disconnected' } }, { status: 'disconnected', qrCode: null });
         } catch(dbErr) {/* ignore */}
        socket.emit('whatsapp_status', 'disconnected');
      }
    });

    socket.on('disconnect', () => {
       if (userId) {
          console.log(`Pengguna Frontend ${socket.id} (User ID: ${userId}) terputus.`);
          socket.leave(userId); // Keluar dari bilik
       } else {
           console.log(`Pengguna Frontend ${socket.id} (tanpa userId) terputus.`);
       }
      // Jangan putuskan sambungan WhatsApp secara automatik
    });
  });
}

// Fungsi untuk dapatkan instance client WhatsApp yang aktif untuk user ID tertentu
function getWhatsAppSocket(userId) {
  return clients.get(userId); // Kembalikan client dari Map
}

// BARU: Fungsi untuk mematikan dan membersihkan client WhatsApp spesifik by userId
async function destroyClientByUserId(userId, sendDisconnectMessage = true) {
  const client = clients.get(userId);
  
  if (client) {
    console.log(`[whatsappService] Attempting to destroy client for user ${userId}...`);
    try {
      // Panggil client.destroy() terus. Ini sepatutnya menutup pelayar dan mencetuskan 'disconnected'.
      await client.destroy(); 
      console.log(`[whatsappService] client.destroy() called for user ${userId}.`);
      // Kita harapkan event 'disconnected' akan menguruskan pemadaman dari Map, sesi, dan DB.
      // Namun, kita akan letak fallback di bawah jika perlu.
    } catch (destroyError) {
      console.error(`[whatsappService] Error during client.destroy() for user ${userId}:`, destroyError);
      // Jika destroy gagal, kita masih perlu cuba bersihkan Map dan mungkin sesi secara manual.
    }

    // Fallback cleanup jika client masih dalam Map (menunjukkan event 'disconnected' tidak membersihkannya)
    // atau jika kita mahu pastikan pembersihan sesi berlaku di sini juga.
    if (clients.has(userId)){
        console.warn(`[whatsappService] Fallback: Client for ${userId} still in map after destroy attempt. Forcing removal & session cleanup.`);
        clients.delete(userId);
        console.log(`[whatsappService] Client for user ${userId} removed from Map (fallback). New size: ${clients.size}`);
        
        const fs = require('fs-extra');
        const sessionPath = path.join(__dirname, 'sessions', userId); 
        try {
            await fs.remove(sessionPath);
            console.log(`[whatsappService] Session folder ${sessionPath} removed (fallback).`);
        } catch (err) {
            // Abaikan ralat EBUSY di sini jika ia masih berlaku, kerana destroy() sepatutnya sudah cuba.
            if (err.code !== 'EBUSY') {
                console.error(`[whatsappService] Error removing session folder ${sessionPath} (fallback):`, err);
            }
        }
    }

  } else {
    console.log(`[whatsappService] No active client found for user ${userId} to destroy.`);
  }

  // Kemaskini status DB dan frontend (Gabungkan logik kemaskini DB di sini)
  try {
    // Kemaskini WhatsappConnection
    await WhatsappConnection.updateOne(
        { userId: userId, status: { $ne: 'disconnected' } }, 
        { status: 'disconnected', qrCode: null }
    );
    // Kemaskini WhatsappDevice
    await WhatsappDevice.updateMany(
        { userId: userId, connectionStatus: { $ne: 'disconnected' } }, 
        { connectionStatus: 'disconnected' }
    );
    
    if(globalIO && sendDisconnectMessage) { // Hanya hantar mesej jika dibenarkan
        globalIO.to(userId).emit('whatsapp_status', 'disconnected');
        globalIO.to(userId).emit('whatsapp_qr', null);
    }
    console.log(`[whatsappService] Ensured DB (Connection & Device) and frontend status is 'disconnected' for user ${userId} in destroyClientByUserId.`);
  } catch (dbErr) { 
      console.error(`[whatsappService] DB error during final disconnect update for ${userId} in destroyClientByUserId:`, dbErr); 
  }
}

// Fungsi untuk membersihkan semua sesi client (cth: semasa server shutdown)
async function cleanupWhatsAppClients() {
    console.log("Membersihkan semua client WhatsApp...");
    const cleanupPromises = [];
    for (const [userId, client] of clients.entries()) {
        console.log(`Menghancurkan client untuk user ${userId}...`);
        cleanupPromises.push(client.destroy().catch(e => console.error(`Gagal destroy client ${userId}: ${e.message}`)));
        // Kita mungkin tidak perlu kemaskini DB di sini kerana server sedang shutdown
    }
    await Promise.all(cleanupPromises);
    clients.clear();
    console.log("Semua client WhatsApp telah dibersihkan.");
}

// Export fungsi yang diperlukan (jika masih ada yang import fail ini? Sebaiknya tiada)
module.exports = {
    sendMessage,
    connectToWhatsApp,
    initializeWhatsAppService,
    getWhatsAppSocket,
    destroyClientByUserId,
    cleanupWhatsAppClients
};

// =======================================
// PENDAFTARAN SHUTDOWN HOOK (DIKOMEN KELUAR)
// process.on('SIGINT', cleanupWhatsAppClients);
// process.on('SIGTERM', cleanupWhatsAppClients);
// =======================================

// Contoh memanggil cleanup jika fail ini dijalankan secara langsung (mungkin tidak relevan)
if (require.main === module) {
    console.log("Menjalankan cleanup secara manual...");
    // cleanupWhatsAppClients();
} 