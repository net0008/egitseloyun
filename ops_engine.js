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

// --- 1. İPUCU KÜTÜPHANESİ (HİNT REPOSITORY) ---
// Her görev aşaması için stratejik ipuçlarını ve teknik yönlendirmeleri içerir.
const hint_library = {
    1: [
        "Saha kılavuzunu dikkatlice oku.",
        "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
        "Deniz kıyı çizgisi ile ilk izohips arasındaki fark eküidistans değeridir.",
        "Yükselti farkı 200m. Hesaplama: (İzohips Sayısı x 200)"
    ],
    2: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohipslerin yükseltinin arttığı yöne büklüm yapması vadileri gösterir.",
        "Ucu yüksek tarafa bakan 'V' şekillerine odaklanın.",
        "Akarsuyun yatağını oluşturan bu yer şeklinin adı nedir?"
    ],
    3: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohips eğrilerinin birbirine çok yaklaştığı bölgeleri inceleyin.",
        "Bu bölgede akarsu olsaydı akış hızı ve aşındırma gücü yüksek olurdu.",
        "Eğrilerin sıklaşması yükseltinin kısa mesafede değiştiği anlamına gelir."
    ],
    4: [
        "Saha kılavuzunu dikkatlice oku.",
        "Akarsuyun her iki yanındaki ilk izohipslerin yükseltisi ortaktır.",
        "Birbirini çevrelemeyen komşu izohipslerin yükseltileri eşittir.",
        "Kıyıdan (0m) itibaren basamakları tek tek sayarak ilerle."
    ],
    5: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohipslerin oluşturduğu en içteki kapalı halkalara odaklanın.",
        "Çevresine göre daha yüksekte kalan zirve noktalarını temsil ederler.",
        "Nokta veya üçgen ile gösterilen bu doruk noktasına ne denir?"
    ],
    6: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohipslerin birbirine değecek kadar yaklaştığı yerleri bulun.",
        "Çizgilerin sık olması o bölgenin eğim durumu hakkında ne söyler?",
        "Dik bir yamaç veya yokuş yapısını temsil eden kavram nedir?"
    ],
    7: [
        "Saha kılavuzunu dikkatlice oku.",
        "Akarsularla derince yarılmış yüksek düzlüklere plato denir.",
        "Çevresine göre alçakta kalan geniş düzlük alanlara ova denir.",
        "Z (Yüksek) ve Y (Alçak) düzlük kavramlarını birleştirin."
    ],
    8: [
        "Saha kılavuzunu dikkatlice oku.",
        "Akarsu alüvyonlarının denize döküldüğü yerde birikmesiyle oluşur.",
        "Deniz kıyısındaki çizgilerin sıklaşması uçurumları (falez) gösterir.",
        "Delta ve Falez kavramlarını uygun noktalarla eşleştirin."
    ],
    9: [
        "Saha kılavuzunu dikkatlice oku.",
        "Çizgilerin en sık olduğu doğrultuda eğim en yüksek seviyededir.",
        "Çizgilerin seyrek olduğu doğrultu eğimin en az olduğu yerdir.",
        "V, Y ve Z oklarını bu matematiksel kurala göre sıralayın."
    ],
    10: [
        "Hata yaparsanız sayfayı yenileyin. (F5 Protokolü)",
        "Profiler ekranında imleci tam 'Dikili' yazısının üzerine getirin.",
        "Hattı tamamlamak için tam 'Bergama' yazısının üzerine tıklayın.",
        "Koordinatları kopyalayıp Yapay Zeka Analiz alanına mühürleyin."
    ]
};

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
            const brifingler = [
                "", "[MERKEZ]: Konum ikonu ile gösterilen yerin yükseltisini bul. Karşıt unsurların eline geçmemesi için (h²) gerekli matematiksel işlemde bulduğun değeri gir.",
                "[MERKEZ]: Kalın çizgili bölgedeki yer şeklini adı nedir?.",
                "[MERKEZ]: İzohipslerin sıklaştığı yerin ortak özelliğini nedir?.",
                "[MERKEZ]: X ve Y noktalarının gerçek yükseltisini hesapla.",
                "[MERKEZ]: Sarı daireli yerlerin ortak özelliği belirlenmeli.",
                "[MERKEZ]: Sarı çizgili sahalardaki ortak özellik nedir?",
                "[MERKEZ]: Z ve Y alanlarının morfolojik adlarını yaz. Örnek: dağ, obruk.",
                "[MERKEZ]: A ve B kıyı yer şeklinin adı nedir? Örnek: lagün, kıyı oku.",
                "[MERKEZ]: V, Y ve Z oklarını eğim miktarına göre matematiksel kurala göre sıralayın. Örnek: A > B > C gibi."
            ];
            logBox(brifingler[gorevNo], "warning");
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
            if (gorev <= 9) { mapImg.src = `assets/img/soru${gorev}.jpg`; mapImg.style.display = "block"; }
            else { mapImg.style.display = "none"; }
        }
        triggerBriefing(gorev);
        
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
    const count = data.ipucuSayisi || 0, currentGorev = data.gorevNo || 1;
    const activeHints = hint_library[currentGorev] || [];

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
        update(scoreRef, { gorevNo: cur + 1, bolge: cur + 1 > 10 ? "TAMAMLANDI" : "2J", puan: (data.puan || 1000) + 200, durum: "Başarılı Analiz", ipucuSayisi: 0, hataSayisi: (data.hataSayisi || 0) });
        logBox("VERİ DOĞRULANDI!", "success");
    } else {
        const hCount = (data.hataSayisi || 0) + 1;
        update(scoreRef, { durum: "Hatalı Analiz Girişi", hataSayisi: hCount });
        logBox("HATA: Analiz verisi geçersiz.", "warning");
    }
    document.getElementById('kripto-val').value = "";
});