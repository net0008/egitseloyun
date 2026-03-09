/* *****************************************************************************
 * ops_engine.js - Sürüm: v3.5.24                                              *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Görev 1-10 Tam Entegrasyon | Bergama-Dikili Final Raporu & AI Motoru       *
 * *************************************************************************** *
 * Bu modül, Firebase Realtime Database üzerinden saha ve karargah arasındaki *
 * senkronizasyonu yönetir. Hata ve İpucu sayıları anlık olarak mühürlenir.   *
 * *************************************************************************** */

import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

// --- 0. BAĞLANTI PARAMETRELERİ VE SABİTLER ---
// URL üzerinden gelen takım ismini yakalayarak veri tünelini aktif eder.
const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- 1. İÇERİK YÖNETİMİ (CMS ENTEGRASYONU) ---
// Sorular ve İpuçları artık Firebase 'gameContent/missions' düğümünden çekiliyor.
let globalMissionData = {};

onValue(ref(db, 'gameContent/missions'), (snapshot) => {
    if (snapshot.exists()) {
        globalMissionData = snapshot.val();
        console.log("[CMS]: Oyun içeriği güncellendi.");
        // Eğer sayfa açıksa ve veri geldiyse brifingi yenilemek gerekebilir
        // Ancak initOperation içindeki akış bunu zaten yönetecektir.
    }
});

// --- 2. TERMİNAL VE HAFIZA YÖNETİMİ ---
function saveTerminal() { 
    if (teamName && terminal) sessionStorage.setItem(`log_${teamName}`, terminal.innerHTML); 
}

function loadTerminal() { 
    const saved = sessionStorage.getItem(`log_${teamName}`);
    if (saved && terminal) {
        terminal.innerHTML = saved;
        terminal.scrollTop = terminal.scrollHeight;
    }
}

function logBox(message, type = "") {
    if (!terminal) return;
    const div = document.createElement('div');
    div.className = `terminal-msg ${type}`;
    div.innerHTML = `> ${message}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
    saveTerminal();
}

// --- 3. ÖZEL GÖREV FONKSİYONLARI (GÖREV 10 & AI MOTORU) ---
window.executeAIAnaliz = async function() {
    const aiInput = document.getElementById('ai-coord-input');
    const coordData = aiInput ? aiInput.value.trim() : "";
    const snap = await get(scoreRef);
    const data = snap.val();

    // Referans Koordinatlar: Bergama-Dikili Hattı
    const refLat = 39.121138;
    const refLon = 27.179661;
    const detectedCoords = coordData.match(/\d+(\.\d+)?/g);

    if (detectedCoords && detectedCoords.length >= 2) {
        const uLat = parseFloat(detectedCoords[0]);
        const uLon = parseFloat(detectedCoords[1]);

        if (Math.abs(uLat - refLat) < 0.005 && Math.abs(uLon - refLon) < 0.005) {
            logBox("AI ANALİZİ: Başarılı. Koordinat uyumu mühürlendi.", "success");
            logBox("Görev başarı ile tamamlanması için aşağıdaki düğmeye (Rapor yaz düğmesi) basarak raporunuzu yazınız", "warning");
            
            // Raporlama Paneli Aktivasyonu
            const visualPanel = document.querySelector('.map-frame');
            if (visualPanel) {
                visualPanel.innerHTML = `
                    <div id="rapor-ekrani" style="padding:25px; background:rgba(0,30,0,0.95); height:100%; color:#00ff41; border:2px solid #00ff41; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
                        <h2 style="margin-bottom:20px; font-size:1.5rem;">📁 OPERASYON RAPORU BEKLENİYOR</h2>
                        <p style="margin-bottom:30px;">Analiz doğrulandı. Nihai raporu göndermek için butona basınız.</p>
                        <button onclick="window.finishMission()" style="background:#00ff41; color:#000; font-weight:bold; cursor:pointer; padding:20px 40px; border:none; font-size:1.2rem; box-shadow: 0 0 15px #00ff41;">RAPOR YAZ</button>
                    </div>
                `;
            }
        } else {
            logBox("AI ANALİZİ: Hatalı koordinat! Sapma payı kabul edilemez.", "warning");
            const hCount = (data.hataSayisi || 0) + 1;
            update(scoreRef, { hataSayisi: hCount, durum: "Hatalı Koordinat Girişi" });
        }
    } else {
        logBox("HATA: Geçerli koordinat verisi bulunamadı!", "warning");
    }
};

window.finishMission = async function() {
    window.open('https://forms.gle/oZxe7BeasdeMUekB6', '_blank');
    logBox("OPERASYON RAPORU GÖNDERİLDİ.", "success");
    logBox("Görev başarı ile tamamlandı.", "success");
    
    await update(scoreRef, { 
        gorevNo: 11, 
        bolge: "TAMAMLANDI", 
        durum: "OPERASYON TAMAM", 
        ipucuSayisi: 0 
    });
};

// --- 4. DİNAMİK BRİFİNG VE GÖREV ARAYÜZ YÖNETİMİ ---
let lastGorevNo = 0;
function triggerBriefing(gorevNo) {
    if (lastGorevNo !== gorevNo) {
        terminal.innerHTML = "";
        logBox("[SİSTEM]: Yeni veri paketi tanımlandı.", "success");
        
        // Görev 10'da terminal giriş kutusunu gizleme protokolü
        const inputGroup = document.querySelector('.input-group');
        if (inputGroup) inputGroup.style.display = (gorevNo >= 10) ? "none" : "flex";

        if (gorevNo <= 9) {
            // CMS'den gelen soruyu yazdır, yoksa varsayılan bir mesaj göster.
            const missionText = globalMissionData[gorevNo]?.question || "[MERKEZ]: Veri paketi indiriliyor... Lütfen bekleyin.";
            logBox(`[MERKEZ]: ${missionText}`, "warning");
        } else if (gorevNo === 10) {
            logBox("[MERKEZ]: Bergama-Dikili hattı profil operasyonu aktif.", "warning");
            const mapFrame = document.querySelector('.map-frame');
            if (mapFrame) {
                mapFrame.innerHTML = `
                    <div id="task10-panel" style="padding:20px; background:rgba(0,25,0,0.95); height:100%; color:#00ff41; border:2px solid #00ff41; display:flex; flex-direction:column; gap:12px;">
                        <h2 style="font-size:1.2rem; border-bottom:1px solid #00ff41; padding-bottom:8px;">📊 PROFİL LABORATUVARI</h2>
                        <button onclick="window.open('https://www.heywhatsthat.com/profiler.html', '_blank')" style="background:#00ff41; color:#000; font-weight:bold; cursor:pointer; padding:10px; border:none;">PROFİL OLUŞTURMA GÖREVİNİ YAP</button>
                        <button onclick="window.open('assets/video/10_gorev.mp4', '_blank')" style="background:rgba(0,40,0,0.8); color:#00ff41; border:1px solid #00ff41; font-weight:bold; cursor:pointer; padding:10px;">🎥 EĞİTİM VİDEOSUNU İZLE</button>
                        <div style="border:1px dashed #00ff41; padding:10px; background:rgba(0,0,0,0.5);"><label style="display:block; margin-bottom:5px; font-size:11px;">📤 PROFİL DOSYASI YÜKLE:</label><input type="file" style="color:#fff; font-size:10px; width:100%;"></div>
                        <div style="flex-grow:1; display:flex; flex-direction:column;">
                            <label style="display:block; margin-bottom:5px; font-size:11px;">🤖 YAPAY ZEKA ANALİZ ALANI:</label>
                            <textarea id="ai-coord-input" placeholder="Koordinatları buraya yapıştırın..." style="flex-grow:1; background:#000; color:#00ff41; border:1px solid #00ff41; padding:10px; font-family:monospace; resize:none; font-size:13px;"></textarea>
                            <button onclick="window.executeAIAnaliz()" style="margin-top:10px; padding:15px; background:#00ff41; color:#000; font-weight:bold; cursor:pointer; border:none; width:100%;">ANALİZ ET VE GÖNDER</button>
                        </div>
                    </div>
                `;
            }
        }
        lastGorevNo = gorevNo;
        saveTerminal();
    }
}

// --- 5. BAĞLANTI VE CANLI SENKRONİZASYON ---
function initOperation() {
    if (!teamName) return;
    loadTerminal(); 
    update(scoreRef, { durum: "Bağlantı Kuruldu", sonAktiflik: new Date().toISOString() });

    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev > 10 ? 'BİTTİ' : gorev + '. Görev'} ${bolge}`;
        
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            if (gorev <= 9) { 
                // CMS'den gelen resmi kullan, yoksa varsayılan yerel dosyayı kullan
                const cmsImage = globalMissionData[gorev]?.image;
                mapImg.src = cmsImage || `assets/img/soru${gorev}.jpg`; 
                mapImg.style.display = "block"; 
            }
            else { mapImg.style.display = "none"; }
        }
        triggerBriefing(gorev);
        
        // Yıldız Hesaplama ve Bildirim Mantığı
        const stars = document.querySelectorAll('.star');
        let currentStarCount = 0;

        stars.forEach((star, i) => {
            star.classList.remove('filled');
            if (gorev >= 3 && i === 0) star.classList.add('filled');
            if (gorev >= 6 && i <= 1) star.classList.add('filled');
            if (gorev >= 9 && i <= 2) star.classList.add('filled');
            if (gorev >= 11 && i <= 3) star.classList.add('filled');
            
            if (star.classList.contains('filled')) currentStarCount++;
        });

        // Eğer önceki durum hafızada varsa (-1 değilse) ve yeni yıldız sayısı arttıysa:
        if (window.lastStarCount !== undefined && window.lastStarCount !== -1 && currentStarCount > window.lastStarCount) {
            if (currentStarCount === 4) {
                logBox(`🎖️ TEBRİKLER! RÜTBE ATLADINIZ: 4 YILDIZ. 5. YILDIZI RAPORUNUZ İNCELENDİKTEN SONRA KAZANACAKSINIZ`, "success");
            } else {
                logBox(`🎖️ TEBRİKLER! RÜTBE KAZANDINIZ: ${currentStarCount} YILDIZ`, "success");
            }
            const starContainer = document.getElementById('star-container');
            if(starContainer) { starContainer.classList.add('star-pulse'); setTimeout(() => starContainer.classList.remove('star-pulse'), 3000); }
        }
        window.lastStarCount = currentStarCount; // Mevcut durumu kaydet
    });
}
initOperation();

// --- 6. İPUCU TALEBİ PANELİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0, currentGorev = data.gorevNo || 1;
    
    // CMS'den gelen ipuçlarını al (Newline ile ayrılmış string olabilir, array'e çevir)
    const rawHints = globalMissionData[currentGorev]?.hints || "";
    const activeHints = rawHints.split('\n').filter(h => h.trim() !== "");

    if (count < activeHints.length) {
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        update(scoreRef, { puan: newScore, ipucuSayisi: count + 1, durum: `İpucu Kullanıldı` });
        logBox(`[VERİ]: ${activeHints[count]}`, "hint");
    } else {
        logBox("Tüm ipucu haklarını kullandınız.", "warning");
    }
});

// --- 7. ONAYLA (DOĞRULAMA MOTORU) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const cur = data.gorevNo || 1;
    if (cur >= 10) return logBox("Lütfen analizi görsel paneldeki butonlar ile tamamlayın.", "warning");

    const rawInput = document.getElementById('kripto-val').value.trim().toLocaleLowerCase('tr').replace(/\s/g, "");
    
    // CMS'den gelen doğru cevapları al
    const correctAnswersRaw = globalMissionData[cur]?.answers || "";
    const requireAll = globalMissionData[cur]?.requireAll || false; // Kombinasyon modu açık mı?

    // Virgülle ayrılmış cevapları diziye çevir ve temizle
    const correctAnswers = correctAnswersRaw.split(',').map(a => a.trim().toLocaleLowerCase('tr').replace(/\s/g, ""));

    let isCorrect = false;
    
    if (requireAll) {
        // KOMBİNASYON MODU: Girilen kelimelerin HEPSİ öğrencinin cevabında geçmeli.
        // Örn: Cevaplar ["plato", "ova"]. Öğrenci "ovaveplato" yazdı.
        // "ovaveplato" içinde "plato" var mı? EVET. "ova" var mı? EVET. -> DOĞRU.
        if (correctAnswers.length > 0 && correctAnswers.every(ans => rawInput.includes(ans))) {
            isCorrect = true;
        }
    } else {
        // STANDART MOD: Listeden HERHANGİ BİRİ tam eşleşirse doğru.
        if (correctAnswers.includes(rawInput)) {
            isCorrect = true;
        }
    }

    if (isCorrect) {
        update(scoreRef, { gorevNo: cur + 1, bolge: cur + 1 > 10 ? "TAMAMLANDI" : "2J", puan: (data.puan || 1000) + 200, durum: "Başarılı Analiz", ipucuSayisi: 0, hataSayisi: (data.hataSayisi || 0) });
        logBox("VERİ DOĞRULANDI!", "success");
    } else {
        const hCount = (data.hataSayisi || 0) + 1;
        update(scoreRef, { durum: "Hatalı Analiz Girişi", hataSayisi: hCount });
        logBox("HATA: Analiz verisi geçersiz.", "warning");
    }
    document.getElementById('kripto-val').value = "";
});