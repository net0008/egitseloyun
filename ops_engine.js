/* * ops_engine.js - Sürüm: v3.4.6
 * Hasbi Erdoğmuş | 1. Görev Güncel Cevap: 360000
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// Resmi Coğrafya İpuçları
const geo_hints = [
    "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
    "Deniz kıyı çizgisi ile kıyıdan itibaren ilk izohips eğrisi arasındaki fark eküidistans değeridir.",
    "Birbirini çevrelemeyen komşu iki izohipsin yükselti değeri aynıdır. Yükselti farkı 200m. Kıyıdan itibaren izohipsleri say: (Yükseklik = İzohips Sayısı x 200)"
];

// --- YARDIMCI: KUTULU MESAJ MOTORU ---
function logBox(message, type = "") {
    if (!terminal) return;
    const div = document.createElement('div');
    div.className = `terminal-msg ${type}`;
    div.innerHTML = `> ${message}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

// --- BAĞLANTI VE HAFIZA SİSTEMİ (Sayfa yenilense de devam eder) ---
function initOperation() {
    if (!teamName) return;
    
    update(scoreRef, { durum: "Bağlantı Kuruldu" });

    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Arayüzü Veritabanına Göre Güncelle
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        
        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev}. Görev ${bolge} Bölgesi`;

        // RESİM HAFIZASI: Mevcut göreve göre soru resmini yükle
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            mapImg.src = `assets/img/soru${gorev}.jpg`;
        }

        // Yıldız Boyama Mantığı
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

// --- ONAYLA (Güncellenmiş Cevap: 600^2 = 360000) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const input = document.getElementById('kripto-val').value.trim();
    const snap = await get(scoreRef);
    const data = snap.val();
    
    // 1. GÖREV ANALİZİ: Yükseklik 600m -> Karesi 360000
    if ((data.gorevNo === 1 || data.bolge === "2A") && input === "360000") {
        await update(scoreRef, {
            gorevNo: 2, bolge: "2B", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logBox("BAŞARILI! Veri doğrulandı. 2. Görev 2B Bölgesi aktif.", "success");
    } else {
        if (data.ipucuSayisi >= 4) {
            await update(scoreRef, { durum: "3. Soruyu Doğru Cevaplayamadı!" });
            logBox("ANALİZ BAŞARISIZ: Karargâh desteği bekleniyor!", "warning");
        } else {
            await update(scoreRef, { durum: "Hatalı Giriş" });
            logBox("HATA: Gönderilen kripto geçersiz.", "warning");
        }
    }
    document.getElementById('kripto-val').value = "";
});

// Terminal Başlangıç Mesajları
terminal.innerHTML = ""; 
logBox("[SİSTEM]: Bağlantı güvenli değil.", "warning");
logBox("[MERKEZ]: Haritadaki konumun yükseltisini tespit et ve Analist Girişi'ne ilet.", "");
logBox("<span style='color:#ff3e3e; font-weight:bold;'>DİKKAT:</span> Verileri şifrelemek için yükselti değerinin karesini (h²) almalısın!", "warning");