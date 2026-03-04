/* * ops_engine.js - Sürüm: v2.2.5
 * Güncelleme: Bağlantı sinyali ve ID eşleşmeleri garanti altına alındı.
 */
import { db, ref, onValue, update } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = params.get('team');

if (!teamName) {
    alert("HATA: Takım ismi bulunamadı! Ana sayfaya yönlendiriliyorsunuz.");
    window.location.href = "index.html";
}

const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- 1. SİNYAL GÖNDER (Bu Karargah'taki durumu değiştirir) ---
update(scoreRef, { durum: "Bağlantı Kuruldu" });

// --- 2. CANLI VERİ DİNLE ---
onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan;
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = data.sektor;
    }
});

// --- 3. KRİPTO DOĞRULAMA (200^2 = 40000) ---
document.getElementById('btn-verify').addEventListener('click', () => {
    const input = document.getElementById('kripto-val').value;
    if (input === '40000') {
        update(scoreRef, { puan: 1200, sektor: "2B", durum: "Başarılı" });
        if(terminal) terminal.innerHTML += `<p style="color:#39FF14">> [SİSTEM]: Başarılı! Sektör 2B aktif.</p>`;
    } else {
        update(scoreRef, { durum: "Hatalı Giriş" });
        if(terminal) terminal.innerHTML += `<p style="color:#ff3e3e">> [HATA]: Yanlış kod!</p>`;
    }
});

// --- 4. İPUCU ---
document.getElementById('btn-hint').addEventListener('click', () => {
    update(scoreRef, { durum: "İpucu Aldı" });
    if(terminal) terminal.innerHTML += `<p style="color:#00d4ff">> [İPUCU]: En yüksek izohipsin karesini alın.</p>`;
});