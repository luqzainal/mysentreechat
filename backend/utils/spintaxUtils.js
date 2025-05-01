// Fungsi utama untuk memproses string spintax
function processSpintax(text) {
    // Cari corak spintax terdalam dahulu menggunakan regex
    const pattern = /\{([^{}]*?)\}/;
    let match;

    // Selagi ada corak spintax ditemukan
    while ((match = pattern.exec(text)) !== null) {
        // Dapatkan bahagian dalam kurungan kerinting
        const segment = match[1];
        // Pecahkan kepada pilihan berdasarkan paip '|'
        const choices = segment.split('|');
        // Pilih satu pilihan secara rawak
        const randomChoice = choices[Math.floor(Math.random() * choices.length)];
        // Gantikan corak spintax dengan pilihan rawak dalam teks asal
        text = text.replace(match[0], randomChoice);
    }

    // Kembalikan teks yang telah diproses
    return text;
}

// Eksport fungsi supaya boleh diguna di tempat lain
export { processSpintax }; 