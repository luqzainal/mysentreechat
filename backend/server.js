import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http'; // Guna createServer
import { Server } from 'socket.io'; // Import Server dari socket.io
import path from 'path'; // <-- Import path
import { fileURLToPath } from 'url'; // <-- Import fileURLToPath
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js'; // Import userRoutes
import contactRoutes from './routes/contactRoutes.js'; // Import contactRoutes
import whatsappRoutes from './routes/whatsappRoutes.js'; // Tambah import ini
import autoresponderRoutes from './routes/autoresponderRoutes.js'; // <-- Tambah import ini
import mediaRoutes from './routes/mediaRoutes.js'; // <-- Import mediaRoutes
import { initializeWhatsAppService } from './services/whatsappService.js'; // Import servis WhatsApp
import adminRoutes from './routes/adminRoutes.js'; // Import admin routes

dotenv.config(); // Memuatkan pembolehubah persekitaran dari .env

// Dapatkan __dirname dalam ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB(); // Panggil fungsi sambungan DB

const app = express();
const httpServer = createServer(app); // Guna createServer secara eksplisit
const io = new Server(httpServer, { // Lampirkan Socket.IO pada HTTP server
  cors: {
    origin: "http://localhost:5173", // Benarkan origin frontend anda (sesuaikan jika perlu)
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors()); // Membenarkan permintaan Cross-Origin
app.use(express.json()); // Untuk memparsing body permintaan JSON

// Hidangkan fail statik dari folder uploads
app.use('/uploads', express.static(path.join(__dirname, '/uploads'))); // <-- Tambah ini

// Contoh Route Asas
app.get('/', (req, res) => {
  res.send('API sedang berjalan...');
});

// Gunakan Routes
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/autoresponder', autoresponderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/media', mediaRoutes);

// Panggil initialize WhatsApp Service selepas io dicipta
initializeWhatsAppService(io); // <-- Boleh uncomment ini sekarang

// Logik Socket.IO sedia ada (io.on('connection', ...)) akan diuruskan dalam initializeWhatsAppService
// Jadi kita boleh komen atau buang blok io.on('connection') yang asal di sini
/* 
io.on('connection', (socket) => {
  console.log('Pengguna frontend bersambung:', socket.id);
  socket.emit('message', 'Anda telah berjaya bersambung ke pelayan WebSocket!');
  socket.on('disconnect', () => {
    console.log('Pengguna frontend terputus:', socket.id);
  });
});
*/

// Middleware Ralat (notFound dan errorHandler)
// Pastikan ini diletakkan selepas semua app.use routes
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000; // Guna port dari .env atau default 5000

// Gunakan httpServer.listen dan bukannya app.listen
httpServer.listen(PORT, () => console.log(`Pelayan (termasuk WebSocket) berjalan pada port ${PORT}`));

// Export io supaya boleh diguna di tempat lain (contoh: controller)
export { io }; 