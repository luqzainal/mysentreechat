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
const { initializeWhatsAppService, getWhatsAppSocket, connectToWhatsApp, destroyClient } = require('./services/whatsappService.js');
const { notFound, errorHandler } = require('./middleware/errorMiddleware.js');

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
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
       console.log(`Forwarding connect request to whatsappService for user ${userId}`);
       await startWhatsAppSession(userId);
  });

   // Handle permintaan putus sambungan
   socket.on('whatsapp_disconnect_request', async () => {
        if (!userId) return socket.emit('error_message', 'Cannot disconnect without User ID');
        console.log(`Received whatsapp_disconnect_request from ${userId} (Socket: ${socket.id})`);
        await destroyClient(userId);
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
    const client = getWhatsAppSocket(userId);
    if (client) {
        try {
            const state = await client.getState();
            return state;
        } catch (error) {
            console.error(`Error getting client state for user ${userId}:`, error);
            return null;
        }
    }
    return null;
};

// Fungsi helper untuk memulakan sesi WhatsApp
const startWhatsAppSession = async (userId) => {
    return connectToWhatsApp(userId);
};

// Middleware Ralat
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Pelayan (termasuk WebSocket) berjalan pada port ${PORT}`));

// Export io untuk digunakan di tempat lain
module.exports = { io }; 