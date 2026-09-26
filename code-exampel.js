
function buildDynamicQRIS(staticPayload, amount) {
    // 1. Buang Checksum (CRC) lama di ekor string. 
    // Tag 63 selalu memakan 8 karakter terakhir ('6304' + 'XXXX')
    let basePayload = staticPayload.slice(0, -8);

    // 2. Mutasi Point of Initiation (Tag 01)
    // 11 = Statis, 12 = Dinamis
    basePayload = basePayload.replace("010211", "010212");

    // 3. Konstruksi Tag 54 (Transaction Amount)
    let amountStr = amount.toString();
    let length = amountStr.length.toString().padStart(2, '0');
    let tagAmount = `54${length}${amountStr}`;

    // (Proses internal: Fungsi sorting untuk menyisipkan Tag 54 agar urut secara numerik)
    basePayload = insertTagInOrder(basePayload, "54", tagAmount);

    // 4. Rekalkulasi CRC16-CCITT (Checksum)
    basePayload += "6304"; // Tambahkan header Tag 63 dan length (04)
    let newCRC = calculateCRC16(basePayload); // Eksekusi fungsi algoritma kriptografi

    // Kembalikan string utuh yang siap dirender menjadi gambar QR Code
    return basePayload + newCRC;
}
