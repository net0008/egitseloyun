/* *****************************************************************************
 * ops_engine.js - Sürüm: v3.5.21                                              *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Görev 1-10 Tam Entegrasyon | Bergama-Dikili Final Raporu & AI Motoru       *
 * *************************************************************************** *
 * Bu modül, Firebase Realtime Database üzerinden saha ve karargah arasındaki *
 * şifreli veri trafiğini yönetir. Milli Eğitim Akademisi mülakatı için özel  *
 * olarak geliştirilmiş "Hibrit Eğitim" protokollerini içerir.                *
 * *************************************************************************** */

import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

// --- 0. BAĞLANTI PARAMETRELERİ VE SABİTLER ---
// URL üzerinden gelen takım ismini (team) yakalayarak veri tünelini aktif eder.
const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- 1. İPUCU KÜTÜPHANESİ (HİNT REPOSITORY - KADEMELİ SİSTEM) ---
// Her görev aşaması için stratejik ipuçlarını ve teknik yönlendirmeleri içerir.
const hint_library = {
    1: [
        "Saha kılavuzunu dikkatlice oku.",
        "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
        "Deniz kıyı çizgisi ile kıyıdan itibaren ilk izohips eğrisi arasındaki fark eküidistans değeridir.",
        "Yükselti farkı 200m. Kıyıdan itibaren izohipsleri say: (Yükseklik = İzohips Sayısı x 200)"
    ],
    2: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohips eğrilerinin, yükseltinin arttığı (tepeye doğru) yöne doğru büklüm yaptığı yerlere odaklan.",
        "Ucu yüksekliği fazla olan tarafa bakan 'V' şekilleri vadiyi temsil eder.",
        "Akarsu yatağının bulunduğu bu derinlikli yer şekli nedir?"
    ],
    3: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohips eğrilerinin birbirine çok yaklaştığı yerlere dikkat et.",
        "Bu bölgede bir akarsu olsaydı akış hızı ve aşındırma gücü nasıl olurdu?",
        "Eğriler arasındaki mesafenin azalması, yükseltinin kısa mesafede hızla değiştiği anlamına gelir."
    ],
    4: [
        "Saha kılavuzunu dikkatlice oku.",
        "Aralarından akarsu geçse bile, akarsuyun her iki yanındaki ilk izohips çizgilerinin yükseltisi ortaktır.",
        "Birbirini çevrelemeyen ama yan yana duran iki izohips eğrisi arasındaki kuralı hatırla: Yükseltileri eşittir!",
        "Kıyıdan (0m) itibaren saymaya başla. X ve Y'nin bulunduğu bu çizgiler kaçıncı basamakta?"
    ],
    5: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohipslerin oluşturduğu en içteki kapalı halkalara odaklan.",
        "Çevresine göre daha yüksekte kalan, zirveye en yakın noktaları temsil ederler.",
        "Haritada genelde bir 'nokta' ile doruk noktaları gösterilen yer şekli nedir?"
    ],
    6: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohipslerin birbirine çok yaklaştığı, çizgilerin sıkıştığı bölgelere odaklan.",
        "Çizgilerin sık olması arazinin yapısı hakkında ne söyler?",
        "Bu bölge bir yol çalışması için düz bir zemin mi yoksa dik bir yokuş mu?"
    ],
    7: [
        "Saha kılavuzunu dikkatlice oku.",
        "Z noktasına bak; akarsularla derince yarılmış yüksek düzlükleri hatırla.",
        "Y noktasına bak; çevresine göre alçakta kalan geniş düzlükleri hatırla.",
        "Yüksek düzlük (Z) ve alçak düzlük (Y) kavramlarını birleştir."
    ],
    8: [
        "Saha kılavuzunu dikkatlice oku.",
        "A noktasına bak; akarsuyun denize döküldüğü yerdeki biriktirme şeklini hatırla.",
        "B noktasına odaklan; dalga aşındırması sonucu oluşan dik uçurumları düşün.",
        "Akarsu biriktirmesi (A) ve dalga aşındırması (B) sonucu oluşan bu kıyı şekillerini birleştir."
    ],
    9: [
        "Saha kılavuzunu dikkatlice oku.",
        "Çizgilerin en sık olduğu yerde eğim en fazladır.",
        "En seyrek olduğu yerde eğim en azdır.",
        "V, Y ve Z doğrultularını buna göre kıyasla ve MATEMATİKSEL sıralama yap."
    ],
    10: [
        "Saha kılavuzunu dikkatlice oku. Hata yaparsanız sayfayı yenileyin.",
        "Profiler ekranında imleci tam 'Dikili' yazısının üzerine getirin.",
        "Hattı tamamlamak için tam 'Bergama' yazısının üzerine tıklayın.",
        "Koordinatları kopyalayıp Yapay Zeka Analiz alanına mühürleyin."
    ]
};

// --- 2. TERMİNAL HAFIZA VE MESAJ MOTORU ---
// Operasyon loglarının oturum bazlı korunmasını sağlar.
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

// --- 3. ÖZEL GÖREV FONKSİYONLARI (GÖREV 10) ---
// AI Analiz Motoru ve Raporlama Protokolü.
window.executeAIAnaliz = async function() {
    const aiInput = document.getElementById('ai-coord-input');
    const coordData = aiInput ? aiInput.value.trim() : "";
    const snap = await get(scoreRef);
    const data = snap.val();

    const refLat = 39.121138;
    const refLon = 27.179661;

    const detectedCoords = coordData.match(/\d+\.\d+/g);

    if (detectedCoords && detectedCoords.length >= 2) {
        const uLat = parseFloat(detectedCoords[0]);
        const uLon = parseFloat(detectedCoords[1]);

        if (Math.abs(uLat - refLat) < 0.005 && Math.abs(uLon - refLon) < 0.005) {
            logBox("AI ANALİZİ: Başarılı. Koordinat uyumu mühürlendi.", "success");
            logBox("Görev başarı ile tamamlanması için aşağıdaki düğmeye (Rapor yaz düğmesi) basarak raporunuzu yazınız", "warning");
            
            // Raporlama UI Güncellemesi
            const visualPanel = document.querySelector('.map-frame');
            if (visualPanel) {
                visualPanel.innerHTML = `
                    <div id="rapor-paneli" style="padding:25px; background:rgba(0,30,0,0.95); height:100%; color:#00ff41; border:2px solid #00ff41; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
                        <h2 style="margin-bottom:20px; font-size:1.5rem;">📁 OPERASYON RAPORU BEKLENİYOR</h2>
                        <p style="margin-bottom:30px; line-height:1.6;">AI Analizi başarıyla tamamlandı. Saha verilerinin karargaha tam iletilmesi için raporunuzu mühürleyin.</p>
                        <button onclick="window.finishMission()" style="background:#00ff41; color:#000; font-weight:bold; cursor:pointer; padding:20px 40px; border:none; font-size:1.2rem; box-shadow: 0 0 15px #00ff41;">RAPOR YAZ</button>
                    </div>
                `;
            }
        } else {
            logBox("AI ANALİZİ: Başarısız. Koordinat sapması kabul edilemez!", "warning");
        }
    } else {
        logBox("KRİTİK HATA: Analiz edilecek geçerli veri bulunamadı!", "warning");
    }
};

window.finishMission = function() {
    // Rapor linkine gönder
    window.open('https://forms.gle/oZxe7BeasdeMUekB6', '_blank');
    
    // Terminali mühürle
    logBox("OPERASYON RAPORU MÜHÜRLENDİ.", "success");
    logBox("Görev başarı ile tamamlandı.", "success");
    
    // Firebase güncelle
    update(scoreRef, { 
        gorevNo: 11, bolge: "TAMAMLANDI", 
        durum: "OPERASYON TAMAM", ipucuSayisi: 0 
    });
};

// --- 4. DİNAMİK BRİFİNG VE GÖREV ARAYÜZÜ ---
let lastGorevNo = 0;

function triggerBriefing(gorevNo) {
    if (lastGorevNo !== gorevNo) {
        terminal.innerHTML = "";
        logBox("[SİSTEM]: Yeni veri paketi tanımlandı.", "success");
        
        if (gorevNo <= 9) {
            const brifingler = [
                "", "[MERKEZ]: Konumun yükseltisini h² protokolü ile gir.",
                "[MERKEZ]: Kalın çizgili bölgedeki yer şeklini analiz et.",
                "[MERKEZ]: İzohipslerin sıklaştığı yerin ortak özelliğini bul.",
                "[MERKEZ]: X ve Y noktalarının gerçek yükseltisini hesapla.",
                "[MERKEZ]: Daireli içine alınan bölgelerin coğrafi adını nedir?.",
                "[MERKEZ]: Çizgili sahaların ortak özelliği nedir?",
                "[MERKEZ]: Z ve Y alanlarına ne ad verilir? (morfolojik adı nedir?).",
                "[MERKEZ]: A ve B kıyı yer şekillerinin adını nedir?, Kutucuğa aralarında bir boşluk bırakarak yazınız. (örnek: dağ ova)",
                "[MERKEZ]: V, Y ve Z oklarını eğimin en fazla olandan aza doğru sıralayınız. Örnek giriş: a>b>c"
            ];
            logBox(brifingler[gorevNo], "warning");
        } else if (gorevNo === 10) {
            logBox("[MERKEZ]: Bergama-Dikili hattı profil operasyonu aktif.", "warning");
            
            // VISUAL PANEL GÜNCELLEMESİ (Harita yerine İnteraktif Panel)
            const mapFrame = document.querySelector('.map-frame');
            if (mapFrame) {
                mapFrame.innerHTML = `
                    <div id="task10-panel" style="padding:20px; background:rgba(0,25,0,0.95); height:100%; color:#00ff41; border:2px solid #00ff41; display:flex; flex-direction:column; gap:15px; box-shadow: 0 0 20px rgba(0,255,65,0.2);">
                        <h2 style="font-size:1.3rem; border-bottom:1px solid #00ff41; padding-bottom:8px; text-shadow: 0 0 5px #00ff41;">🛰️ PROFİL ANALİZ LABORATUVARI</h2>
                        
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <button onclick="window.open('https://www.heywhatsthat.com/profiler.html', '_blank')" style="background:#00ff41; color:#000; font-weight:bold; cursor:pointer; padding:10px; border:none; width:100%;">PROFİL OLUŞTURMA GÖREVİNİ YAP</button>
                            <button onclick="window.open('assets/video/10_gorev.mp4', '_blank')" style="background:rgba(0,40,0,0.8); color:#00ff41; border:1px solid #00ff41; font-weight:bold; cursor:pointer; padding:10px; width:100%;">🎥 EĞİTİM VİDEOSUNU İZLE</button>
                        </div>

                        <div style="border:1px dashed #00ff41; padding:12px; background:rgba(0,40,0,0.5);">
                            <label style="display:block; margin-bottom:8px; font-size:12px; font-weight:bold;">📤 PROFİL DOSYASI YÜKLE:</label>
                            <input type="file" style="color:#fff; font-size:11px; width:100%;">
                        </div>

                        <div style="flex-grow:1; display:flex; flex-direction:column;">
                            <label style="display:block; margin-bottom:8px; font-size:12px; font-weight:bold;">🤖 YAPAY ZEKA ANALİZ ALANI:</label>
                            <textarea id="ai-coord-input" placeholder="Koordinat verisini buraya yapıştırın..." style="flex-grow:1; background:#000; color:#00ff41; border:1px solid #00ff41; padding:10px; font-family:monospace; resize:none; font-size:13px;"></textarea>
                            <button onclick="window.executeAIAnaliz()" style="margin-top:10px; padding:15px; background:#00ff41; color:#000; font-weight:bold; cursor:pointer; border:none; width:100%;">MÜHÜRLE VE ANALİZ ET</button>
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
    
    // Firebase bağlantı durumunu günceller.
    update(scoreRef, { durum: "Bağlantı Kuruldu", sonAktiflik: new Date().toISOString() })
        .catch(err => console.error("Firebase Update Hatası:", err));

    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev > 10 ? 'FİNAL' : gorev + '. Görev'} ${bolge}`;
        
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            if (gorev <= 9) {
                mapImg.src = `assets/img/soru${gorev}.jpg`;
                mapImg.style.display = "block";
            } else {
                mapImg.style.display = "none";
            }
        }

        triggerBriefing(gorev);

        // Yıldız sistemini günceller.
        const stars = document.querySelectorAll('.star');
        stars.forEach((star, i) => {
            star.classList.remove('filled');
            if (gorev >= 3 && i === 0) star.classList.add('filled');
            if (gorev >= 6 && i <= 1) star.classList.add('filled');
            if (gorev >= 9 && i <= 2) star.classList.add('filled');
            if (gorev >= 11 && i <= 3) star.classList.add('filled');
        });
    });
}

initOperation();

// --- 6. İPUCU TALEBİ PANELİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0;
    const currentGorev = data.gorevNo || 1;
    const activeHints = hint_library[currentGorev] || [];

    if (count < activeHints.length) {
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        update(scoreRef, { 
            puan: newScore, ipucuSayisi: count + 1, 
            durum: `G${currentGorev}-İpucu Kullanıldı` 
        });
        logBox(`[VERİ]: ${activeHints[count]}`, "hint");
    } else {
        logBox("Tüm ipucu haklarını kullandınız.", "warning");
    }
});

// --- 7. ONAYLA (DOĞRULAMA PANELİ) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const cur = data.gorevNo || 1;

    // Görev 10 harita üzerindeki panelden yönetilir.
    if (cur >= 10) {
        logBox("Lütfen analizi görsel paneldeki butonlar ile tamamlayın.", "warning");
        return;
    }

    const rawInput = document.getElementById('kripto-val').value.trim().toLocaleLowerCase('tr').replace(/\s/g, "");
    let isCorrect = false;

    if (cur === 1 && Number(rawInput) === 360000) isCorrect = true;
    else if (cur === 2 && rawInput === "vadi") isCorrect = true;
    else if (cur === 3 && rawInput.includes("eğim")) isCorrect = true;
    else if (cur === 4 && rawInput.includes("200")) isCorrect = true;
    else if (cur === 5 && rawInput.includes("tepe")) isCorrect = true;
    else if (cur === 6 && rawInput.includes("eğim")) isCorrect = true;
    else if (cur === 7 && rawInput.includes("plato") && rawInput.includes("ova")) isCorrect = true;
    else if (cur === 8 && rawInput.includes("delta") && rawInput.includes("falez")) isCorrect = true;
    else if (cur === 9 && rawInput === "y>z>v") isCorrect = true;

    if (isCorrect) {
        const nextG = cur + 1;
        update(scoreRef, { 
            gorevNo: nextG, bolge: nextG > 10 ? "TAMAMLANDI" : "2J",
            puan: (data.puan || 1000) + 200, durum: "Başarılı Analiz", ipucuSayisi: 0 
        });
        logBox("VERİ DOĞRULANDI! Sektör temizlendi.", "success");
    } else {
        logBox("HATA: Analiz verisi geçersiz.", "warning");
    }
    document.getElementById('kripto-val').value = "";
});