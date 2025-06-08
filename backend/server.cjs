const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./config/db.js');
const authRoutes = require('./routes/authRoutes.js');
const settingsRoutes = require('./routes/settingsRoutes.js');
const whatsappRoutes = require('./routes/whatsappRoutes.js');
const campaignRoutes = require('./routes/campaignRoutes.js');
const analyticsRoutes = require('./routes/analyticsRoutes.js');
const adminRoutes = require('./routes/adminRoutes.js'); 
const contactRoutes = require('./routes/contactRoutes.js');
const autoresponderRoutes = require('./routes/autoresponderRoutes.js'); 
const mediaRoutes = require('./routes/mediaRoutes.js');
const aiChatbotRoutes = require('./routes/aiChatbotRoutes.js');
const contactGroupRoutes = require('./routes/contactGroupRoutes.js');
const {
    initializeWhatsAppService,
    getWhatsAppSocket,
    connectToWhatsApp,
    destroyClientByUserId,
    cleanupWhatsAppClients
} = require('./services/baileysService.js');
const { notFound, errorHandler } = require('./middleware/errorMiddleware.js');
const mongoose = require('mongoose');
const User = require('./models/User');
const WhatsappDevice = require('./models/WhatsappDevice');
const crypto = require('crypto');
global.crypto = crypto;

// const baileysService = require('./services/baileysService.js'); // Import ini tidak diperlukan kerana kita guna destructuring di atas
// const { verifyToken } = require('./utils/authUtils.js'); // Fail tidak wujud

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

// Dapatkan URL frontend dari .env atau default ke port dev
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
console.log(`Allowed CORS origin for Socket.IO: ${allowedOrigin}`); // Log untuk pengesahan

const io = new Server(server, {
  cors: {
    origin: allowedOrigin, 
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Hidangkan fail statik dari folder uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Contoh Route Asas
app.get('/', (req, res) => {
  res.send('API sedang berjalan...');
});

// Gunakan Routes
app.use('/api/users', require('./routes/userRoutes.js'));
app.use('/api/contacts', contactRoutes);
app.use('/api/autoresponder', autoresponderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai-chatbot', aiChatbotRoutes);
app.use('/api/contact-groups', contactGroupRoutes);

// Initialize WhatsApp Service selepas io dicipta
initializeWhatsAppService(io);

// Logik Socket.IO - kini menggunakan whatsappService
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  const userId = socket.handshake.query.userId;
  console.log(`User ID ${userId || 'N/A'} connected via socket ${socket.id}.`);
  
  if (userId) {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room ${userId}`);

      // Hantar status semasa kepada client yang baru bersambung
      getClientStatus(userId).then(status => {
           if (status) {
               console.log(`Sending initial status '${status}' to user ${userId} (socket ${socket.id})`);
               socket.emit('whatsapp_status', status);
           } else {
               console.log(`No active client for ${userId}, sending initial status 'disconnected'`);
               socket.emit('whatsapp_status', 'disconnected');
           }
      }).catch(err => {
           console.error(`Error getting initial status for user ${userId}:`, err);
           socket.emit('whatsapp_status', 'error');
      });

  } else {
       console.warn(`Socket ${socket.id} connected without userId query parameter.`);
        socket.emit('error_message', 'User ID not provided during socket connection.');
  }

  // Handle permintaan status
  socket.on('get_whatsapp_status', async () => {
      if (!userId) return socket.emit('error_message', 'Cannot get status without User ID');
      console.log(`Received get_whatsapp_status from ${userId} (Socket: ${socket.id})`);
      try {
          const status = await getClientStatus(userId);
           console.log(`Current status for user ${userId} is '${status || 'inactive'}'. Emitting...`);
          socket.emit('whatsapp_status', status || 'disconnected');
      } catch (error) {
           console.error(`Error handling get_whatsapp_status for ${userId}:`, error);
           socket.emit('whatsapp_status', 'error');
      }
  });
  
  // Handle permintaan sambungan baru
  socket.on('whatsapp_connect_request', async (requestingUserId) => {
       console.log(`Received whatsapp_connect_request from user: ${requestingUserId} (Socket: ${socket.id})`);
       if (!userId || userId !== requestingUserId) {
            console.warn(`User ID mismatch on connect request: Socket Query=${userId}, Request Param=${requestingUserId}`);
            return socket.emit('error_message', 'User authentication mismatch.');
       }
       
       // Semak jika klien sudah wujud
       const existingClient = getWhatsAppSocket(userId); // Guna fungsi dari Baileys service
       if (existingClient) {
           console.log(`[Server] Client exists for user ${userId}. Attempting to destroy it before starting new session...`);
           try {
               await destroyClientByUserId(userId); // Cuba musnahkan yang lama dahulu
               console.log(`[Server] Existing client destroyed for user ${userId}. Proceeding with new connection.`);
           } catch (destroyError) {
               console.error(`[Server] Failed to destroy existing client for user ${userId}:`, destroyError);
               // Mungkin mahu hantar ralat ke frontend?
               // Teruskan juga? Mungkin klien sudah mati.
           }
       }
       
       console.log(`Forwarding connect request to whatsappService for user ${userId}`);
       await startWhatsAppSession(userId);
  });

   // Handle permintaan putus sambungan
   socket.on('whatsapp_disconnect_request', async (requestingUserId) => {
        console.log(`Received whatsapp_disconnect_request from user: ${requestingUserId} (Socket: ${socket.id})`);
        if (!userId || userId !== requestingUserId) {
             console.warn(`User ID mismatch on disconnect request: Socket User ID=${userId}, Requesting User ID=${requestingUserId}. Action denied.`);
             return socket.emit('error_message', 'User ID mismatch for disconnect request.');
        }
        console.log(`Forwarding disconnect request to whatsappService for user ${userId}`);
        await destroyClientByUserId(userId);
   });

  // Handle putus sambungan peranti spesifik
   socket.on('whatsapp_disconnect_device', (deviceId) => {
       if (!userId) return socket.emit('error_message', 'Cannot disconnect device without User ID');
       console.log(`Received whatsapp_disconnect_device for device ${deviceId} from ${userId}`);
       io.to(userId).emit('error_message', `Disconnecting specific device ${deviceId} not yet implemented.`);
   });

  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    if (userId) {
        socket.leave(userId);
    }
  });
});

// Fungsi helper untuk mendapatkan status client
const getClientStatus = async (userId) => {
    const client = getWhatsAppSocket(userId); // Dapatkan client dari Baileys service
    if (client) {
        // Jika client wujud dalam memori Baileys, kita anggap ia 'connected' 
        // Kerana Baileys akan membuangnya dari memori jika ia putus atau tidak dapat disambung semula.
        // Baileys tidak mempunyai fungsi getState() seperti whatsapp-web.js
        console.log(`[server.cjs] getClientStatus: Client found in Baileys Map for user ${userId}. Assuming 'connected'.`);
        return 'connected'; 
    } else {
        console.log(`[server.cjs] getClientStatus: Client NOT found in Baileys Map for user ${userId}. Checking DB for last known status...`);
        try {
            const device = await WhatsappDevice.findOne({ userId: userId, connectionStatus: 'connected' }); 
            if (device) {
                console.log(`[server.cjs] getClientStatus: Active device found in DB for user ${userId} with status '${device.connectionStatus}'. Returning it.`);
                return device.connectionStatus; // Kembalikan status dari DB (sepatutnya connected)
            }
            // Jika tiada peranti yang aktif bersambung dalam DB, cari yang paling baru dikemas kini
            const lastKnownDevice = await WhatsappDevice.findOne({ userId: userId }).sort({ updatedAt: -1 });
            if (lastKnownDevice) {
                console.log(`[server.cjs] getClientStatus: Last known device status from DB for user ${userId} is '${lastKnownDevice.connectionStatus}'.`);
                return lastKnownDevice.connectionStatus;
            }
            console.log(`[server.cjs] getClientStatus: No device record found in DB for user ${userId}. Returning 'disconnected'.`);
        } catch (dbError) {
            console.error(`[server.cjs] getClientStatus: DB error fetching status for user ${userId}:`, dbError);
        }
    }
    // Default jika tiada client dalam memori dan tiada info meyakinkan dari DB
    console.log(`[server.cjs] getClientStatus: Fallback, returning 'disconnected' for user ${userId}.`);
    return 'disconnected'; 
};

// Fungsi helper untuk memulakan sesi WhatsApp
const startWhatsAppSession = async (userId) => {
    return connectToWhatsApp(userId);
};

// Middleware Ralat
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => console.log(`Pelayan (termasuk WebSocket) berjalan pada port ${PORT}`));

// Export io untuk digunakan di tempat lain
module.exports = { io };

// Tangani penutupan yang betul (graceful shutdown)
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} diterima. Memulakan graceful shutdown...`);

    // 1. Hentikan server HTTP daripada menerima sambungan baru
    server.close(async () => {
        console.log('Server HTTP ditutup.');

        // 2. Tutup sambungan Socket.IO
        io.close(() => {
            console.log('Sambungan Socket.IO ditutup.');
        });

        // 3. Bersihkan client WhatsApp (Gunakan Baileys)
        try {
            // await whatsappService.cleanupWhatsAppClients(); // Panggil servis lama
            // await baileysService.cleanupWhatsAppClients(); // Tidak perlu panggil melalui objek jika sudah di-destructure
            await cleanupWhatsAppClients(); // Panggil terus fungsi yang diimport
            console.log('Client WhatsApp (Baileys) telah dibersihkan.');
        } catch (cleanupError) {
            console.error('Ralat semasa membersihkan client WhatsApp (Baileys):', cleanupError);
        }

        // 4. Tutup sambungan MongoDB
        // ... existing code ...
    });
}; 