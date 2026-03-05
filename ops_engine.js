/* * ops_engine.js - Sürüm: v3.4.5
 * Hasbi Erdoğmuş | Tam Otomatik Hafıza ve Kutu Mesaj Sistemi
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

const geo_hints = [
    "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
    "Deniz kıyı çizgisi ile kıyıdan itibaren ilk izohips eğrisi arasındaki fark eküidistans değeridir.",
    "Birbirini çevrelemeyen komşu iki izohipsin yükselti değeri aynıdır. Yükselti farkı 200m. Kıyıdan itibaren izohipsleri say: (Yükseklik = İzohips Sayısı x 200)"
];

// --- MESAJ KUTUSU OLUŞTURUCU ---
function logBox(message, type = "") {
    if (!terminal) return;
    const div = document.createElement('div');
    div.className = `terminal-msg ${type}`;
    div.innerHTML = `> ${message}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

// --- BAĞLANTI VE HAFIZA SİSTEMİ ---
function initOperation() {
    if (!teamName) return;
    
    // İlk bağlantı sinyali
    update(scoreRef, { durum: "Bağlantı Kuruldu" });

    // Sayfa yüklendiğinde/yenilendiğinde Firebase'den durumu oku
    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Puan ve Bölge Güncelleme
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        
        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev}. Görev ${bolge} Bölgesi`;

        // SORU RESMİNİ GÜNCELLE (.jpg formatında)
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            mapImg.src = `assets/img/soru${gorev}.jpg`;
        }

        // Yıldızları Boya
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

// --- İPUCU TALEBİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0;

    if (count === 0) {
        logBox("Saha kılavuzunu dikkatlice okudun mu?", "hint");
        await update(scoreRef, { ipucuSayisi: 1, durum: "Kılavuz Kontrol Edildi" });
    } else if (count <= geo_hints.length) {
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        await update(scoreRef, {
            puan: newScore,
            ipucuSayisi: count + 1,
            durum: `İpucu #${count} Kullanıldı`
        });
        logBox(`[İPUCU #${count}]: ${geo_hints[count - 1]}`, "hint");
    } else {
        logBox("Bu bölge için tüm ipuçları kullanıldı.", "warning");
    }
});

// --- ONAYLA (h² Kriptosu) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const input = document.getElementById('kripto-val').value.trim();
    const snap = await get(scoreRef);
    const data = snap.val();
    
    // Örn: Görev 1 (2A) Doğrulama
    if ((data.gorevNo === 1 || data.bolge === "2A") && input === "40000") {
        await update(scoreRef, {
            gorevNo: 2, bolge: "2B", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logBox("BAŞARILI! Veri doğrulandı. 2. Görev 2B Bölgesi aktif.", "success");
    } else {
        if (data.ipucuSayisi >= 4) {
            await update(scoreRef, { durum: "Destek Bekleniyor!" });
            logBox("ANALİZ BAŞARISIZ: Karargâh desteği talep edildi!", "warning");
        } else {
            await update(scoreRef, { durum: "Hatalı Giriş" });
            logBox("HATA: Gönderilen kripto geçersiz.", "warning");
        }
    }
    document.getElementById('kripto-val').value = "";
});

// Başlangıç Mesajları
logBox("[SİSTEM]: Bağlantı güvenli değil.", "warning");
logBox("[MERKEZ]: Haritadaki konumun yükseltisini tespit et ve Analist Girişi'ne ilet.", "");
logBox("<span style='color:#ff3e3e; font-weight:bold;'>DİKKAT:</span> Verileri şifrelemek için yükselti değerinin karesini (h²) almalısın!", "warning");