/* *****************************************************************************
 * ops_engine.js - Sürüm: v3.5.21                                              *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Görev 1-10 Tam Entegrasyon | Bergama-Dikili İnteraktif Profil & AI Motoru  *
 * *************************************************************************** */

import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

// --- 0. BAĞLANTI PARAMETRELERİ VE SABİTLER ---
// Karargah ve Saha arasındaki senkronizasyonu sağlayan temel değişkenler.
const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- 1. İPUCU KÜTÜPHANESİ (HİNT REPOSITORY) ---
// Coğrafi yer şekilleri ve izohips kurallarına dair teknik yönlendirmeler.
const hint_library = {
    1: [
        "Saha kılavuzunu dikkatlice oku.",
        "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
        "Deniz kıyı çizgisi ile ilk izohips arasındaki fark eküidistans değeridir.",
        "Yükselti farkı 200m. Hesaplama: (İzohips Sayısı x 200)"
    ],
    2: [
        "Saha kılavuzunu dikkatlice oku.",
        "İzohipslerin yükseltinin arttığı yöne büklüm yapması vadiyi gösterir.",
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
        "Çevresine göre yüksekte kalan zirve noktalarını temsil ederler.",
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
        "Deniz kıyısındaki çizgilerin sıklaşması uçurumları (yalıyar) gösterir.",
        "Delta ve Falez kavramlarını uygun noktalarla eşleştirin."
    ],
    9: [
        "Saha kılavuzunu dikkatlice oku.",
        "Çizgilerin en sık olduğu doğrultuda eğim en yüksek seviyededir.",
        "Çizgilerin seyrek olduğu doğrultu eğimin en az olduğu yerdir.",
        "V, Y ve Z oklarını bu matematiksel kurala göre sıralayın."
    ],
    10: [
        "Saha kılavuzunu dikkatlice oku. Hata payı için sayfayı yenileyin.",
        "Profiler ekranında imleci tam 'Dikili' yazısının üzerine getirin.",
        "Hattı tamamlamak için tam 'Bergama' yazısının üzerine tıklayın.",
        "Koordinatları kopyalayıp Yapay Zeka Analiz alanına mühürleyin."
    ]
};

// --- 2. TERMİNAL VE HAFIZA YÖNETİMİ ---
// Kullanıcı deneyimini korumak adına log kayıtlarını saklar.
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

// --- 3. YAPAY ZEKA ANALİZ MOTORU (GÖREV 10 ÖZEL) ---
// Bu fonksiyon, Profil Panelindeki butona bağlı olarak çalışır.
window.executeAIAnaliz = async function() {
    const aiInput = document.getElementById('ai-coord-input');
    const coordData = aiInput ? aiInput.value.trim() : "";
    const snap = await get(scoreRef);
    const data = snap.val();

    // Referans Koordinat Verileri: Bergama-Dikili Hattı
    const refLat = 39.121138;
    const refLon = 27.179661;

    // Regex ile sayısal koordinatları ayıklama işlemi.
    const detectedCoords = coordData.match(/\d+\.\d+/g);

    if (detectedCoords && detectedCoords.length >= 2) {
        const uLat = parseFloat(detectedCoords[0]);
        const uLon = parseFloat(detectedCoords[1]);

        // Hata payı toleransı: 0.005 derece (Siber Karargah Onaylı)
        if (Math.abs(uLat - refLat) < 0.005 && Math.abs(uLon - refLon) < 0.005) {
            logBox("YAPAY ZEKA ANALİZİ: Başarılı. Profil doğruluğu mühürlendi.", "success");
            
            const nextG = (data.gorevNo || 10) + 1;
            update(scoreRef, { 
                gorevNo: nextG, bolge: "TAMAMLANDI",
                puan: (data.puan || 1000) + 200, durum: "OPERASYON TAMAM", ipucuSayisi: 0 
            }).then(() => logBox("VERİ KARARGAHA GÖNDERİLDİ.", "success"));
        } else {
            logBox("AI ANALİZİ: Başarısız. Koordinat sapması kabul edilemez!", "warning");
        }
    } else {
        logBox("KRİTİK HATA: Analiz edilecek geçerli veri bulunamadı!", "warning");
    }
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
                "[MERKEZ]: Sarı daireli bölgelerin coğrafi adını belirle.",
                "[MERKEZ]: Sarı çizgili sahalardaki eğim durumunu analiz et.",
                "[MERKEZ]: Z ve Y alanlarının morfolojik adlarını mühürle.",
                "[MERKEZ]: A ve B kıyı yer şekli tiplerini belirle.",
                "[MERKEZ]: V, Y ve Z oklarını eğim miktarına göre sırala."
            ];
            logBox(brifingler[gorevNo], "warning");
        } else if (gorevNo === 10) {
            logBox("[MERKEZ]: Bergama-Dikili hattı profil operasyonu aktif.", "warning");
            
            // VISUAL PANEL GÜNCELLEMESİ (Harita yerine İnteraktif Panel)
            const mapFrame = document.querySelector('.map-frame');
            if (mapFrame) {
                mapFrame.innerHTML = `
                    <div id="task10-interaktif-panel" style="padding:20px; background:rgba(0,20,0,0.9); height:100%; color:#39FF14; border:2px solid #39FF14; display:flex; flex-direction:column; gap:15px; overflow:hidden;">
                        <h2 style="font-size:1.2rem; border-bottom:1px solid #39FF14; padding-bottom:8px;">📊 PROFİL ANALİZ PANELİ</h2>
                        <button onclick="window.open('assets/video/10_gorev.mp4', '_blank')" style="background:#39FF14; color:#000; font-weight:bold; cursor:pointer; padding:12px; border:none;">🎥 EĞİTİM VİDEOSUNU İZLE</button>
                        <div style="border:1px dashed #39FF14; padding:10px; background:rgba(0,0,0,0.5);">
                            <label style="display:block; margin-bottom:8px; font-size:13px;">📤 PROFİL DOSYASI YÜKLE:</label>
                            <input type="file" style="color:#fff; font-size:11px; width:100%;">
                        </div>
                        <div style="flex-grow:1; display:flex; flex-direction:column;">
                            <label style="display:block; margin-bottom:8px; font-size:13px;">🤖 YAPAY ZEKA ANALİZ ALANI:</label>
                            <textarea id="ai-coord-input" placeholder="Koordinat verisini buraya yapıştırın..." style="flex-grow:1; background:#000; color:#39FF14; border:1px solid #39FF14; padding:10px; font-family:monospace; resize:none;"></textarea>
                            <button onclick="window.executeAIAnaliz()" style="margin-top:10px; padding:15px; background:#39FF14; color:#000; font-weight:bold; cursor:pointer; border:none;">OPERASYONU MÜHÜRLE VE GÖNDER</button>
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
    update(scoreRef, { durum: "Bağlantı Kuruldu", sonAktiflik: new Date().toISOString() });

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
        update(scoreRef, { puan: newScore, ipucuSayisi: count + 1, durum: `İpucu #${count} Kullanıldı` });
        logBox(`[VERİ]: ${activeHints[count]}`, "hint");
    } else {
        logBox("Tüm ipucu haklarını kullandınız.", "warning");
    }
});

// --- 7. ONAYLA (DOĞRULAMA PANELİ - ANALİZ MOTORU) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const cur = data.gorevNo || 1;

    // Görev 10 harita üzerindeki panelden yönetildiği için terminal girişini kısıtlıyoruz.
    if (cur === 10) {
        logBox("Lütfen analizi görsel paneldeki 'MÜHÜRLE' butonu ile gönderin.", "warning");
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
        logBox("VERİ DOĞRULANDI! Bir sonraki safhaya geçiliyor.", "success");
    } else {
        logBox("HATA: Gönderilen analiz verisi geçersiz.", "warning");
    }
    document.getElementById('kripto-val').value = "";
});