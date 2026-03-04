/* * ops_engine.js - Sürüm: v2.7.0 (Mülakat Sürümü)
 * Not: Bağlantı sinyali garantili ve gecikmeli ateşleme ile güçlendirildi.
 */
import { db, ref, onValue, update } from './assets/js/firebase-config.js';

// 1. URL'den Takım İsmini TERTEMİZ Al
const params = new URLSearchParams(window.location.search);
let rawTeamName = params.get('team');

if (!rawTeamName) {
    alert("Takım seçilmedi! index.html sayfasına yönlendiriliyorsunuz.");
    window.location.href = "index.html";
}

const teamName = decodeURIComponent(rawTeamName);
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

console.log(`Birim Aktif: ${teamName}`);

// --- KRİTİK: BAĞLANTIYI GARANTİLE ---
function connectToHQ() {
    update(scoreRef, { 
        durum: "Bağlantı Kuruldu",
        zaman: new Date().toLocaleTimeString() 
    }).then(() => {
        console.log("HQ Bağlantısı Başarılı.");
    }).catch(() => {
        // Bağlanamazsa 1 saniye sonra tekrar dene
        setTimeout(connectToHQ, 1000);
    });
}

// Sayfa yüklendikten 1 saniye sonra HQ'ya sinyal çak
setTimeout(connectToHQ, 1000);

// 2. CANLI VERİ DİNLE (Puan/Sektör)
onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan;
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = data.sektor;
    }
});

// 3. ONAYLA BUTONU (200^2 = 40000)
const verifyBtn = document.getElementById('btn-verify');
if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
        const val = document.getElementById('kripto-val').value.trim();
        if (val === '40000') {
            update(scoreRef, { puan: 1200, sektor: "2B", durum: "Başarılı" });
            if(terminal) terminal.innerHTML += `<p style="color:#39FF14">> [SİSTEM]: Doğrulama Başarılı. Sektör 2B açıldı.</p>`;
        } else {
            update(scoreRef, { durum: "Hatalı Giriş" });
            if(terminal) terminal.innerHTML += `<p style="color:#ff3e3e">> [HATA]: Yanlış analiz!</p>`;
        }
        terminal.scrollTop = terminal.scrollHeight;
    });
}

// 4. İPUCU BUTONU
const hintBtn = document.getElementById('btn-hint');
if (hintBtn) {
    hintBtn.addEventListener('click', () => {
        update(scoreRef, { durum: "İpucu Aldı" });
        if(terminal) terminal.innerHTML += `<p style="color:#00d4ff">> [MERKEZ]: 200 sayısının karesini ($x^2$) hesaplayın.</p>`;
        terminal.scrollTop = terminal.scrollHeight;
    });
}