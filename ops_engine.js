/* * ops_engine.js - Sürüm: v3.3.6 (Tam Senkronizasyon)
 * Hasbi Erdoğmuş | Garantili Bağlantı ve H² Protokolü
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// Görev 1 İpuçları (Senin istediğin sıra)
const hints_task1 = [
    "Saha kılavuzunu dikkatlice oku.",
    "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
    "Deniz kıyı çizgisi ile kıyıdan itibaren ilk izohips eğrisi arasındaki fark eküidistans değeridir. Yani yükselti farkıdır.",
    "Birbirini çevrelemeyen komşu iki izohipsin yükselti değeri aynıdır. Yükselti farkı 200m. Kıyıdan itibaren izohipsleri say. (Yükseklik = İzohips Sayısı x 200)"
];

// --- KRİTİK: BAĞLANTIYI MÜHÜRLE (Retry Mekanizması) ---
function connectWithRetry() {
    if (!teamName) return;
    update(scoreRef, { durum: "Bağlantı Kuruldu" })
        .then(() => console.log("Karargâh Bağlantısı Onaylandı."))
        .catch(() => {
            console.log("Bağlantı bekleniyor...");
            setTimeout(connectWithRetry, 2000); 
        });
}
setTimeout(connectWithRetry, 1000);

// Canlı Veri Takibi (Yıldız ve Puan)
onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    
    document.getElementById('current-score').innerText = data.puan || 1000;
    
    // Eski/Yeni veri yapısı uyumluluğu
    const currentTask = data.gorevNo || 1;
    const currentRegion = data.bolge || data.sektor || "2A";
    document.getElementById('current-sector').innerText = `${currentTask}. Görev ${currentRegion} Bölgesi`;
    
    // Yıldız Boyama (3, 6, 9, 10)
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, i) => {
        star.classList.remove('filled');
        if (currentTask >= 3 && i === 0) star.classList.add('filled');
        if (currentTask >= 6 && i <= 1) star.classList.add('filled');
        if (currentTask >= 9 && i <= 2) star.classList.add('filled');
        if (currentTask >= 10 && i <= 3) star.classList.add('filled');
    });
});

// İPUCU TALEBİ (-50 PUAN)
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const currentIdx = data.ipucuSayisi || 0;

    if (currentIdx < hints_task1.length) {
        await update(scoreRef, {
            puan: Math.max(0, data.puan - 50),
            ipucuSayisi: currentIdx + 1,
            durum: `${currentIdx + 1}. İpucu Kullanıldı`
        });
        logTerminal(`[İPUCU]: ${hints_task1[currentIdx]}`, "info-msg");
    } else {
        logTerminal("Bu bölge için tüm ipuçları kullanıldı.", "error-msg");
    }
});

// ONAYLA (200m karesi = 40000)
document.getElementById('btn-verify').addEventListener('click', async () => {
    const input = document.getElementById('kripto-val').value.trim();
    const snap = await get(scoreRef);
    const data = snap.val();
    
    if ((data.gorevNo === 1 || data.sektor === "2A") && input === "40000") {
        await update(scoreRef, {
            gorevNo: 2, bolge: "2B", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logTerminal("BAŞARILI! 2. Görev 2B Bölgesi Aktif.", "success-msg");
        document.getElementById('active-map').src = "assets/img/soru2.png";
    } else {
        if (data.ipucuSayisi >= 4) {
            await update(scoreRef, { durum: "Destek Bekleniyor!" });
            logTerminal("ANALİZ BAŞARISIZ: Karargâh desteği talep edildi!", "error-msg");
        } else {
            await update(scoreRef, { durum: "Hatalı Giriş" });
            logTerminal("HATA: Gönderilen kripto geçersiz.", "error-msg");
        }
    }
    document.getElementById('kripto-val').value = "";
});

function logTerminal(msg, cls) {
    if(terminal) {
        terminal.innerHTML += `<p class="${cls}">> ${msg}</p>`;
        terminal.scrollTop = terminal.scrollHeight;
    }
}