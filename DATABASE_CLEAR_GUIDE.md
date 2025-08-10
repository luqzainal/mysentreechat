# 🗑️ Panduan Clear Database WAZIPER V2

Script ini membolehkan anda membersihkan database MongoDB dengan mudah dan selamat.

## 📋 Cara Penggunaan

### 1. Menggunakan NPM Scripts (Disyorkan)

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

### 2. Menggunakan Script Langsung

```bash
# Clear semua collections
node scripts/clear-database.js all

# List semua collections
node scripts/clear-database.js list

# Clear collection tertentu
node scripts/clear-database.js collection users
node scripts/clear-database.js collection contacts
```

### 3. Menggunakan Batch Script (Windows)

```cmd
# Clear semua collections
clear-db.bat all

# List semua collections
clear-db.bat list

# Clear collection tertentu
clear-db.bat collection users
clear-db.bat collection contacts
```

## 📊 Collections Yang Biasa Digunakan

### Collections Utama:
- `users` - Data pengguna dan authentication
- `contacts` - Senarai kenalan
- `contactgroups` - Kumpulan kenalan
- `campaigns` - Kempen WhatsApp
- `messages` - Mesej yang dihantar
- `whatsappdevices` - Peranti WhatsApp yang disambung
- `media` - Fail media yang diupload
- `settings` - Tetapan aplikasi

### Collections AI/Chatbot:
- `aichatbotcampaigns` - Kempen AI chatbot
- `autorespondersettings` - Tetapan autoresponder

## ⚠️ Amaran Penting

### Sebelum Clear Database:
1. **Backup data penting** - Pastikan anda ada backup jika ada data penting
2. **Stop server** - Pastikan server backend tidak berjalan
3. **Confirm action** - Script akan tanya pengesahan sebelum clear

### Selepas Clear Database:
1. **Restart server** - Start semula server backend
2. **Register user baru** - Daftar pengguna admin baru
3. **Setup semula** - Setup semula konfigurasi yang diperlukan

## 🔧 Troubleshooting

### Error "MongoDB Connection Failed"
```bash
# Pastikan MongoDB berjalan
# Windows: Check MongoDB service
# Linux/Mac: sudo systemctl start mongod
```

### Error "Permission Denied"
```bash
# Pastikan fail .env ada dalam folder backend
# Pastikan MONGO_URI betul dalam .env
```

### Error "Collection Not Found"
```bash
# Guna command list untuk tengok collections yang ada
npm run db:list
```

## 📝 Contoh Penggunaan Lengkap

### Clear Database untuk Development Baru:
```bash
# 1. Stop server
# 2. Clear semua data
npm run db:clear

# 3. Restart server
npm run dev:backend

# 4. Register user baru
# Buka browser dan daftar user admin
```

### Clear Collection Tertentu:
```bash
# Clear hanya data contacts
npm run db:clear-collection contacts

# Clear hanya data campaigns
npm run db:clear-collection campaigns

# Clear hanya data users (berhati-hati!)
npm run db:clear-collection users
```

## 🛡️ Keselamatan

- Script ini **TIDAK** akan clear database tanpa pengesahan
- Pastikan anda faham apa yang akan di-clear
- Backup data penting sebelum clear
- Test dalam environment development dahulu

## 📞 Bantuan

Jika ada masalah, check:
1. MongoDB connection string dalam `.env`
2. MongoDB service berjalan
3. Permission untuk akses database
4. Network connection ke MongoDB

---

**Nota**: Script ini direka untuk development environment. Untuk production, guna backup dan restore methods yang selamat.
