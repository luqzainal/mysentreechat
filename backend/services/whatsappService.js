import Baileys from '@whiskeysockets/baileys'; // Import keseluruhan modul
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = Baileys; // Destrukturisasi default dan named exports
// import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'; // Buang cara lama
import OpenAI from 'openai'; // Import OpenAI
import AutoresponderSetting from '../models/AutoresponderSetting.js'; // <-- Import model tetapan
import User from '../models/User.js'; // Import User model
import WhatsappConnection from '../models/WhatsappConnection.js'; // Import WhatsappConnection model
import Message from '../models/Message.js'; // <-- Tambah import Message model
import qrcode from 'qrcode';
import { Boom } from '@hapi/boom';
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

// Simpan instance sock dan data berkaitan
let sock = null;
let globalIO = null; // Simpan instance IO global
let currentUserId = null; // Jejaki userId untuk instance semasa

// Fungsi helper untuk dapatkan teks mesej
const getMessageText = (message) => {
  return message?.conversation || message?.extendedTextMessage?.text || '';
};

// Fungsi untuk menghantar mesej teks
export async function sendMessage(jid, text) {
    if (!sock || sock.user?.id === undefined) {
        console.error('Attempted to send message but WhatsApp socket is not connected.');
        throw new Error('WhatsApp is not connected. Please check the connection status.');
    }
    try {
        console.log(`Sending message via service to ${jid}: ${text}`);
        const sentMessageInfo = await sock.sendMessage(jid, { text: text });
        console.log('Message sent successfully via service, info:', sentMessageInfo?.key);
        return sentMessageInfo; // Kembalikan info mesej yang dihantar
    } catch (error) {
        console.error(`Error sending message to ${jid} via service:`, error);
        // Throw ralat semula supaya controller boleh tangkap
        throw new Error(error.message || 'Failed to send message via WhatsApp service.');
    }
}

export async function connectToWhatsApp(userId) {
  // --- SEMAKAN HAD SAMBUNGAN --- 
  try {
      const user = await User.findById(userId);
      if (!user) {
          console.error(`Pengguna ${userId} tidak ditemui.`);
          if (globalIO) globalIO.emit('error_message', 'Pengguna tidak ditemui.');
          currentUserId = null; // Reset
          return;
      }

      const plan = user.membershipPlan || 'Free';
      const limit = PLAN_LIMITS[plan] || PLAN_LIMITS['default'];
      
      // Kira sambungan sedia ada (yang aktif atau pernah cuba disambung)
      const currentConnectionCount = await WhatsappConnection.countDocuments({ userId });
      
      console.log(`Pelan pengguna ${userId}: ${plan}, Had: ${limit}, Sambungan sedia ada: ${currentConnectionCount}`);

      if (currentConnectionCount >= limit) {
          console.warn(`Had sambungan (${limit}) untuk pengguna ${userId} telah dicapai.`);
          if (globalIO) {
              globalIO.emit('whatsapp_status', 'limit_reached');
              globalIO.emit('error_message', `Had sambungan (${limit}) untuk pelan ${plan} anda telah dicapai.`);
          }
           // Kemaskini rekod yang mungkin dalam status connecting/waiting_qr ke limit_reached
           await WhatsappConnection.updateMany({ userId, status: { $in: ['connecting', 'waiting_qr'] } }, { status: 'limit_reached' });
          currentUserId = null; // Reset
          return; // Hentikan proses sambungan
      }

  } catch (dbError) {
       console.error("Ralat DB semasa menyemak had sambungan:", dbError);
       if (globalIO) globalIO.emit('error_message', 'Ralat pelayan semasa menyemak had sambungan.');
       currentUserId = null; // Reset
       return;
  }
  // --- AKHIR SEMAKAN HAD --- 

  const { state, saveCreds } = await useMultiFileAuthState(`sessions/${userId}`); // Guna folder sesi unik per pengguna
  
   // Kemaskini status ke 'connecting' dalam DB
   // Anggap pengguna hanya cuba sambung 1 nombor pada satu masa (limitasi semasa)
   try {
      await WhatsappConnection.findOneAndUpdate(
           // Cari rekod yang belum bersambung atau tiada rekod langsung (upsert)
           { userId, status: { $nin: ['connected', 'limit_reached'] } }, 
           { userId, status: 'connecting', qrCode: null, phoneNumber: 'pending', jid: 'pending' }, // Letak placeholder
           { upsert: true, new: true, sort: { createdAt: -1 } } // Ambil yg terbaru jika ada > 1 (sepatutnya tidak)
      );
       if (globalIO) globalIO.emit('whatsapp_status', 'connecting');
   } catch(dbError) {
       console.error("Ralat mengemaskini status DB ke connecting:", dbError);
       // Teruskan sambungan? Atau berhenti?
   }

  console.log(`Memulakan sambungan WhatsApp untuk pengguna: ${userId}...`);
  sock = makeWASocket({ // Cipta instance baru
    auth: state,
    printQRInTerminal: false, 
    browser: ['WaziperV2', 'Chrome', '1.0.0'], 
  });

  // Listener untuk event sambungan
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    const localUserId = currentUserId; // Ambil userId semasa event berlaku

    if (!localUserId) {
        console.warn("connection.update diterima tetapi tiada currentUserId. Mengabaikan.");
        return;
    }

    let currentStatus = 'disconnected'; // Default status
    let dbUpdate = {};
    let emitQR = null;

    if (qr) {
      console.log(`QR Diterima untuk user ${localUserId}, menghantar ke frontend...`);
      currentStatus = 'waiting_qr';
      emitQR = qr;
      dbUpdate = { status: 'waiting_qr', qrCode: qr };
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
                              lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Sambungan user ${localUserId} terputus disebabkan`, lastDisconnect?.error, ', menyambung semula', shouldReconnect);
      currentStatus = 'disconnected';
      dbUpdate = { status: 'disconnected', qrCode: null };
      emitQR = null;
      sock = null; // Reset instance global
      currentUserId = null;
      // Jangan sambung semula automatik
    }

    if (connection === 'open') {
      console.log(`Sambungan WhatsApp user ${localUserId} dibuka!`);
      currentStatus = 'connected';
      emitQR = null;
      const jid = sock?.user?.id;
      const phoneNumber = jid ? jid.split('@')[0] : 'unknown'; // Dapatkan nombor telefon
      dbUpdate = { 
          status: 'connected', 
          qrCode: null, 
          jid: jid || 'unknown@c.us',
          lastConnectedAt: new Date()
      };
       // Kemaskini juga phoneNumber jika ia 'pending' atau 'unknown'
       if (phoneNumber !== 'unknown') {
           dbUpdate.phoneNumber = phoneNumber;
       }
    }
    
    // Kemaskini Database
    try {
         // Cuba kemaskini rekod yang statusnya bukan disconnected/limit_reached
         // Ini sepatutnya rekod yang kita cipta/kemaskini semasa 'connecting'
        const updatedConn = await WhatsappConnection.findOneAndUpdate(
            { userId: localUserId, status: { $nin: ['disconnected', 'limit_reached'] } }, 
            { $set: dbUpdate }, 
            { new: true } // Dapatkan dokumen terkini
        );
        if (!updatedConn) {
             console.warn(`Tidak dapat mencari rekod WhatsappConnection untuk dikemaskini bagi user ${localUserId} dengan status aktif.`);
             // Jika status semasa adalah connected, cuba cipta/kemaskini berdasarkan JID
             if (currentStatus === 'connected' && dbUpdate.jid !== 'unknown@c.us') {
                  await WhatsappConnection.findOneAndUpdate(
                      { userId: localUserId, jid: dbUpdate.jid },
                      { $set: dbUpdate },
                      { upsert: true, new: true }
                  );
             }
        }
    } catch (dbError) {
        console.error(`Ralat mengemaskini status DB kepada ${currentStatus} untuk user ${localUserId}:`, dbError);
    }

    // Hantar status ke frontend
    if (globalIO) {
      globalIO.emit('whatsapp_status', currentStatus);
      if (emitQR !== undefined) {
        globalIO.emit('whatsapp_qr', emitQR);
      }
    }

  });

  // Listener untuk simpan kredential/sesi
  sock.ev.on('creds.update', saveCreds);

   // Listener untuk mesej masuk
   sock.ev.on('messages.upsert', async (m) => {
     const msgInfo = m.messages[0];
     if (!msgInfo.message) return;
     if (msgInfo.key.fromMe) return;
     
     // Dapatkan localUserId dari instance sock semasa (lebih selamat)
     const currentSock = getWhatsAppSocket(); // Guna fungsi getter
     const localUserId = currentSock?.user?.id ? currentSock.user.id.split(':')[0] : null; // Cuba dapatkan ID dari JID sock
     // const localUserId = currentUserId; // Guna variabel global mungkin kurang tepat
     
     if (!localUserId) {
         console.log('Tidak dapat menentukan ID pengguna aktif untuk sesi ini, autoresponder diabaikan.');
         return;
     }

     const sender = msgInfo.key.remoteJid;
     const messageText = getMessageText(msgInfo.message);
     const timestamp = new Date(msgInfo.messageTimestamp * 1000); // Convert Unix timestamp to JS Date
     const messageId = msgInfo.key.id;

     console.log(`Mesej diterima dari ${sender} untuk user ${localUserId}: ${messageText}`);

     // 1. Simpan mesej ke database
     try {
         const newMessage = new Message({
             user: localUserId,
             chatJid: sender,
             body: messageText,
             timestamp: timestamp,
             fromMe: false,
             messageId: messageId,
             status: 'received' // Status mesej diterima
         });
         await newMessage.save();
         console.log(`Received message from ${sender} saved to DB for user ${localUserId}.`);
     } catch (dbError) {
         console.error(`Failed to save received message from ${sender} to DB for user ${localUserId}:`, dbError);
         // Teruskan walaupun gagal simpan DB
     }

     // 2. Hantar mesej ke frontend melalui Socket.IO
     if (globalIO) {
         const messageData = {
             id: messageId, // Guna ID mesej WA
             sender: sender,
             body: messageText,
             timestamp: timestamp.toISOString(), // Hantar sebagai ISO string
             fromMe: false
         };
         // Emit ke bilik user yang betul
         globalIO.to(localUserId).emit('new_whatsapp_message', messageData);
          console.log(`Emitted new_whatsapp_message to user room: ${localUserId}`);
     }

     // 3. Logik Autoresponder (sedia ada)
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

             if (replyToSend && sock) { // Pastikan sock masih wujud
                  console.log(`Sending auto-reply to ${sender}: ${replyToSend}`);
                  // Tidak perlu guna fungsi sendMessage() di sini untuk elak infinite loop jika autoresponder balas diri sendiri
                  await sock.sendMessage(sender, { text: replyToSend });
                   // Simpan juga mesej auto-reply ke DB?
                    try {
                       const autoReplyMessage = new Message({
                           user: localUserId,
                           chatJid: sender,
                           body: replyToSend,
                           timestamp: new Date(),
                           fromMe: true,
                           messageId: `auto-${Date.now()}`, // ID sementara
                           status: 'sent'
                       });
                       await autoReplyMessage.save();
                   } catch (dbSaveError) {
                       console.error("Failed to save auto-reply message to DB:", dbSaveError);
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

  console.log(`Listener untuk pengguna ${userId} telah disediakan.`);
}

// Terima userId semasa initialize
export function initializeWhatsAppService(io) {
  globalIO = io;
  console.log('Servis WhatsApp diinisialisasi dengan Socket.IO');

  io.on('connection', (socket) => {
    console.log('Pengguna Frontend bersambung [WhatsApp Service]:', socket.id);

    // Hantar status semasa jika ada instance aktif (perlu ditambah baik)
    if (sock && currentUserId) {
         // Dapatkan status dari DB untuk kepastian?
         WhatsappConnection.findOne({ userId: currentUserId, status: 'connected' }).then(conn => {
             if (conn) socket.emit('whatsapp_status', 'connected');
         });
    }

    socket.on('whatsapp_connect_request', async (userId) => {
      console.log(`Terima whatsapp_connect_request untuk user: ${userId}`);
      if (sock && currentUserId && currentUserId !== userId) {
           console.log("Instance lain sedang aktif untuk pengguna berbeza. Menolak.");
           socket.emit('error_message', 'Pelayan sedang menguruskan sambungan lain. Sila cuba sebentar lagi.');
           return;
      } else if (sock && currentUserId === userId) {
          console.log("Instance untuk pengguna ini sudah ada. Mungkin cuba sambung semula?");
          // Hantar status semasa atau QR jika ada
          const existingConn = await WhatsappConnection.findOne({ userId, status: { $in: ['connecting', 'waiting_qr'] } });
          if (existingConn) {
              socket.emit('whatsapp_status', existingConn.status);
              if (existingConn.status === 'waiting_qr') {
                  socket.emit('whatsapp_qr', existingConn.qrCode);
              }
          } else {
              // Mungkin perlu trigger connectToWhatsApp lagi jika status disconnected
          }
          return;
      }
       currentUserId = userId; // Tetapkan pengguna semasa
       await connectToWhatsApp(userId);
    });

    socket.on('whatsapp_disconnect_request', async () => {
      console.log('Terima whatsapp_disconnect_request');
      if (sock && currentUserId) {
        try {
           await sock.logout(); // Ini akan trigger 'connection.update' dengan close
           console.log('Berjaya logout.');
        } catch (error) {
             console.error('Ralat semasa logout paksa:', error);
             // Mungkin perlu kemaskini DB secara manual di sini jika logout gagal
             await WhatsappConnection.updateMany({ userId: currentUserId, status: { $ne: 'disconnected' } }, { status: 'disconnected', qrCode: null });
             if(globalIO) globalIO.to(socket.id).emit('whatsapp_status', 'disconnected'); // Hantar terus ke peminta
        } finally {
             sock = null;
             currentUserId = null;
        }
      } else {
        console.log('Tiada sambungan aktif untuk diputuskan.');
        socket.emit('whatsapp_status', 'disconnected');
      }
    });

    socket.on('disconnect', () => {
      console.log('Pengguna Frontend terputus [WhatsApp Service]:', socket.id);
      // Jangan putuskan sambungan Baileys secara automatik
    });
  });
}

// Fungsi untuk dapatkan instance sock (mungkin perlu diubah suai untuk multi-instance)
export function getWhatsAppSocket() {
  return sock;
}

// Buang blok export di bawah ini
/*
export {
    connectToWhatsApp,
    sendMessage, 
    initializeWhatsAppService,
    // getWhatsAppSocket 
}; 
*/ 