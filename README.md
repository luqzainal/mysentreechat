# WAZIPER V2 - WhatsApp Marketing Tool

Aplikasi WhatsApp marketing yang lengkap dengan AI chatbot, bulk messaging, dan autoresponder.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB
- npm atau yarn

### Installation
```bash
# Install semua dependencies
npm run install:all

# Start backend server
npm run dev:backend

# Start frontend (dalam terminal baru)
npm run dev:frontend
```

## 🗑️ Database Management

### Clear Database Scripts
Script untuk membersihkan database dengan mudah:

```bash
# Clear semua collections
npm run db:clear

# List semua collections
npm run db:list

# Clear collection tertentu
npm run db:clear-collection users
npm run db:clear-collection contacts
npm run db:clear-collection campaigns

# Tunjuk bantuan
npm run db:help
```

### Windows Batch Script
```cmd
# Clear semua collections
clear-db.bat all

# List collections
clear-db.bat list

# Clear collection tertentu
clear-db.bat collection users
```

**Lihat [DATABASE_CLEAR_GUIDE.md](./DATABASE_CLEAR_GUIDE.md) untuk panduan lengkap.**

## 📁 Project Structure

```
WAZIPER V2/
├── backend/           # Node.js API server
├── frontend/          # React frontend
├── scripts/           # Utility scripts
│   ├── clear-database.js
│   └── clear-db.bat
└── server.js          # Main server file
```

## 🔧 Development

### Backend
```bash
cd backend
npm run server        # Development mode
npm start            # Production mode
```

### Frontend
```bash
cd frontend
npm run dev          # Development mode
npm run build        # Production build
```

## 📚 Documentation

- [Database Clear Guide](./DATABASE_CLEAR_GUIDE.md)
- [401 Error Solution](./PENYELESAIAN_401_ERROR.md)

## 🛠️ Troubleshooting

### 401 Authentication Error
Jika mengalami error 401, lihat [PENYELESAIAN_401_ERROR.md](./PENYELESAIAN_401_ERROR.md)

### Database Issues
- Pastikan MongoDB berjalan
- Check connection string dalam `backend/.env`
- Guna script clear database jika perlu reset

## 📄 License

ISC License
