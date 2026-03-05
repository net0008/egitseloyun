/* *****************************************************************************
 * ops_engine.js - Sürüm: v3.5.20                                              *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Görev 1-10 Tam Entegrasyon | Bergama-Dikili İnteraktif Profil & AI Motoru  *
 * *************************************************************************** */

import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

// --- 0. BAĞLANTI PARAMETRELERİ VE SABİTLER ---
// URL üzerinden gelen takım ismini yakalayarak karargah senkronizasyonunu sağlar.
const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- 1. İPUCU KÜTÜPHANESİ (HİNT REPOSITORY - KADEMELİ SİSTEM) ---
// Her görev için Coğrafya ve Teknik odaklı ipuçlarını içerir.
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
        "Profiler ekranında tam Dikili yazısı üzerine tıklayın.",
        "Profiler ekranında tam Bergama yazısı üzerine tıklayın.",
        "Oluşturduğunuz profilin koordinatlarını AI analiz alanına yapıştırın."
    ]
};

// --- 2. TERMİNAL HAFIZA VE MESAJ MOTORU ---
// Terminaldeki verilerin oturum boyunca korunmasını sağlar.
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

// --- 3. DİNAMİK BRİFİNG VE GÖREV 10 ARAYÜZ YÖNETİMİ ---
let lastGorevNo = 0;

function triggerBriefing(gorevNo) {
    if (lastGorevNo !== gorevNo) {
        terminal.innerHTML = "";
        logBox("[SİSTEM]: Yeni veri paketi tanımlandı.", "success");
        
        // Standart Brifing Metinleri
        if (gorevNo === 1) {
            logBox("[MERKEZ]: Haritadaki konumun yükseltisini h² olarak gir.", "warning");
        } else if (gorevNo === 2) {
            logBox("[MERKEZ]: Kalın çizgili yeryüzü şeklini analiz et.", "hint");
        } else if (gorevNo === 3) {
            logBox("[MERKEZ]: İzohipslerin sıklaştığı yerin ortak özelliğini bul.", "hint");
        } else if (gorevNo === 4) {
            logBox("[MERKEZ]: X ve Y noktalarının yükseltisini hesapla.", "hint");
        } else if (gorevNo === 5) {
            logBox("[MERKEZ]: Sarı daireli yerlerin ortak özelliğini belirle.", "hint");
        } else if (gorevNo === 6) {
            logBox("[MERKEZ]: Sarı çizgili bölgelerdeki eğim analizini yap.", "hint");
        } else if (gorevNo === 7) {
            logBox("[MERKEZ]: Z ve Y alanlarının coğrafi isimlerini mühürle.", "hint");
        } else if (gorevNo === 8) {
            logBox("[MERKEZ]: A ve B alanlarının yer şekli adlarını bul.", "hint");
        } else if (gorevNo === 9) {
            logBox("[MERKEZ]: V, Y ve Z oklarını eğim miktarına göre MATEMATİKSEL sırala (Örn: A>B>C).", "warning");
        } else if (gorevNo === 10) {
            logBox("[MERKEZ]: Dikili-Bergama hattı profil operasyonu aktif.", "warning");
            logBox("Hangi adımları izlemen gerektiğini sol taraftaki panelden 'VİDEO' ile öğrenebilirsin.", "");
            
            // --- GÖREV 10: VISUAL PANEL (HARİTA ALANI) YENİDEN YAPILANDIRMA ---
            // Sıkışmayı önlemek için UI elementlerini geniş harita alanına taşıyoruz.
            const visualPanel = document.querySelector('.map-frame'); 
            if (visualPanel) {
                visualPanel.innerHTML = `
                    <div id="task10-interaktif-panel" style="padding:25px; background:rgba(0,25,0,0.95); height:100%; color:#00ff41; border:2px solid #00ff41; display:flex; flex-direction:column; gap:20px; box-shadow: 0 0 20px rgba(0,255,65,0.2);">
                        <h2 style="font-size:1.4rem; border-bottom:1px solid #00ff41; padding-bottom:10px; text-shadow: 0 0 5px #00ff41;">🛰️ PROFİL ANALİZ LABORATUVARI</h2>
                        
                        <div style="flex: 1; display: flex; flex-direction: column; gap:15px;">
                            <button onclick="window.open('asset/video/10_gorev.mp4', '_blank')" class="cyber-btn" style="width:100%; padding:15px; background:#00ff41; color:#000; font-weight:bold; border:none; cursor:pointer;">🎥 EĞİTİM VİDEOSUNU BAŞLAT</button>
                            
                            <div style="border:1px dashed #00ff41; padding:15px; background:rgba(0,40,0,0.5);">
                                <label style="display:block; margin-bottom:10px; font-weight:bold;">📤 PROFİLİ YÜKLE (Analiz İçin):</label>
                                <input type="file" id="fake-upload" style="color:#fff; font-size:0.9rem;">
                            </div>
                            
                            <div style="flex-grow:1; display:flex; flex-direction:column;">
                                <label style="display:block; margin-bottom:10px; font-weight:bold;">🤖 YAPAY ZEKA KOORDİNAT ANALİZİ:</label>
                                <textarea id="ai-coord-input" placeholder="Profiler koordinatlarını buraya yapıştırın: Örn: 39.121138° N 27.179661° E" style="flex-grow:1; background:#000; color:#00ff41; border:1px solid #00ff41; padding:15px; font-family:monospace; resize:none; font-size:1rem;"></textarea>
                                <p style="font-size:0.8rem; color:#888; margin-top:8px;">[DİKKAT]: HeyWhatsThat üzerindeki tam koordinat verisini kullanın.</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else if (gorevNo > 10) {
            logBox("OPERASYON TAMAMLANDI. Tüm veriler mühürlendi.", "success");
        }
        
        lastGorevNo = gorevNo;
        saveTerminal();
    }
}

// --- 4. BAĞLANTI VE CANLI SENKRONİZASYON (FIREBASE INIT) ---
function initOperation() {
    if (!teamName) {
        console.error("Takım adı parametresi eksik! URL kontrolü yapın.");
        return;
    }
    
    loadTerminal(); 
    
    // Bağlantı durumunu karargaha bildirir.
    update(scoreRef, { durum: "Aktif Bağlantı", sonSinyal: new Date().toISOString() })
        .catch(err => console.error("Firebase Update Hatası:", err));

    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        
        // Puan ve Sektör bilgilerini günceller.
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev > 10 ? 'BİTTİ' : gorev + '. Görev ' + bolge}`;
        
        // Görsel paneli yönetir.
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            if (gorev <= 9) {
                mapImg.src = `assets/img/soru${gorev}.jpg`;
                mapImg.style.display = "block";
            } else if (gorev === 10) {
                // Görev 10'da statik resmi gizleyip interaktif paneli gösteriyoruz.
                mapImg.style.display = "none";
            }
        }

        triggerBriefing(gorev);

        // Yıldız ilerleme sistemini günceller.
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

// --- 5. İPUCU TALEBİ PANELİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0;
    const currentGorev = data.gorevNo || 1;
    const activeHints = hint_library[currentGorev] || [];

    if (count === 0 && activeHints.length > 0) {
        logBox(activeHints[0], "hint");
        update(scoreRef, { ipucuSayisi: 1, durum: "Kılavuz Kontrol Edildi" });
    } else if (count < activeHints.length) {
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        update(scoreRef, {
            puan: newScore,
            ipucuSayisi: count + 1,
            durum: `G${currentGorev}-İpucu Kullanıldı`
        });
        logBox(`[VERİ]: ${activeHints[count]}`, "hint");
    } else {
        logBox("Bu bölge için tüm veriler deşifre edildi.", "warning");
    }
});

// --- 6. ONAYLA (DOĞRULAMA PANELİ - ANALİZ MOTORU) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const cur = data.gorevNo || 1;
    let isCorrect = false;

    // --- GÖREV 1-9: METİNSEL VE MATEMATİKSEL KONTROL ---
    if (cur < 10) {
        const rawInput = document.getElementById('kripto-val').value.trim().toLocaleLowerCase('tr').replace(/\s/g, "");
        if (cur === 1 && Number(rawInput) === 360000) isCorrect = true;
        else if (cur === 2 && rawInput === "vadi") isCorrect = true;
        else if (cur === 3 && rawInput.includes("eğim")) isCorrect = true;
        else if (cur === 4 && rawInput.includes("200")) isCorrect = true;
        else if (cur === 5 && rawInput.includes("tepe")) isCorrect = true;
        else if (cur === 6 && rawInput.includes("eğim")) isCorrect = true;
        else if (cur === 7 && rawInput.includes("plato") && rawInput.includes("ova")) isCorrect = true;
        else if (cur === 8 && rawInput.includes("delta") && rawInput.includes("falez")) isCorrect = true;
        else if (cur === 9 && rawInput === "y>z>v") isCorrect = true;
    } 
    // --- GÖREV 10: YAPAY ZEKA KOORDİNAT DOĞRULAMA MOTORU ---
    else if (cur === 10) {
        const aiField = document.getElementById('ai-coord-input');
        const aiValue = aiField ? aiField.value.trim() : "";
        
        // Referans Koordinatlar: Bergama - Dikili Hattı
        const refLat = 39.121138;
        const refLon = 27.179661;
        
        // Düzenli ifade (Regex) ile input içindeki sayısal değerleri ayıklar.
        const coords = aiValue.match(/\d+\.\d+/g);
        
        if (coords && coords.length >= 2) {
            const userLat = parseFloat(coords[0]);
            const userLon = parseFloat(coords[1]);
            
            // Hata Payı Toleransı: 0.005 Derece (Yaklaşık 500m sapma payı)
            const latDiff = Math.abs(userLat - refLat);
            const lonDiff = Math.abs(userLon - refLon);
            
            if (latDiff < 0.005 && lonDiff < 0.005) {
                isCorrect = true;
                logBox("AI ANALİZİ: Koordinat uyumu başarılı. Dikili-Bergama hattı doğrulandı.", "success");
            } else {
                logBox("AI ANALİZİ: Sapma payı çok yüksek! Koordinatları kontrol edin.", "warning");
            }
        } else {
            logBox("HATA: AI Analiz alanına geçerli koordinat verisi girilmedi!", "warning");
        }
    }

    if (isCorrect) {
        const nextG = cur + 1;
        const bolgeKodu = nextG > 10 ? "TAMAMLANDI" : "2J";
        
        // Firebase güncellemesini takip eden ve kullanıcıya geri bildirim veren blok.
        update(scoreRef, { 
            gorevNo: nextG, 
            bolge: bolgeKodu,
            puan: data.puan + 200, 
            durum: nextG > 10 ? "OPERASYON TAMAM" : "Başarılı Analiz", 
            ipucuSayisi: 0 
        }).then(() => {
            logBox("VERİ DOĞRULANDI! Karargah senkronize edildi.", "success");
        }).catch(err => {
            logBox("KRİTİK HATA: Veri karargaha gönderilemedi!", "warning");
        });
        
    } else if (cur < 10) {
        logBox("HATA: Gönderilen analiz verisi geçersiz.", "warning");
    }
    
    // Giriş alanını temizle
    document.getElementById('kripto-val').value = "";
});