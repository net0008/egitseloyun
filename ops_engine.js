/* * ops_engine.js - Sürüm: v2.6.0
 * Güncelleme Notları:
 * - Bağlantı sinyali (Bağlantı Kuruldu) garanti altına alındı.
 * - URL parametrelerindeki Türkçe karakter ve boşluk hataları giderildi.
 * - Hata ayıklama logları (Console) eklendi.
 */

import { db, ref, onValue, update } from './assets/js/firebase-config.js';

// 1. URL'den Takım İsmini Güvenli Al (Decode işlemi önemli)
const params = new URLSearchParams(window.location.search);
let teamName = params.get('team');

if (!teamName) {
    console.error("KRİTİK HATA: Takım ismi URL'den okunamadı!");
    alert("HATA: Takım ismi geçersiz. Lütfen ana sayfadan tekrar giriş yapın.");
} else {
    teamName = decodeURIComponent(teamName);
    console.log(`[SİSTEM]: ${teamName} birimi için terminal başlatılıyor...`);

    const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
    const terminal = document.getElementById('terminal-output');

    // --- KRİTİK FONKSİYON: BAĞLANTI SİNYALİNİ MÜHÜRLE ---
    function sendConnectionSignal() {
        update(scoreRef, { durum: "Bağlantı Kuruldu" })
            .then(() => console.log(`[BAĞLANTI]: Karargâh'a 'Bağlantı Kuruldu' sinyali iletildi.`))
            .catch((err) => {
                console.error("[HATA]: Sinyal gönderilemedi, tekrar deneniyor...", err);
                setTimeout(sendConnectionSignal, 2000); // Hata olursa 2 saniye sonra tekrar dene
            });
    }

    // Sayfa yüklendiğinde sinyali gönder
    sendConnectionSignal();

    // 2. CANLI VERİ DİNLEME (Puan ve Sektör)
    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const scoreEl = document.getElementById('current-score');
            const sectorEl = document.getElementById('current-sector');
            if (scoreEl) scoreEl.innerText = data.puan;
            if (sectorEl) sectorEl.innerText = data.sektor;
        }
    });

    // 3. ONAYLA BUTONU (ID: btn-verify)
    const verifyBtn = document.getElementById('btn-verify');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', () => {
            const inputVal = document.getElementById('kripto-val').value.trim();
            if (inputVal === '40000') {
                update(scoreRef, { 
                    puan: 1200, 
                    sektor: "2B", 
                    durum: "Başarılı" 
                });
                if(terminal) terminal.innerHTML += `<p style="color:#39FF14">> [SİSTEM]: Kripto doğrulandı. Sektör 2B aktif.</p>`;
            } else {
                update(scoreRef, { durum: "Hatalı Giriş" });
                if(terminal) terminal.innerHTML += `<p style="color:#ff3e3e">> [HATA]: Yanlış kripto analizi!</p>`;
            }
            document.getElementById('kripto-val').value = "";
            terminal.scrollTop = terminal.scrollHeight;
        });
    }

    // 4. İPUCU BUTONU (ID: btn-hint)
    const hintBtn = document.getElementById('btn-hint');
    if (hintBtn) {
        hintBtn.addEventListener('click', () => {
            update(scoreRef, { durum: "İpucu Aldı" });
            if(terminal) terminal.innerHTML += `<p style="color:#00d4ff">> [İPUCU]: En yüksek izohips çizgisinin (200m) karesini hesaplayın.</p>`;
            terminal.scrollTop = terminal.scrollHeight;
        });
    }
}