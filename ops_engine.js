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
let leafletMap = null; // Leaflet harita örneği için global değişken

// --- 1. İÇERİK YÖNETİMİ (CMS ENTEGRASYONU) ---
// Sorular ve İpuçları artık Firebase 'gameContent/missions' düğümünden çekiliyor.
let globalMissionData = null; // Veri yüklenene kadar null
let currentGorevNo = 1; // Anlık görev numarasını takip etmek için

// Harita durumunu sıfırlayan yardımcı fonksiyon
function resetMapState() {
    const elements = {
        mapImg: document.getElementById('active-map'),
        mapFrame: document.getElementById('active-frame'),
        scanLine: document.querySelector('.scan-line'),
        mapOverlayBarrier: document.querySelector('.map-overlay-barrier'),
        zoomControls: document.querySelector('.zoom-controls'),
        leafletContainer: document.getElementById('leaflet-map-container'),
        rawIframe: document.getElementById('raw-iframe-temp')
    };

    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    if (elements.rawIframe) elements.rawIframe.remove();

    Object.values(elements).forEach(el => {
        if (el) {
            el.style.display = 'none';
            // Iframe src'sini temizle ki yeni yüklemede onload kesin çalışsın
            // if (el.tagName === 'IFRAME') el.src = 'about:blank'; // Kaldırıldı: Gereksiz yükleme ve döngü sorunu
        }
    });
}

// Görsel Güncelleme Motoru (CMS verisi gelince veya görev değişince çalışır)
function updateMapVisuals(gorev) {
    // CMS verisi henüz gelmediyse işlem yapma (HTML'de gizli bekler)
    if (globalMissionData === null) return;
    
    const loader = document.getElementById('map-loader');
    if (loader) loader.style.display = 'flex';

    const mapContentWrapper = document.getElementById('map-content-wrapper');
    if (mapContentWrapper) mapContentWrapper.style.display = 'block';

    resetMapState(); // Önce tüm harita bileşenlerini temizle/gizle
        
    if (gorev > 9) {
        if (loader) loader.style.display = 'none';
        return; // Görev 10+ için harita alanı boş kalır, briefing fonksiyonu doldurur.
    }

    const cmsContent = globalMissionData[gorev]?.image;

    // --- RAW IFRAME MODU ---
    if (cmsContent && cmsContent.trim().startsWith("<iframe")) {
        const rawDiv = document.createElement('div');
        rawDiv.id = 'raw-iframe-temp';
        rawDiv.style.cssText = 'width: 100%; height: 100%;';

        // Protokol-göreceli URL'leri düzelt (src="//" -> src="https://")
        // Bu, yerel dosya sisteminde (file://) çalışırken haritanın yüklenmesini sağlar.
        const fixedContent = cmsContent.replace(/src="\/\//g, 'src="https://');
        rawDiv.innerHTML = fixedContent;
        mapContentWrapper.appendChild(rawDiv);

        const injectedIframe = rawDiv.querySelector('iframe');
        if (injectedIframe) {
            injectedIframe.style.width = '100%';
            injectedIframe.style.height = '100%';
            injectedIframe.style.border = 'none';
        }
        if (loader) loader.style.display = 'none';
    }
    // --- LEAFLET MODU ---
    else if (cmsContent && cmsContent.startsWith("leaflet:")) {
        const coords = cmsContent.replace("leaflet:", "").split(",");
        if (coords.length === 4) {
            initLeafletMap(coords);
        }
        if (loader) loader.style.display = 'none';
    }
    // --- GOOGLE MAPS / UMAP MODU ---
    else if (cmsContent && ((cmsContent.includes("google.") && cmsContent.includes("/maps")) || cmsContent.includes("maps.google") || cmsContent.includes("umap.openstreetmap.fr"))) {
        let embedUrl = cmsContent.trim();

        // URL Normalizasyonu (CMS ile Eşitlendi)
        if (embedUrl.startsWith('//')) {
            embedUrl = 'https:' + embedUrl;
        }

        if (embedUrl.includes("google.") || embedUrl.includes("maps.google")) {
            // "My Maps" linkleri (/d/)
            if (embedUrl.includes("/d/")) {
                embedUrl = embedUrl.replace(/\/edit(\?|$)/, '/embed$1').replace(/\/viewer(\?|$)/, '/embed$1');
            }
            // Standart harita linkleri (henüz embed değilse)
            else {
                try {
                    const urlObj = new URL(embedUrl);
                    if (urlObj.searchParams.has('q') && !embedUrl.includes('/embed')) {
                        if (!urlObj.searchParams.has('output')) urlObj.searchParams.set('output', 'embed');
                        if (!urlObj.searchParams.has('t')) urlObj.searchParams.set('t', 'k');
                        if (!urlObj.searchParams.has('z')) urlObj.searchParams.set('z', '11');
                        embedUrl = urlObj.toString();
                    }
                } catch (e) {
                    // URL API başarısız olursa manuel fallback
                    if (!embedUrl.includes("/embed") && (embedUrl.includes("?q=") || embedUrl.includes("&q="))) {
                        if (!embedUrl.includes("output=")) embedUrl += "&output=embed";
                        if (!embedUrl.includes("t=")) embedUrl += "&t=k";
                    }
                }
            }
        }

        // HTTP linklerini HTTPS'e zorla (Mixed Content hatasını önlemek için)
        if (embedUrl.startsWith('http:')) {
            embedUrl = embedUrl.replace('http:', 'https:');
        }

        const mapFrame = document.getElementById('active-frame');
        mapFrame.style.display = "block";
        mapFrame.style.zIndex = "15"; // Haritanın görünür olduğundan emin ol

        // URL değiştiyse yükle, aynıysa sadece loader'ı kapat (Sonsuz döngü önlemi)
        if (mapFrame.src !== embedUrl) {
            const hideLoader = () => { if (loader) loader.style.display = 'none'; };
            mapFrame.onload = hideLoader;
            mapFrame.src = embedUrl; 
            setTimeout(hideLoader, 5000);
        } else {
            if (loader) loader.style.display = 'none';
        }

        if (embedUrl.includes("google.") || embedUrl.includes("maps.google")) {
            document.querySelector('.scan-line')?.style.display = 'block';
            document.querySelector('.map-overlay-barrier')?.style.display = 'block';
            const zoomControls = document.querySelector('.zoom-controls');
            if (zoomControls) {
                zoomControls.style.display = 'flex';
                const zMatch = embedUrl.match(/z=(\d+)/);
                const currentZoom = zMatch ? zMatch[1] : '16';
                updateZoomLevel(currentZoom, false); // Sadece arayüzü güncelle, haritayı yeniden yükleme
            }
        }
    }
    // --- NORMAL RESİM MODU ---
    else {
        const mapImg = document.getElementById('active-map');
        mapImg.style.display = "block";
        mapImg.src = cmsContent || `assets/img/soru${gorev}.jpg`;

        const hideLoader = () => { if (loader) loader.style.display = 'none'; };
        mapImg.onload = hideLoader;
        setTimeout(hideLoader, 5000);
    }
}

// --- LEAFLET HARİTA BAŞLATICI ---
function initLeafletMap(coords) {
    // Harita konteynerini bul veya oluştur
    let container = document.getElementById('leaflet-map-container');
    if (!container) {
        const frame = document.querySelector('.map-frame');
        container = document.createElement('div');
        container.id = 'leaflet-map-container';
        frame.appendChild(container);
    }
    container.style.display = 'block';

    // Harita zaten varsa temizle (tekrar render sorunu olmaması için)
    if (leafletMap) leafletMap.remove();

    // Haritayı başlat
    leafletMap = L.map('leaflet-map-container', {
        zoomControl: false, // Özel zoom butonları kullanıyoruz
        attributionControl: false
    });

    // OpenStreetMap Katmanı (Veya Google Hibrit eklenebilir)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(leafletMap);

    // --- FIT BOUNDS: Haritayı verilen koordinatlara tam oturt ---
    // coords: [lat1, lon1, lat2, lon2] -> [[lat1, lon1], [lat2, lon2]]
    const southWest = L.latLng(parseFloat(coords[0]), parseFloat(coords[1]));
    const northEast = L.latLng(parseFloat(coords[2]), parseFloat(coords[3]));
    const bounds = L.latLngBounds(southWest, northEast);

    leafletMap.fitBounds(bounds);

    // --- ADMIN ARAÇLARI: Çizim Yaparak Koordinat Alma ---
    // Sadece konsolda görünür, oyuncuyu etkilemez.
    if (typeof L.Control.Draw !== 'undefined') {
        const drawControl = new L.Control.Draw({
            draw: {
                polygon: false, marker: false, circle: false, circlemarker: false, polyline: false,
                rectangle: { shapeOptions: { color: '#39FF14' } } // Neon Yeşil Çerçeve
            },
            edit: false
        });
        leafletMap.addControl(drawControl);

        leafletMap.on('draw:created', function (e) {
            const layer = e.layer;
            const b = layer.getBounds();
            // Veritabanı formatını konsola yaz
            console.log(`%c[VERİTABANI KODU]: leaflet:${b.getSouthWest().lat},${b.getSouthWest().lng},${b.getNorthEast().lat},${b.getNorthEast().lng}`, "color: #39FF14; font-size: 16px; background: #000; padding: 10px;");
            leafletMap.addLayer(layer);
        });
    }
}

// --- ZOOM KONTROL MEKANİZMASI ---
const zoomSliderElement = document.getElementById('zoom-slider');
const mouseSliderElement = document.getElementById('mouse-zoom-slider');
const zoomValueDisplayElement = document.getElementById('zoom-value');
const mouseZoomValueDisplayElement = document.getElementById('mouse-zoom-value');
const mapFrameElement = document.querySelector('.map-frame');

let zoomDebounceTimer = null; // Gecikme zamanlayıcısı

// Ortak Zoom Güncelleme Fonksiyonu
function updateZoomLevel(newVal, triggerReload = true) {
    // Değer sınırlarını kontrol et (8-20 arası)
    let val = parseInt(newVal);
    if (val < 8) val = 8;
    if (val > 20) val = 20;

    // Arayüzü güncelle (Hemen tepki ver)
    // Bu elemanlar opsiyonel olabilir, varlıklarını kontrol et
    if (zoomSliderElement) zoomSliderElement.value = val;
    if (mouseSliderElement) mouseSliderElement.value = val;
    if (zoomValueDisplayElement) zoomValueDisplayElement.textContent = `${val}x`;
    if (mouseZoomValueDisplayElement) mouseZoomValueDisplayElement.textContent = `${val}x`;

    // Iframe'i güncelle (Gecikmeli - Debounce)
    // Eğer kullanıcı hala zoom yapıyorsa önceki işlemi iptal et
    if (!triggerReload) return;

    if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer);
    
    // Kullanıcı durduktan 300ms sonra haritayı yenile
    zoomDebounceTimer = setTimeout(() => {
        const iframe = document.getElementById('active-frame');
        if (iframe && iframe.src && iframe.style.display !== 'none') {
            let url = iframe.src;
            if (url.includes('z=')) {
                url = url.replace(/z=\d+/, `z=${val}`);
            } else {
                url += `&z=${val}`;
            }
            // Sadece URL değiştiyse güncelle (Gereksiz reload önleme)
            if (iframe.src !== url) iframe.src = url;
        }
    }, 300);
}

if (zoomSliderElement && zoomValueDisplayElement) {
    // 'input' olayı, fareyi kaydırırken anlık güncelleme yapar
    zoomSliderElement.addEventListener('input', (e) => {
        updateZoomLevel(e.target.value);
    });
}

// Mouse Wheel (Tekerlek) Dinleyicisi
if (mapFrameElement) {
    mapFrameElement.addEventListener('wheel', (e) => {
        // Sadece harita aktifse çalış
        const iframe = document.getElementById('active-frame');
        if (!iframe || iframe.style.display === 'none') return;

        e.preventDefault(); // Sayfa kaydırmayı engelle

        // Mevcut zoom değerini al
        let currentZoom = parseInt(zoomSliderElement ? zoomSliderElement.value : 11);
        
        // Yönü belirle (Aşağı yuvarlama: Uzaklaş, Yukarı yuvarlama: Yakınlaş)
        if (e.deltaY > 0) {
            updateZoomLevel(currentZoom - 1);
        } else {
            updateZoomLevel(currentZoom + 1);
        }
    }, { passive: false });
}

onValue(ref(db, 'gameContent/missions'), (snapshot) => {
    const isInitialLoad = globalMissionData === null;
    globalMissionData = snapshot.val() || {};
    console.log("[CMS]: Oyun içeriği güncellendi.");
    // Veri geldiği anda görseli yenile (Gecikme sorununu çözer)
    updateMapVisuals(currentGorevNo);

    // Eğer bu, sayfa yüklendikten sonra verinin ilk gelişi ise,
    // brifing muhtemelen geçici bir metinle ("...indiriliyor") gösterilmiştir.
    // Şimdi gerçek verilerle brifingi yeniden tetikleyerek doğru metnin gösterilmesini sağlıyoruz.
    if (isInitialLoad && currentGorevNo > 0) {
        lastGorevNo = 0; // Brifingin yeniden çalışmasını sağlamak için sıfırla
        triggerBriefing(currentGorevNo);
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
                        <h2 style="font-size:1.2rem; border-bottom:1px solid #00ff41; padding-bottom:8px; margin:0;">📊 PROFİL LABORATUVARI</h2>
                        <button onclick="window.open('https://www.heywhatsthat.com/profiler.html', '_blank')" style="background:#00ff41; color:#000; font-weight:bold; cursor:pointer; padding:10px; border:none;">PROFİL OLUŞTURMA GÖREVİNİ YAP</button>
                        <button onclick="window.open('assets/video/10_gorev.mp4', '_blank')" style="background:rgba(0,40,0,0.8); color:#00ff41; border:1px solid #00ff41; font-weight:bold; cursor:pointer; padding:10px;">🎥 EĞİTİM VİDEOSUNU İZLE</button>
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
        currentGorevNo = gorev; // Global değişkeni güncelle
        const bolge = data.bolge || "2A";
        
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev > 10 ? 'BİTTİ' : gorev + '. Görev'} ${bolge}`;
        
        // Görseli güncelle (Merkezi fonksiyon kullanımı)
        updateMapVisuals(gorev);
        
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

    // Veri güvenliği: CMS verisi henüz yüklenmediyse işlem yapma
    if (!globalMissionData) {
        return logBox("SİSTEM: Oyun verileri yükleniyor, lütfen bekleyin...", "warning");
    }

    if (cur >= 10) return logBox("Lütfen analizi görsel paneldeki butonlar ile tamamlayın.", "warning");

    const rawInput = document.getElementById('kripto-val').value.trim().toLocaleLowerCase('tr').replace(/\s/g, "");
    
    // CMS'den gelen doğru cevapları al
    const correctAnswersRaw = globalMissionData[cur]?.answers || "";
    const requireAll = globalMissionData[cur]?.requireAll || false; // Kombinasyon modu açık mı?

    // Virgülle ayrılmış cevapları diziye çevir ve temizle
    const correctAnswers = correctAnswersRaw.split(',')
        .map(a => a.trim().toLocaleLowerCase('tr').replace(/\s/g, ""))
        .filter(a => a.length > 0); // Boş cevapları ("") temizle

    // Eğer CMS'de hiç cevap tanımlanmamışsa, boş girişi doğru kabul etme.
    if (correctAnswers.length === 0) return logBox("HATA: Bu görev için cevap anahtarı bulunamadı.", "warning");

    let isCorrect = false;
    
    if (requireAll) {
        // SIRALI KOMBİNASYON MODU: Kelimeler hem var olmalı hem de sırayla gelmeli.
        let lastIndex = -1;
        let sequenceMatch = true;

        for (const ans of correctAnswers) {
            // Bir önceki kelimenin bittiği yerden sonrasını ara
            const idx = rawInput.indexOf(ans, lastIndex + 1);
            if (idx === -1) {
                sequenceMatch = false;
                break;
            }
            lastIndex = idx;
        }

        if (sequenceMatch && correctAnswers.length > 0) {
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