/* * ops_engine.js - Sürüm: v3.4.8
 * Hasbi Erdoğmuş | 2. Görev: Sırt Analizi & Dinamik İpucu
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- GÖREV BAZLI İPUCU HAVUZLARI ---
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

function logBox(message, type = "") {
    if (!terminal) return;
    const div = document.createElement('div');
    div.className = `terminal-msg ${type}`;
    div.innerHTML = `> ${message}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

// --- HAFIZA VE CANLI SENKRONİZASYON ---
function initOperation() {
    if (!teamName) return;
    
    update(scoreRef, { durum: "Bağlantı Kuruldu" });

    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        
        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev}. Görev ${bolge} Bölgesi`;

        // Harita Güncelleme (soru1.jpg, soru2.jpg...)
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            mapImg.src = `assets/img/soru${gorev}.jpg`;
        }

        // Yıldızlar
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

// --- DİNAMİK İPUCU SİSTEMİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0;
    const gorevNo = data.gorevNo || 1;
    const activeHints = hint_library[gorevNo] || [];

    if (count === 0) {
        logBox(activeHints[0], "hint");
        await update(scoreRef, { ipucuSayisi: 1, durum: "Kılavuz Kontrolü" });
    } else if (count < activeHints.length) {
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        await update(scoreRef, {
            puan: newScore,
            ipucuSayisi: count + 1,
            durum: `G${gorevNo}-İpucu #${count} Kullanıldı`
        });
        logBox(`[İPUCU #${count}]: ${activeHints[count]}`, "hint");
    } else {
        logBox("Bu bölge için tüm veri paketleri kullanıldı.", "warning");
    }
});

// --- ONAYLA (CEVAP KONTROL) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const rawInput = document.getElementById('kripto-val').value.trim().toLocaleLowerCase('tr');
    const snap = await get(scoreRef);
    const data = snap.val();
    const currentGorev = data.gorevNo || 1;

    // --- GÖREV 1: 360000 ---
    if (currentGorev === 1 && rawInput === "360000") {
        await update(scoreRef, {
            gorevNo: 2, bolge: "2B", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logBox("BAŞARILI! 1. Görev tamamlandı. 2. Görev: 2B Bölgesi aktif.", "success");
        logBox("[MERKEZ]: Haritada kalın çizgi ile gösterilen yerlerde hangi yeryüzü şekli bulunmaktadır?", "");
    } 
    // --- GÖREV 2: Sırt ---
    else if (currentGorev === 2 && rawInput === "sırt") {
        await update(scoreRef, {
            gorevNo: 3, bolge: "2C", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logBox("MUHTEŞEM ANALİZ! 2B bölgesi temizlendi. 3. Görev 2C Bölgesi aktif.", "success");
    } 
    else {
        // Hatalı Giriş ve Karargah Desteği
        if (data.ipucuSayisi >= 4) {
            await update(scoreRef, { durum: `${currentGorev}. Görevi Yapamadı! Destek Bekleniyor.` });
            logBox("ANALİZ BAŞARISIZ: Karargâh desteği bekleniyor!", "warning");
        } else {
            await update(scoreRef, { durum: "Hatalı Giriş" });
            logBox("HATA: Gönderilen analiz verisi geçersiz.", "warning");
        }
    }
    document.getElementById('kripto-val').value = "";
});