/* * ops_engine.js - Sürüm: v3.1
 * Hasbi Erdoğmuş | Coğrafya İpucu ve Yıldız Motoru
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// Görev 1 İpuçları Havuzu
const hints_task1 = [
    "Saha kılavuzunu dikkatlice oku.",
    "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
    "Deniz kıyı çizgisi ile kıyıdan itibaren ilk izohips eğrisi arasındaki fark eküidistans değeridir. Yani yükselti farkıdır.",
    "Birbirini çevrelemeyen komşu iki izohipsin yükselti değeri aynıdır. Yükselti farkı 200m. Kıyıdan itibaren izohipsleri say. (Yükseklik = İzohips Sayısı x 200)"
];

// Yıldızları Görev Numarasına Göre Boya
function updateStars(taskNo) {
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        star.classList.remove('filled');
        if (taskNo >= 3 && index === 0) star.classList.add('filled');
        if (taskNo >= 6 && index <= 1) star.classList.add('filled');
        if (taskNo >= 9 && index <= 2) star.classList.add('filled');
        if (taskNo >= 10 && index <= 3) star.classList.add('filled');
    });
}

// Canlı Veri Dinleme
onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    document.getElementById('current-score').innerText = data.puan;
    document.getElementById('current-sector').innerText = `${data.gorevNo || 1}. Görev ${data.bolge || "2A"} Bölgesi`;
    updateStars(data.gorevNo || 1);
});

// İPUCU TALEBİ VE CEZA MANTIĞI
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const currentIdx = data.ipucuSayisi || 0;

    if (currentIdx < hints_task1.length) {
        const nextHint = hints_task1[currentIdx];
        const newScore = Math.max(0, data.puan - 50);

        await update(scoreRef, {
            puan: newScore,
            ipucuSayisi: currentIdx + 1,
            durum: `${currentIdx + 1}. İpucu Kullanıldı`
        });

        logTerminal(`[İPUCU]: ${nextHint}`, "info-msg");
    } else {
        logTerminal("Mevcut bölge için tüm ipuçları kullanıldı.", "error-msg");
    }
});

// ONAYLA BUTONU
document.getElementById('btn-verify').addEventListener('click', async () => {
    const input = document.getElementById('kripto-val').value.trim();
    const snap = await get(scoreRef);
    const data = snap.val();
    
    // GÖREV 1 DOĞRULAMA (200m karesi = 40000)
    if (data.gorevNo === 1 && input === "40000") {
        await update(scoreRef, {
            gorevNo: 2, bolge: "2B", puan: data.puan + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logTerminal("BAŞARILI! 2. Görev 2B Bölgesi Aktif.", "success-msg");
        document.getElementById('active-map').src = "assets/img/soru2.png";
    } else {
        // 3. Coğrafya İpucundan Sonra Bilemezse (Toplam 4 tıklama)
        if (data.ipucuSayisi >= 4) {
            await update(scoreRef, { durum: "Destek Bekleniyor!" });
            logTerminal("KRİTİK HATA: Analiz başarısız. Karargâh desteği bekleniyor.", "error-msg");
        } else {
            await update(scoreRef, { durum: "Hatalı Analiz" });
            logTerminal("HATA: Kripto geçersiz. Tekrar deneyin.", "error-msg");
        }
    }
    document.getElementById('kripto-val').value = "";
});

function logTerminal(msg, cls) {
    terminal.innerHTML += `<p class="${cls}">> ${msg}</p>`;
    terminal.scrollTop = terminal.scrollHeight;
}