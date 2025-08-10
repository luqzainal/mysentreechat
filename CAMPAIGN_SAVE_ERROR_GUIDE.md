# 🔧 Panduan Penyelesaian Masalah "Save failed" dalam AddCampaignPage

## Masalah Yang Ditemui
Error "Save failed: AxiosError" ketika cuba menyimpan campaign baru dalam AddCampaignPage.jsx.

## Punca Masalah Yang Mungkin

### 1. **Server Backend Tidak Berjalan**
- Server backend tidak berjalan pada port 5000
- Connection timeout atau network error

### 2. **Authentication Error (401)**
- Token JWT tidak sah atau tamat tempoh
- User tidak log masuk dengan betul

### 3. **Validation Error (400)**
- Data yang dihantar tidak lengkap atau tidak sah
- Required fields tidak diisi

### 4. **MediaAttachments Array Error**
- Format array mediaAttachments tidak betul
- Media ID tidak wujud atau tidak milik user

### 5. **Device Access Error (404)**
- Device ID tidak wujud atau tidak milik user
- Device tidak disambung dengan betul

## Penyelesaian Yang Telah Dilaksanakan

### 1. **Tambah Debugging Logs**
Ditambah console.log dalam AddCampaignPage.jsx untuk debug:
```javascript
// Log data yang akan dihantar
console.log('API URL:', apiUrlPath);
console.log('FormData contents:');
for (let [key, value] of dataPayload.entries()) {
  console.log(`${key}:`, value);
}
```

### 2. **Perbaiki MediaAttachments Handling**
Diperbaiki cara array mediaAttachments dihantar:
```javascript
// Sebelum (salah)
dataPayload.append('mediaAttachments[]', item._id);

// Selepas (betul)
dataPayload.append('mediaAttachments', item._id);
```

### 3. **Perbaiki Backend Media Processing**
Diperbaiki backend untuk handle pelbagai format mediaAttachments:
```javascript
// Handle different formats of mediaAttachments
if (Array.isArray(mediaAttachments)) {
    mediaIds = mediaAttachments;
} else if (typeof mediaAttachments === 'string') {
    try {
        mediaIds = JSON.parse(mediaAttachments);
    } catch (e) {
        mediaIds = [mediaAttachments];
    }
}
```

## Langkah-Langkah Debugging

### 1. **Check Server Status**
```bash
# Pastikan server backend berjalan
cd backend
npm run server

# Test API endpoint
curl http://localhost:5000/api/campaigns/test
```

### 2. **Check Browser Console**
1. Buka Developer Tools (F12)
2. Pergi ke tab Console
3. Cuba save campaign
4. Periksa error messages dan logs

### 3. **Check Network Tab**
1. Buka Developer Tools (F12)
2. Pergi ke tab Network
3. Cuba save campaign
4. Periksa request dan response

### 4. **Test API Secara Langsung**
```bash
# Test campaign API
npm run test:campaign-api
```

## Troubleshooting Berdasarkan Error

### Error 401 (Unauthorized)
```bash
# Check authentication
1. Pastikan user sudah log masuk
2. Check localStorage untuk token
3. Restart browser jika perlu
```

### Error 400 (Bad Request)
```bash
# Check required fields
1. Campaign name - required
2. Device ID - required
3. Contact Group ID - required untuk bulk campaign
4. Campaign Type - required
```

### Error 404 (Not Found)
```bash
# Check device access
1. Pastikan device sudah disambung
2. Check device ID dalam URL
3. Pastikan device milik user yang log masuk
```

### Error 500 (Server Error)
```bash
# Check server logs
1. Lihat console backend
2. Check database connection
3. Check file upload permissions
```

## Contoh Data Yang Betul

### Bulk Campaign
```javascript
const formData = new FormData();
formData.append('campaignName', 'Test Campaign');
formData.append('campaignType', 'bulk');
formData.append('contactGroupId', 'group-id');
formData.append('statusEnabled', 'true');
formData.append('enableLink', 'false');
formData.append('useAI', 'false');
formData.append('caption', 'Test message');
```

### AI Chatbot Campaign
```javascript
const formData = new FormData();
formData.append('campaignName', 'AI Test Campaign');
formData.append('campaignType', 'ai_chatbot');
formData.append('statusEnabled', 'true');
formData.append('useAI', 'true');
formData.append('aiAgentTraining', 'Test training data');
```

## Langkah-Langkah Seterusnya

### 1. **Test dengan Data Minimal**
1. Cuba create campaign dengan data minimal
2. Pastikan semua required fields diisi
3. Test tanpa media attachments dahulu

### 2. **Test Media Upload**
1. Cuba upload media file
2. Test dengan media dari library
3. Test tanpa media

### 3. **Test Different Campaign Types**
1. Test bulk campaign
2. Test AI chatbot campaign
3. Test edit existing campaign

## Nota Penting

- **Backup data** sebelum test
- **Check server logs** untuk error details
- **Test dalam development environment** dahulu
- **Monitor network requests** untuk debugging

## Fail Yang Diubah

1. `frontend/src/pages/AddCampaignPage.jsx` - Tambah debugging logs
2. `backend/routes/campaignRoutes.js` - Perbaiki media handling
3. `scripts/test-campaign-api.js` - Script test API
4. `package.json` - Tambah test script

---

**Jika masalah masih berterusan, sila berikan error message yang lengkap dari browser console dan server logs.**
