#!/bin/bash

echo "===== MEMULAKAN PROSES DEPLOY PRODUCTION ====="
echo "Domain Target: https://chatbot.kuasaplus.com"

# Sila gantikan dengan emel anda untuk Certbot
CERTBOT_EMAIL="ganti_dengan_emel_anda@example.com"

PROJECT_DIR_NAME="mysentreechat"
REPO_URL="https://github.com/luqzainal/mysentreechat.git"

# 1. Semak dan pasang Git jika belum ada
echo ""
echo "LANGKAH 1: Memeriksa dan memasang Git..."
if ! command -v git &> /dev/null; then
    echo "Git tidak dijumpai. Memasang Git..."
    sudo apt-get update
    sudo apt-get install -y git
    if [ $? -ne 0 ]; then
        echo "Ralat: Gagal memasang Git."
        exit 1
    fi
    echo "Git berjaya dipasang."
else
    echo "Git sudah terpasang."
fi

# 2. Semak dan pasang Node.js dan NPM jika belum ada
echo ""
echo "LANGKAH 2: Memeriksa Node.js dan NPM..."
if ! command -v npm &> /dev/null; then
    echo "NPM tidak dijumpai. Sila pasang Node.js dan NPM terlebih dahulu."
    echo "Anda boleh lawati https://nodejs.org/ untuk arahan pemasangan."
    exit 1
else
    echo "Node.js dan NPM sudah terpasang."
fi

# 3. Clone repositori atau tarik perubahan terkini
echo ""
echo "LANGKAH 3: Menguruskan repositori projek..."
if [[ "$(basename "$PWD")" == "$PROJECT_DIR_NAME" ]]; then
    echo "Sudah berada dalam direktori projek '$PROJECT_DIR_NAME'. Menarik perubahan terkini..."
    git pull
    if [ $? -ne 0 ]; then
        echo "Ralat: Gagal menarik perubahan dari Git."
        exit 1
    fi
elif [ -d "$PROJECT_DIR_NAME" ]; then
    echo "Direktori projek '$PROJECT_DIR_NAME' sudah wujud. Masuk dan menarik perubahan terkini..."
    cd "$PROJECT_DIR_NAME"
    git pull
    if [ $? -ne 0 ]; then
        echo "Ralat: Gagal menarik perubahan dari Git."
        exit 1
    fi
else
    echo "Direktori projek '$PROJECT_DIR_NAME' tidak dijumpai. Mengklon repositori..."
    git clone "$REPO_URL" "$PROJECT_DIR_NAME"
    if [ $? -ne 0 ]; then
        echo "Ralat: Gagal mengklon repositori."
        exit 1
    fi
    cd "$PROJECT_DIR_NAME"
fi
echo "Repositori sedia."

# 4. Pindah ke direktori frontend dan cipta fail .env.production
echo ""
echo "LANGKAH 4: Menyediakan persekitaran frontend..."
cd frontend

echo "Mencipta fail .env.production..."
cat <<EOL > .env.production
VITE_APP_NAME="Waziper"
VITE_APP_URL="https://chatbot.kuasaplus.com"
VITE_API_URL="https://chatbot.kuasaplus.com"
EOL
echo ".env.production berjaya dicipta."

# 5. Memasang dependencies frontend
echo ""
echo "LANGKAH 5: Memasang dependencies frontend..."
npm install
if [ $? -ne 0 ]; then
    echo "Ralat: Gagal memasang dependencies frontend."
    exit 1
fi
echo "Dependencies frontend berjaya dipasang."

# 6. Membina aplikasi frontend untuk production
echo ""
echo "LANGKAH 6: Membina aplikasi frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "Ralat: Gagal membina aplikasi frontend."
    exit 1
fi
echo "Aplikasi frontend berjaya dibina. Fail output di folder 'dist'."

# 7. Memasang 'serve' secara global
echo ""
echo "LANGKAH 7: Memasang 'serve' untuk hosting..."
sudo npm install -g serve
if [ $? -ne 0 ]; then
    echo "Ralat: Gagal memasang 'serve'."
    exit 1
fi
echo "'serve' berjaya dipasang."

# 8. Konfigurasi SSL dengan Certbot
echo ""
echo "LANGKAH 8: Mengkonfigurasi SSL dengan Certbot..."
DOMAIN="chatbot.kuasaplus.com"
SSL_CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
SSL_KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

if [ ! -f "$SSL_CERT_PATH" ] || [ ! -f "$SSL_KEY_PATH" ]; then
    echo "Sijil SSL untuk $DOMAIN tidak dijumpai."
    echo "Memasang Certbot dan cuba mendapatkan sijil..."
    if ! command -v certbot &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx # atau guna plugin lain jika bukan nginx
    fi
    
    echo "Sila pastikan domain $DOMAIN telah dihalakan ke IP server ini."
    echo "Pastikan juga tiada server lain berjalan di port 80 buat sementara waktu."
    sudo certbot certonly --standalone -d "$DOMAIN" --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email -n
    
    if [ $? -ne 0 ]; then
        echo "Ralat: Gagal mendapatkan sijil SSL dari Certbot."
        echo "Sila semak log Certbot untuk maklumat lanjut."
        exit 1
    fi
    echo "Sijil SSL berjaya diperolehi."
else
    echo "Sijil SSL untuk $DOMAIN sudah wujud."
fi

# 9. Menjalankan aplikasi menggunakan 'serve' dengan SSL
echo ""
echo "LANGKAH 9: Menjalankan aplikasi..."
echo "Aplikasi akan berjalan di https://$DOMAIN"
echo "Sila pastikan port 80 (untuk HTTP ke HTTPS redirect jika ada) dan 443 (untuk HTTPS) dibuka di firewall anda."
echo "Tekan Ctrl+C untuk berhenti."

# 'serve' akan dijalankan dari dalam direktori 'frontend', jadi 'dist' adalah relatif
sudo serve -s dist -l 443 --ssl-cert "$SSL_CERT_PATH" --ssl-key "$SSL_KEY_PATH" --no-clipboard -n

echo "Skrip selesai." 