/* * ops_engine.js - Sürüm: v3.4.9
 * Hasbi Erdoğmuş | 2. Görev (Sırt) Entegrasyonu & Tam Hafıza Modülü
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- GÖREV BAZLI İPUCU KÜTÜPHANESİ ---
const hint_library = {
    1: [
        "Saha kılavuzunu dikkatlice oku.",
        "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
        "Deniz kıyı çizgisi ile kıyıdan itibaren ilk izohips eğrisi arasındaki fark eküidistans değeridir.",
        "Birbirini çevrelemeyen komşu iki izohipsin yükselti değeri aynıdır. Yükselti farkı 200m. (Yükseklik = İzohips Sayısı x 200)"
    ],
    2: [
        "Saha kılavuzunu dikkatlice okudun mu?",
        "Eğrilerin, yükseltinin azaldığı yöne doğru yaptığı büklümlerdir.",
        "Ucu dışarı doğru bakan 'V' şeklindedirler.",
        "Bilgisayar başında çok fazla oturduğun zaman omurganın en çok neresi ağrır?"
    ]
};

// --- YARDIMCI: KUTULU MESAJ MOTORU ---
function logBox(message, type = "") {
    if (!terminal) return;
    const div = document.createElement('div');
    div.className = `terminal-msg ${type}`;
    div.innerHTML = `> ${message}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

// --- BAĞLANTI VE HAFIZA SİSTEMİ (Sayfa yenilense de kaldığı yerden devam eder) ---
function initOperation() {
    if (!teamName) return;
    
    // İlk bağlantı sinyali
    update(scoreRef, { durum: "Bağlantı Kuruldu" });

    // Sayfa yüklendiğinde/yenilendiğinde Firebase'den durumu oku
    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Puan ve Bölge Bilgisi Güncelleme
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        
        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev}. Görev ${bolge} Bölgesi`;

        // RESİM GÜNCELLEME: Mevcut görev neyse o resmi (.jpg) yükle
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            mapImg.src = `assets/img/soru${gorev}.jpg`;
        }

        // Yıldız Boyama Mantığı (3, 6, 9, 10)
        const stars = document.querySelectorAll('.star');
        stars.forEach((star, i) => {
            star.classList.remove('filled');
            if (gorev >= 3 && i === 0) star.classList.add('filled');
            if (gorev >= 6 && i <= 1) star.classList.add('filled');
            if (gorev >= 9 && i <= 2) star.classList.add('filled');
            if (gorev >= 10 && i <= 3) star.classList.add('filled');
        });
    });
}

initOperation();

// --- İPUCU TALEBİ VE CEZA SİSTEMİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0;
    const currentGorev = data.gorevNo || 1;
    const activeHints = hint_library[currentGorev] || [];

    if (count === 0) {
        // İLK BASIŞ: Bilgilendirme (Puan düşmez)
        logBox(activeHints[0], "hint");
        await update(scoreRef, { ipucuSayisi: 1, durum: "Kılavuz Kontrol Edildi" });
    } else if (count < activeHints.length) {
        // SONRAKİ BASIŞLAR: Numaralı İpuçları (-50 Puan)
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        await update(scoreRef, {
            puan: newScore,
            ipucuSayisi: count + 1,
            durum: `G${currentGorev}-İpucu #${count} Kullanıldı`
        });
        logBox(`[İPUCU #${count}]: ${activeHints[count]}`, "hint");
    } else {
        logBox("Bu bölge için tüm ipuçları kullanıldı.", "warning");
    }
});

// --- ONAYLA (DOĞRULAMA MOTORU) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const rawInput = document.getElementById('kripto-val').value.trim().toLocaleLowerCase('tr');
    const snap = await get(scoreRef);
    const data = snap.val();
    
    const currentGorev = data.gorevNo || 1;

    // --- GÖREV 1: 360000 (Sayısal Giriş) ---
    if (currentGorev === 1 && Number(rawInput) === 360000) {
        await update(scoreRef, {
            gorevNo: 2, bolge: "2B", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logBox("BAŞARILI! Veri doğrulandı. 2. Görev 2B Bölgesi aktif.", "success");
        logBox("[MERKEZ]: Haritada kalın çizgi ile gösterilen yerlerde hangi yeryüzü şekli bulunmaktadır?", "");
    } 
    // --- GÖREV 2: Sırt (Metin Girişi) ---
    else if (currentGorev === 2 && rawInput === "sırt") {
        await update(scoreRef, {
            gorevNo: 3, bolge: "2C", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logBox("MUHTEŞEM ANALİZ! 2B bölgesi temizlendi. 3. Görev 2C Bölgesi aktif.", "success");
    }
    else {
        if (data.ipucuSayisi >= 4) {
            await update(scoreRef, { durum: `${currentGorev}. Soruyu Doğru Cevaplayamadı!` });
            logBox("ANALİZ BAŞARISIZ: Karargâh desteği bekleniyor!", "warning");
        } else {
            await update(scoreRef, { durum: "Hatalı Giriş" });
            logBox("HATA: Gönderilen analiz verisi geçersiz.", "warning");
        }
    }
    document.getElementById('kripto-val').value = "";
});

// --- BAŞLANGIÇ MESAJLARI ---
terminal.innerHTML = ""; 
logBox("[SİSTEM]: Bağlantı güvenli değil.", "warning");
logBox("[MERKEZ]: Haritadaki konumun yükseltisini tespit et ve Analist Girişi'ne ilet.", "");
logBox("<span style='color:#ff3e3e; font-weight:bold;'>DİKKAT:</span> Verileri şifrelemek için yükselti değerinin karesini (h²) girmelisin!", "warning");