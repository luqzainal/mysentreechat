#!/bin/bash

echo "===== MEMULAKAN PROSES DEPLOY ====="

echo "1. Menginstall git jika belum ada..."
if ! command -v git &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y git
fi

echo "2. Clone repository..."
if [ ! -d "mysentreechat" ]; then
    git clone https://github.com/luqzainal/mysentreechat.git
fi

cd mysentreechat

echo "3. Memasang dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "Ralat: Gagal memasang dependencies"
    exit 1
fi

echo "4. Membina aplikasi untuk production..."
npm run build
if [ $? -ne 0 ]; then
    echo "Ralat: Gagal membina aplikasi"
    exit 1
fi

echo "5. Memasang serve untuk menjalankan aplikasi..."
npm install -g serve
if [ $? -ne 0 ]; then
    echo "Ralat: Gagal memasang serve"
    exit 1
fi

echo "6. Memastikan folder SSL certificate wujud..."
if [ ! -d "/etc/letsencrypt/live/chatbot.kuasaplus.com" ]; then
    echo "Memasang certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
    sudo certbot certonly --standalone -d chatbot.kuasaplus.com
fi

echo "7. Menjalankan aplikasi..."
echo "Aplikasi akan berjalan di https://chatbot.kuasaplus.com"
echo "Tekan Ctrl+C untuk berhenti"

# Jalankan serve dengan SSL
sudo serve -s dist -l 80 --ssl-cert /etc/letsencrypt/live/chatbot.kuasaplus.com/fullchain.pem --ssl-key /etc/letsencrypt/live/chatbot.kuasaplus.com/privkey.pem 