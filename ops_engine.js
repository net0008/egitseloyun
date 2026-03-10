/* *****************************************************************************
 * ops_engine.js - Sürüm: v3.6.0 (Tam Onarım)                                  *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Görev 1-10 Tam Entegrasyon | Bergama-Dikili Final Raporu & AI Motoru       *
 * *************************************************************************** *
 * Bu modül, Firebase Realtime Database üzerinden saha ve karargah arasındaki *
 * senkronizasyonu yönetir. Hata ve İpucu sayıları anlık olarak mühürlenir.   *
 * *************************************************************************** */

import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

// --- 0. BAĞLANTI PARAMETRELERİ VE SABİTLER ---
const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");

if (!teamName) {
    document.body.innerHTML = '<div style="color:red; text-align:center; padding: 50px; font-size: 1.2rem;">HATA: Takım adı belirtilmemiş. Lütfen giriş ekranından bir takım seçin.</div>';
    throw new Error("Takım adı URL'de eksik.");
}

const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');
let leafletMap = null;
let mapLoadTimeout = null;

// --- 1. İÇERİK YÖNETİMİ (CMS ENTEGRASYONU) ---
let globalMissionData = null;
let currentGorevNo = 1;
let lastGorevNo = 0;

onValue(ref(db, 'gameContent/missions'), (snapshot) => {
    if (snapshot.exists()) {
        globalMissionData = snapshot.val();
        console.log("Görev verisi Firebase'den güncellendi.");
        
        // Eğer oyun zaten başlamışsa (lastGorevNo > 0), mevcut görevin
        // görsellerini ve metnini yeni gelen veriyle yenile.
        if (lastGorevNo > 0) {
            console.log(`CMS güncellemesi algılandı. Görev ${currentGorevNo} için arayüz yenileniyor.`);
            updateMapVisuals(currentGorevNo);
            triggerBriefing(currentGorevNo, true);
        }
    } else {
        console.error("Kritik Hata: Görev içerikleri (missions) veritabanında bulunamadı!");
        logBox("SİSTEM HATASI: Görev verileri yüklenemedi. Lütfen karargah ile iletişime geçin.", "warning");
    }
});

// --- 2. GÖRSELLEŞTİRME MOTORU ---

/**
 * CMS'den gelen URL'yi standart bir embed formatına dönüştürür.
 * @param {string} rawUrl - Ham URL
 * @returns {string} - Gömülebilir URL
 */
const normalizeMapUrl = (rawUrl) => {
    if (!rawUrl) return rawUrl;
    let url = rawUrl.trim();
    if (url.startsWith('<iframe')) {
        const srcMatch = url.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) url = srcMatch[1];
    }
    if (url.startsWith('//')) url = `https:${url}`;
    let parsed;
    try {
        parsed = new URL(url);
    } catch (_err) {
        return url;
    }
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;
    const isUmapUrl = host.includes('umap.openstreetmap.fr');
    if (isUmapUrl) return parsed.toString();
    
    const isGoogleMapUrl = /(^|\.)google\.[^/]+$/i.test(host) || host.startsWith('maps.google.') || host === 'maps.app.goo.gl' || (host === 'goo.gl' && path.startsWith('/maps'));
    if (!isGoogleMapUrl) return url;

    if (path.includes('/maps/d/')) {
        const myMaps = new URL(parsed.toString());
        myMaps.pathname = myMaps.pathname.replace('/edit', '/embed').replace('/viewer', '/embed').replace('/view', '/embed');
        return myMaps.toString();
    }
    if (path.includes('/maps/embed')) {
        return parsed.toString();
    }
    let q = parsed.searchParams.get('q') || '';
    if (!q) {
        const placeMatch = path.match(/\/place\/([^/]+)/i);
        if (placeMatch && placeMatch[1]) q = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim();
    }
    if (!q) {
        const atMatch = parsed.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
        if (atMatch) q = `${atMatch[1]},${atMatch[2]}`;
    }
    if (!q) {
        q = parsed.searchParams.get('ll') || parsed.searchParams.get('query') || parsed.searchParams.get('destination') || url;
    }
    const embed = new URL('https://www.google.com/maps');
    embed.searchParams.set('output', 'embed');
    embed.searchParams.set('q', q);
    if (!embed.searchParams.has('t')) embed.searchParams.set('t', 'k');
    if (!embed.searchParams.has('z')) embed.searchParams.set('z', '11');
    return embed.toString();
};

function resetMapState() {
    const elements = {
        mapImg: document.getElementById('active-map'),
        mapFrame: document.getElementById('active-frame'),
        scanLine: document.querySelector('.scan-line'),
        mapOverlayBarrier: document.querySelector('.map-overlay-barrier'),
        zoomControls: document.querySelector('.zoom-controls'),
        leafletContainer: document.getElementById('leaflet-map-container'),
    };
    const rawIframeWrapper = document.getElementById('raw-iframe-temp');
    if (rawIframeWrapper) rawIframeWrapper.remove();
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    Object.values(elements).forEach(el => {
        if (el) el.style.display = 'none';
    });
}

function updateMapVisuals(gorev) {
    if (mapLoadTimeout) clearTimeout(mapLoadTimeout);
    if (globalMissionData === null) return;
    
    const loader = document.getElementById('map-loader');
    if (loader) loader.style.display = 'flex';

    resetMapState();
        
    if (gorev > 10) { // Görev 10'dan sonra harita alanı boş kalır.
        if (loader) loader.style.display = 'none';
        logBox("TÜM GÖREVLER TAMAMLANDI. KARARGAHA RAPOR VERİN.", "success");
        return;
    }

    const cmsContent = globalMissionData[gorev]?.image?.trim();
    if (!cmsContent) {
        if (loader) loader.style.display = 'none';
        return; // İçerik yoksa hiçbir şey gösterme
    }

    // --- RAW IFRAME MODU ---
    if (cmsContent.startsWith("<iframe")) {
        const mapContentWrapper = document.getElementById('map-content-wrapper');
        const rawDiv = document.createElement('div');
        rawDiv.id = 'raw-iframe-temp';
        rawDiv.style.cssText = 'width: 100%; height: 100%; position: relative; z-index: 15;';
        const fixedContent = cmsContent.replace(/src=(["'])\/\//g, 'src=$1https://');
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
    else if (cmsContent.startsWith("leaflet:")) {
        const coords = cmsContent.replace("leaflet:", "").split(",");
        if (coords.length >= 2) { // En az lat, lng olmalı
            initLeafletMap(coords);
        }
        if (loader) loader.style.display = 'none';
    }
    // --- URL MODU (UMAP / Google Maps) ---
    else if (/(google\.[^/]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|umap\.openstreetmap\.fr)/i.test(cmsContent)) {
        let embedUrl = normalizeMapUrl(cmsContent);
        if (embedUrl.startsWith("http:")) embedUrl = embedUrl.replace("http:", "https:");

        const mapFrame = document.getElementById('active-frame');
        mapFrame.style.display = "block";
        mapFrame.style.zIndex = "15";

        if (mapFrame.src !== embedUrl) {
            const hideLoader = () => { if (loader) loader.style.display = 'none'; };
            mapFrame.onload = hideLoader;
            mapFrame.src = embedUrl; 
            mapLoadTimeout = setTimeout(hideLoader, 5000);
        } else {
            if (loader) loader.style.display = 'none';
        }

        if (embedUrl.includes("google.com/maps")) {
            document.querySelector('.scan-line')?.style.display = 'block';
            document.querySelector('.map-overlay-barrier')?.style.display = 'block';
            const zoomControls = document.querySelector('.zoom-controls');
            if (zoomControls) {
                zoomControls.style.display = 'flex';
                const zMatch = embedUrl.match(/z=(\d+)/);
                const currentZoom = zMatch ? zMatch[1] : '11';
                updateZoomLevel(currentZoom, false);
            }
        }
    }
    // --- NORMAL RESİM MODU ---
    else {
        const mapImg = document.getElementById('active-map');
        mapImg.style.display = 'block';
        if (mapImg.src !== cmsContent) {
            mapImg.src = cmsContent;
        }
        if (loader) loader.style.display = 'none';
    }
}

// --- 3. UI GÜNCELLEME VE YARDIMCI FONKSİYONLAR ---

/**
 * Terminale formatlı mesaj yazar.
 * @param {string} message - Yazılacak mesaj.
 * @param {string} type - Mesaj tipi (system, briefing, success, warning, hint).
 */
function logBox(message, type = 'system') {
    if (!terminal) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `terminal-msg ${type}`;
    
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const span = document.createElement('span');
    span.textContent = `[${timestamp}] `;
    msgDiv.appendChild(span);
    msgDiv.appendChild(document.createTextNode(message));

    terminal.appendChild(msgDiv);
    terminal.scrollTop = terminal.scrollHeight;
}

/**
 * Skor, sektör ve yıldızları günceller.
 * @param {object} data - Firebase'den gelen skor verisi.
 */
function updateScoreDisplay(data) {
    document.getElementById('current-score').innerText = data.puan || 1000;
    document.getElementById('current-sector').innerText = `${data.gorevNo || 1}. Görev ${data.bolge || '2A'} Bölgesi`;
    
    const starContainer = document.getElementById('star-container');
    if (starContainer) {
        const stars = Math.min(5, Math.ceil((data.gorevNo || 1) / 2));
        let starHTML = '';
        for(let i=0; i<5; i++) {
            starHTML += `<span class="star ${i < stars ? 'filled' : ''}">★</span>`;
        }
        starContainer.innerHTML = starHTML;
    }
}

/**
 * Görev brifingini terminale yazar.
 * @param {number} gorevNo - Aktif görev numarası.
 * @param {boolean} [force=false] - Aynı görev olsa bile yeniden yazdırmaya zorlar.
 */
function triggerBriefing(gorevNo, force = false) {
    if ((!force && lastGorevNo === gorevNo) || !globalMissionData) return;
    lastGorevNo = gorevNo;
    
    const mission = globalMissionData[gorevNo];
    if (gorevNo > 10) {
        logBox("TÜM GÖREVLER TAMAMLANDI. KARARGAHA RAPOR VERİN.", "success");
        return;
    }
    const text = mission ? mission.question : "Görev verisi bekleniyor...";
    logBox(`GÖREV ${gorevNo} BRİFİNGİ: ${text}`, "briefing");
}

/**
 * Leaflet haritasını başlatır.
 * @param {string[]} coords - [lat, lng, zoom, markerLat, markerLng]
 */
function initLeafletMap(coords) {
    const mapContainer = document.getElementById('leaflet-map-container');
    if (!mapContainer || !window.L) return;
    
    mapContainer.style.display = 'block';
    if (leafletMap) leafletMap.remove();
    
    const lat = parseFloat(coords[0]);
    const lng = parseFloat(coords[1]);
    const zoom = parseInt(coords[2]) || 13;
    
    leafletMap = L.map(mapContainer).setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);

    if (coords.length >= 4) {
        const markerLat = parseFloat(coords[3]);
        const markerLng = parseFloat(coords[4] || coords[1]); // 5. parametre yoksa 2.yi kullan
        L.marker([markerLat, markerLng]).addTo(leafletMap);
    }
}

/**
 * Harita zoom seviyesini ve UI'ı günceller.
 * @param {string|number} level - Yeni zoom seviyesi.
 * @param {boolean} reloadMap - Haritayı yeniden yükle.
 */
function updateZoomLevel(level, reloadMap = false) {
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValueDisplay = document.getElementById('zoom-value');
    if (zoomSlider && zoomValueDisplay) {
        zoomSlider.value = level;
        zoomValueDisplay.textContent = `${level}x`;
    }

    if (reloadMap) {
        const mapFrame = document.getElementById('active-frame');
        if (mapFrame && mapFrame.src && mapFrame.src.includes('google.com')) {
            try {
                const url = new URL(mapFrame.src);
                url.searchParams.set('z', level);
                if (mapFrame.src !== url.toString()) {
                    const loader = document.getElementById('map-loader');
                    if (loader) loader.style.display = 'flex';
                    mapFrame.src = url.toString();
                }
            } catch (e) {
                console.error("Zoom URL güncelleme hatası:", e);
            }
        }
    }
}

// --- 4. ETKİLEŞİM VE OYUN MANTIĞI ---

/**
 * Skor verisi güncellendiğinde tetiklenir.
 * @param {object} snapshot - Firebase snapshot.
 */
function handleScoreUpdate(snapshot) {
    const data = snapshot.val();
    if (data) {
        // Takım bağlandığında veya sinyal beklerken durumu "Bağlantı Kuruldu" olarak güncelle.
        // Bu, karargah ekranına anlık bilgi verir.
        if (data.durum === "Bağlantı Bekleniyor" || data.durum === "Sinyal Bekleniyor") {
            update(scoreRef, { durum: "Bağlantı Kuruldu" });
        }
        currentGorevNo = data.gorevNo || 1;
        updateScoreDisplay(data);
        updateMapVisuals(currentGorevNo);
        triggerBriefing(currentGorevNo);
    }
}

// Skorları dinle ve UI güncelle
onValue(scoreRef, handleScoreUpdate);

// Buton: İpucu
document.getElementById('btn-hint')?.addEventListener('click', async () => {
    const snapshot = await get(scoreRef);
    const data = snapshot.val() || {};
    const mission = globalMissionData ? globalMissionData[currentGorevNo] : null;
    
    if (!mission || !mission.hints) {
        logBox("Bu görev için ipucu bulunmuyor.", "warning");
        return;
    }
    
    const hints = mission.hints.split('\n').filter(h => h.trim() !== '');
    const usedHints = data.ipucuSayisi || 0;
    
    if (usedHints < hints.length) {
        const hintText = hints[usedHints];
        logBox(`İPUCU: ${hintText}`, "hint");
        update(scoreRef, { 
            ipucuSayisi: usedHints + 1,
            puan: (data.puan || 1000) - 50,
            durum: `İpucu Alındı (${usedHints + 1})`
        });
    } else {
        logBox("Tüm ipuçları zaten alındı.", "warning");
    }
});

// Buton: Onayla (Cevap Kontrol)
document.getElementById('btn-verify')?.addEventListener('click', async () => {
    const inputEl = document.getElementById('kripto-val');
    const rawInput = inputEl.value.trim();
    if (!rawInput) return;

    const snapshot = await get(scoreRef);
    const data = snapshot.val() || {};
    const cur = data.gorevNo || 1;
    const mission = globalMissionData ? globalMissionData[cur] : null;

    if (!mission) {
        logBox("Görev verisi yüklenemedi, cevap kontrol edilemiyor.", "warning");
        return;
    }

    const correctAnswers = (mission.answers || "").split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    const userInput = rawInput.toLowerCase();
    let isCorrect = false;

    if (mission.requireAll) {
        // SIRALI KOMBİNASYON MODU: Tüm cevaplar doğru sırada geçmeli.
        let lastIndex = -1;
        let sequenceMatch = true;
        for (const answer of correctAnswers) {
            const idx = userInput.indexOf(answer, lastIndex + 1);
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
        // STANDART MOD: Cevaplardan herhangi biri tam eşleşirse doğru.
        if (correctAnswers.includes(userInput)) {
            isCorrect = true;
        }
    }

    if (isCorrect) {
        const nextGorevNo = cur + 1;
        const nextPuan = (data.puan || 1000) + 200;
        const nextBolge = nextGorevNo > 10 ? "TAMAMLANDI" : `2${String.fromCharCode(65 + nextGorevNo - 1)}`;

        update(scoreRef, { 
            gorevNo: nextGorevNo, 
            bolge: nextBolge, 
            puan: nextPuan, 
            durum: "Başarılı Analiz", 
            ipucuSayisi: 0,
            hataSayisi: 0
        });
        logBox("VERİ DOĞRULANDI! Bir sonraki göreve geçiliyor...", "success");
    } else {
        const hCount = (data.hataSayisi || 0) + 1;
        const newPuan = (data.puan || 1000) - 50;
        update(scoreRef, { durum: "Hatalı Analiz Girişi", hataSayisi: hCount, puan: newPuan });
        logBox("HATA: Analiz verisi geçersiz. (-50 Puan)", "warning");
    }
    inputEl.value = "";
});

// Zoom slider'ı için olay dinleyicileri
const zoomSlider = document.getElementById('zoom-slider');
if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => updateZoomLevel(e.target.value, false));
    zoomSlider.addEventListener('change', (e) => updateZoomLevel(e.target.value, true));
}

// Takım adını ekrana yazdır
const teamNameDisplay = document.getElementById('team-name-display');
if (teamNameDisplay) {
    teamNameDisplay.textContent = `UYDU ANALİZİ: ${teamName}`;
}
