import pkg from 'whatsapp-web.js'; // Import default dari CJS
const { Client, LocalAuth, MessageMedia } = pkg; // Destructure named exports

import OpenAI from 'openai'; // Import OpenAI
import AutoresponderSetting from '../models/AutoresponderSetting.js'; // <-- Import model tetapan
import User from '../models/User.js'; // Import User model
import WhatsappConnection from '../models/WhatsappConnection.js'; // Import WhatsappConnection model
import Message from '../models/Message.js'; // <-- Tambah import Message model
import qrcode from 'qrcode';
import path from 'path'; // Perlu path untuk __dirname dalam ES Modules
import { fileURLToPath } from 'url';
import { processSpintax } from '../utils/spintaxUtils.js'; // Import fungsi spintax

// Dapatkan __dirname dalam ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Fungsi untuk menghantar mesej teks
export async function sendMessage(userId, jid, text) {
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
export async function connectToWhatsApp(userId) {
    if (clients.has(userId)) {
        console.log(`Client untuk user ${userId} sudah wujud atau sedang cuba bersambung.`);
        // Mungkin hantar status semasa jika perlu
        try {
           const state = await clients.get(userId).getState();
           if(globalIO) globalIO.to(userId).emit('whatsapp_status', state || 'connecting');
        } catch (e) {
           console.warn(`Gagal dapatkan state client sedia ada untuk user ${userId}: ${e.message}`);
        }
        return; // Jangan cipta client baru jika sudah ada
    }

    // --- SEMAKAN HAD SAMBUNGAN ---
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`Pengguna ${userId} tidak ditemui.`);
            if (globalIO) globalIO.to(userId).emit('error_message', 'Pengguna tidak ditemui.');
            return;
        }

        const plan = user.membershipPlan || 'Free';
        const limit = PLAN_LIMITS[plan] || PLAN_LIMITS['default'];

        // Kira sambungan yang statusnya 'connected'
        const currentConnectionCount = await WhatsappConnection.countDocuments({ userId, status: 'connected' });

        console.log(`Pelan pengguna ${userId}: ${plan}, Had: ${limit}, Sambungan aktif: ${currentConnectionCount}`);

        if (currentConnectionCount >= limit) {
            console.warn(`Had sambungan (${limit}) untuk pengguna ${userId} telah dicapai.`);
            if (globalIO) {
                globalIO.to(userId).emit('whatsapp_status', 'limit_reached');
                globalIO.to(userId).emit('error_message', `Had sambungan (${limit}) untuk pelan ${plan} anda telah dicapai.`);
            }
            // Kemaskini rekod yang mungkin dalam status connecting/waiting_qr ke limit_reached
            await WhatsappConnection.updateMany({ userId, status: { $in: ['connecting', 'waiting_qr'] } }, { status: 'limit_reached' });
            return; // Hentikan proses sambungan
        }

    } catch (dbError) {
         console.error("Ralat DB semasa menyemak had sambungan:", dbError);
         if (globalIO) globalIO.to(userId).emit('error_message', 'Ralat pelayan semasa menyemak had sambungan.');
         return;
    }
    // --- AKHIR SEMAKAN HAD ---

    console.log(`Memulakan sambungan WhatsApp untuk pengguna: ${userId}...`);
    // Kemaskini status ke 'connecting' dalam DB
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
        const localUserId = client.options.authStrategy.clientId; // Dapatkan semula userId
        console.log(`Client WhatsApp untuk user ${localUserId} sedia!`);
        if (globalIO) {
            globalIO.to(localUserId).emit('whatsapp_status', 'connected');
            globalIO.to(localUserId).emit('whatsapp_qr', null); // Kosongkan QR
        }

        // Dapatkan info pengguna (nombor telefon, dll.)
        const clientInfo = client.info;
        const jid = clientInfo.wid._serialized; // JID pengguna (e.g., 60123456789@c.us)
        const phoneNumber = clientInfo.wid.user; // Nombor telefon (e.g., 60123456789)

        // Kemaskini DB
        try {
            await WhatsappConnection.updateOne(
                // Cari berdasarkan userId dan status 'waiting_qr' ATAU 'connecting' (jika QR tak sempat keluar)
                { userId: localUserId, status: { $in: ['waiting_qr', 'connecting'] } },
                {
                    status: 'connected',
                    qrCode: null,
                    jid: jid,
                    phoneNumber: phoneNumber,
                    lastConnectedAt: new Date()
                },
                 { upsert: false } // Jangan upsert, sepatutnya rekod sudah wujud
            );
             console.log(`Status DB dikemaskini ke 'connected' untuk user ${localUserId}`);
        } catch (dbError) {
            console.error(`Ralat mengemaskini status DB ke connected untuk user ${localUserId}:`, dbError);
        }
    });

    // Listener untuk mesej masuk
    client.on('message', async (msg) => {
         const localUserId = client.options.authStrategy.clientId; // Dapatkan semula userId
         // Abaikan mesej dari diri sendiri atau jika bukan mesej teks biasa (buat masa ini)
         // Note: msg.fromMe is sometimes unreliable, check msg.id.fromMe
         if (msg.id.fromMe) {
             console.log(`Ignoring own message for user ${localUserId}`);
             return;
         };
         // Anda mungkin mahu filter jenis mesej lain di sini

         const sender = msg.from; // JID pengirim (e.g., 60987654321@c.us or group JID)
         const messageText = msg.body; // Teks mesej
         const timestamp = new Date(msg.timestamp * 1000); // Timestamp
         const messageId = msg.id._serialized; // ID unik mesej (string)

         console.log(`Mesej diterima dari ${sender} untuk user ${localUserId}: ${messageText}`);

         // 1. Simpan mesej ke database
         try {
             const newMessage = new Message({
                 user: localUserId,
                 chatJid: sender,
                 body: messageText,
                 timestamp: timestamp,
                 fromMe: false, // atau msg.id.fromMe? Semak semula
                 messageId: messageId,
                 status: 'received'
             });
             await newMessage.save();
             console.log(`Received message from ${sender} saved to DB for user ${localUserId}.`);
         } catch (dbError) {
              // Handle duplicate key error (jika mesej sama diterima lagi)
              if (dbError.code === 11000) {
                  console.warn(`Message ${messageId} already exists in DB for user ${localUserId}.`);
              } else {
                 console.error(`Failed to save received message from ${sender} to DB for user ${localUserId}:`, dbError);
              }
         }

         // 2. Hantar mesej ke frontend melalui Socket.IO
         if (globalIO) {
             const messageData = {
                 id: messageId,
                 sender: sender,
                 body: messageText,
                 timestamp: timestamp.toISOString(),
                 fromMe: false
             };
             globalIO.to(localUserId).emit('new_whatsapp_message', messageData);
             console.log(`Emitted new_whatsapp_message to user room: ${localUserId}`);
         }

         // 3. Logik Autoresponder
         try {
             const settings = await AutoresponderSetting.findOne({ user: localUserId });
             if (settings && settings.isEnabled) {
                 let replyToSend = null;
                 if (settings.useAI && settings.openaiApiKey && messageText) {
                     console.log(`AI Autoresponder active for user ${localUserId}. Processing...`);
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
                                  user: localUserId,
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
                                   console.warn(`Auto-reply message ${sentReply.id._serialized} already exists in DB for user ${localUserId}.`);
                               } else {
                                  console.error("Failed to save auto-reply message to DB:", dbSaveError);
                               }
                          }
                      } catch (replyError) {
                           console.error(`Failed to send auto-reply to ${sender} for user ${localUserId}:`, replyError);
                      }
                 }
             } else {
                  if (!settings) console.log(`Tiada tetapan autoresponder ditemui untuk pengguna ${localUserId}.`);
                  else if (!settings.isEnabled) console.log(`Autoresponder tidak aktif untuk pengguna ${localUserId}.`);
             }

         } catch (dbError) {
           console.error('Ralat mendapatkan tetapan autoresponder dari DB:', dbError);
         }
    });

    // Listener untuk diskonek
    client.on('disconnected', async (reason) => {
         const localUserId = client.options.authStrategy.clientId; // Dapatkan semula userId
         console.log(`Client untuk user ${localUserId} terputus:`, reason);
         if (globalIO) {
            globalIO.to(localUserId).emit('whatsapp_status', 'disconnected');
            globalIO.to(localUserId).emit('whatsapp_qr', null);
         }
         // Kemaskini DB
         try {
            await WhatsappConnection.updateOne(
                { userId: localUserId, status: 'connected' }, // Cari yang sedang connected
                { status: 'disconnected', qrCode: null }
            );
         } catch (dbError) {
             console.error(`Ralat mengemaskini status DB ke disconnected untuk user ${localUserId}:`, dbError);
         }

         // Hapus client dari Map
         clients.delete(localUserId);
         console.log(`Client instance for user ${localUserId} removed.`);
          // Cuba bersihkan sesi jika perlu (terutama jika reason = 'LOGGED_OUT')
          // Mungkin perlu hapus folder sessions/localUserId?
          if (reason === 'LOGGED_OUT' || reason === 'NAVIGATION') { // 'NAVIGATION' maybe indicates unrecoverable state
               console.log(`Reason is ${reason}, attempting to clear session for ${localUserId}`);
               // Anda mungkin mahu menambah logik untuk menghapus folder sesi di sini
               // const sessionPath = path.join(__dirname, 'sessions', localUserId);
               // fs.rm(sessionPath, { recursive: true, force: true }, (err) => {...});
          }

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
    client.initialize().catch(err => {
        console.error(`Gagal menginisialisasi client untuk user ${userId}:`, err);
         // Pastikan client dihapus jika gagal initialize
         clients.delete(userId);
         // Kemaskini status DB ke disconnected/error
          try {
             WhatsappConnection.updateOne({ userId, status: 'connecting' }, { status: 'disconnected' });
          } catch(dbErr) {/* ignore */}
        if (globalIO) {
            globalIO.to(userId).emit('whatsapp_status', 'disconnected');
             globalIO.to(userId).emit('error_message', `Failed to initialize WhatsApp connection: ${err.message}`);
        }
    });

    console.log(`Listener untuk pengguna ${userId} telah disediakan.`);
}

// Terima userId semasa initialize
export function initializeWhatsAppService(io) {
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
export function getWhatsAppSocket(userId) {
  return clients.get(userId); // Kembalikan client dari Map
}

// Fungsi untuk membersihkan semua sesi client (cth: semasa server shutdown)
export async function cleanupWhatsAppClients() {
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

// Pastikan cleanup dijalankan semasa server berhenti
process.on('SIGINT', cleanupWhatsAppClients);
process.on('SIGTERM', cleanupWhatsAppClients); 