/* * ops_engine.js - Sürüm: v2.2.2
 * Güncelleme Notları:
 * - Firebase Realtime Database entegrasyonu stabilize edildi.
 * - Sektör 2A (200m^2) kripto analizi aktif.
 * - Karargah canlı takip protokolü (Bağlantı Kuruldu) eklendi.
 * - HTML ID uyumluluğu sağlandı (btn-verify, kripto-val, terminal-output).
 */

import { db, ref, onValue, update } from './assets/js/firebase-config.js';

// 1. URL'den Takım Bilgisini Oku
const params = new URLSearchParams(window.location.search);
const teamName = params.get('team') || "Bilinmeyen Birim";

// 2. Element Referansları (HTML ID'leri ile tam uyumlu)
const terminal = document.getElementById('terminal-output');
const cryptoInput = document.getElementById('kripto-val');
const verifyBtn = document.getElementById('btn-verify');
const hintBtn = document.getElementById('btn-hint');
const teamTag = document.querySelector('.panel-tag');

// 3. Puan/Sektör Referansı
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);

// --- OPERASYONEL FONKSİYONLAR ---

// BAĞLANTI BİLDİRİMİ: Sayfa açıldığı an Karargah'a sinyal gönderir.
update(scoreRef, { durum: "Bağlantı Kuruldu" });

// Canlı Veri Takibi (Puan ve Sektör güncellemeleri için)
onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const scoreEl = document.getElementById('current-score');
        const sectorEl = document.getElementById('current-sector');
        if (scoreEl) scoreEl.innerText = data.puan;
        if (sectorEl) sectorEl.innerText = data.sektor;
        if (teamTag) teamTag.innerText = `UYDU ANALİZİ: ${teamName.toUpperCase()}`;
    }
});

// Terminal Log Yardımcısı
function logMessage(msg, type = "") {
    if (!terminal) return;
    const p = document.createElement('p');
    if (type) p.className = type;
    p.innerText = `> ${msg}`;
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
}

// Görev Doğrulama (Sektör 2A: 200m karesi = 40000)
function verifyMission() {
    const inputVal = cryptoInput.value.trim();
    
    if (inputVal === "40000") {
        logMessage("[BAŞARILI]: Kripto çözüldü. İrtifa 200m onaylandı!", "success-msg");
        logMessage("Sektör 2B'ye intikal izni alındı.", "sys-msg");
        
        // Firebase'i Güncelle (Puan + Sektör + Durum)
        update(scoreRef, {
            puan: 1200, 
            sektor: "2B",
            durum: "Başarılı"
        });
        
        alert("TEBRİKLER! Bir sonraki sektöre aktarılıyorsunuz.");
    } else {
        logMessage("[HATA]: Geçersiz kod! Koordinat sapması tespit edildi.", "error-msg");
        update(scoreRef, { durum: "Hata Yapıldı" });
    }
    cryptoInput.value = "";
}

// İpucu Talebi
function getHint() {
    logMessage("[İPUCU]: En yüksek izohips çizgisinin (200m) karesini hesaplayın.", "info-msg");
    update(scoreRef, { durum: "İpucu Aldı" });
}

// --- ETKİLEŞİM BAĞLANTILARI ---
if (verifyBtn) verifyBtn.addEventListener('click', verifyMission);
if (hintBtn) hintBtn.addEventListener('click', getHint);

// Başlangıç Mesajı
logMessage(`Birim: ${teamName} terminali aktif hale getirildi.`, "sys-msg");