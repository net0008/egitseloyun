/* * ops_engine.js - Sürüm: v3.0
 * Hasbi Erdoğmuş | Coğrafya Operasyonu
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");

if (!teamName) { window.location.href = "index.html"; }

const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');
let currentTaskData = {};

// --- 1. YILDIZ MOTORU ---
function updateStars(taskNo) {
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        star.classList.remove('filled');
        if (taskNo >= 3 && index === 0) star.classList.add('filled');
        if (taskNo >= 6 && index <= 1) star.classList.add('filled');
        if (taskNo >= 9 && index <= 2) star.classList.add('filled');
        if (taskNo >= 10 && index <= 3) star.classList.add('filled');
        // 5. Yıldız Google Form sonrası manuel tetiklenecek
    });
}

// --- 2. CANLI VERİ TAKİBİ ---
onValue(scoreRef, (snapshot) => {
    currentTaskData = snapshot.val() || {};
    document.getElementById('current-score').innerText = currentTaskData.puan || 1000;
    
    // Terminoloji Güncelleme: 1. Görev 2A Bölgesi
    const taskText = `${currentTaskData.gorevNo || 1}. Görev ${currentTaskData.bolge || "2A"} Bölgesi`;
    document.getElementById('current-sector').innerText = taskText;
    
    updateStars(currentTaskData.gorevNo || 1);
});

// --- 3. İPUCU VE CEZA SİSTEMİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const newHintCount = (data.ipucuSayisi || 0) + 1;
    const newScore = Math.max(0, (data.puan || 1000) - 50);

    await update(scoreRef, {
        puan: newScore,
        ipucuSayisi: newHintCount,
        durum: `${newHintCount}. İpucu Kullanıldı`
    });

    logTerminal(`${newHintCount}. İpucu Alındı. (-50 Puan)`, "info-msg");
});

// --- 4. DOĞRULAMA VE KARARGAH YARDIMI ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const input = document.getElementById('kripto-val').value.trim();
    const snap = await get(scoreRef);
    const data = snap.val();
    
    // ÖRNEK: 1. Görev (2A Bölgesi) Kodu: 40000
    if (data.gorevNo === 1 && input === "40000") {
        await update(scoreRef, {
            gorevNo: 2,
            bolge: "2B",
            puan: data.puan + 200,
            durum: "Başarılı",
            ipucuSayisi: 0
        });
        logTerminal("BAŞARILI! 2. Görev 2B Bölgesi Aktif.", "success-msg");
    } else {
        // YANLIŞ CEVAP VE YARDIM PROTOKOLÜ
        if (data.ipucuSayisi >= 3) {
            await update(scoreRef, { 
                durum: `${data.gorevNo}. Görevi yapamadı. Destek Bekleniyor!` 
            });
            logTerminal("KRİTİK HATA: Karargah desteği talep edildi!", "error-msg");
        } else {
            await update(scoreRef, { durum: "Hatalı Analiz" });
            logTerminal("HATA: Kripto geçersiz.", "error-msg");
        }
    }
    document.getElementById('kripto-val').value = "";
});

function logTerminal(msg, cls) {
    if (!terminal) return;
    terminal.innerHTML += `<p class="${cls}">> ${msg}</p>`;
    terminal.scrollTop = terminal.scrollHeight;
}