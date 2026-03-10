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

// Hata 4: Takım adı yoksa işlemi durdur ve kullanıcıyı bilgilendir.
if (!teamName) {
    document.body.innerHTML = '<div style="color:red; text-align:center; padding: 50px; font-size: 1.2rem;">HATA: Takım adı belirtilmemiş. Lütfen giriş ekranından bir takım seçin.</div>';
    throw new Error("Takım adı URL'de eksik.");
}

const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');
let leafletMap = null; // Leaflet harita örneği için global değişken
// Hata 7: Harita yükleme zaman aşımı için referans.
let mapLoadTimeout = null;

// --- 1. İÇERİK YÖNETİMİ (CMS ENTEGRASYONU) ---
// Sorular ve İpuçları artık Firebase 'gameContent/missions' düğümünden çekiliyor.
let globalMissionData = null; // Veri yüklenene kadar null
let currentGorevNo = 1; // Anlık görev numarasını takip etmek için
let lastGorevNo = 0; // Brifing takibi için (Hoisting hatasını önlemek için yukarı taşındı)

// Hata 8: CMS verisi (görevler) çekilirken varlık kontrolü ekle.
onValue(ref(db, 'gameContent/missions'), (snapshot) => {
    if (snapshot.exists()) {
        globalMissionData = snapshot.val();
        // Veri yüklendikten sonra mevcut görev için görselleri tetikle
        updateMapVisuals(currentGorevNo);
    } else {
        console.error("Kritik Hata: Görev içerikleri (missions) veritabanında bulunamadı!");
        logBox("SİSTEM HATASI: Görev verileri yüklenemedi. Lütfen karargah ile iletişime geçin.", "warning");
    }
});

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
    // Hata 7: Fonksiyon her çalıştığında önceki zaman aşımını temizle.
    if (mapLoadTimeout) clearTimeout(mapLoadTimeout);

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

    const normalizeMapUrl = (rawUrl) => {
        if (!rawUrl) return rawUrl;

        let url = rawUrl.trim();

        // Kullanıcı iframe kodu yapıştırmışsa src değerini çek.
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
        const isGoogleMapUrl =
            /(^|\.)google\.[^/]+$/i.test(host) ||
            host.startsWith('maps.google.') ||
            host === 'maps.app.goo.gl' ||
            (host === 'goo.gl' && path.startsWith('/maps'));

        if (isUmapUrl) return parsed.toString();
        if (!isGoogleMapUrl) return url;

        // My Maps linkleri (/maps/d/...)
        if (path.includes('/maps/d/')) {
            const myMaps = new URL(parsed.toString());
            myMaps.pathname = myMaps.pathname.replace('/edit', '/embed').replace('/viewer', '/embed').replace('/view', '/embed');
            return myMaps.toString();
        }

        // Zaten embed ise olduğu gibi kullan.
        if (path.includes('/maps/embed')) {
            return parsed.toString();
        }

        // Güvenli ve her yerde çalışacak tek format: /maps?output=embed&q=...
        let q = parsed.searchParams.get('q') || '';

        if (!q) {
            const placeMatch = path.match(/\/place\/([^/]+)/i);
            if (placeMatch && placeMatch[1]) {
                q = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim();
            }
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
    else if (cmsContent && (/(google\.[^/]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|umap\.openstreetmap\.fr)/i.test(cmsContent))) {
        const embedUrl = normalizeMapUrl(cmsContent);

        const mapFrame = document.getElementById('active-frame');
        mapFrame.style.display = "block";

        // URL değiştiyse yükle, aynıysa sadece loader'ı kapat (Sonsuz döngü önlemi)
        if (mapFrame.src !== embedUrl) {
            const hideLoader = () => { if (loader) loader.style.display = 'none'; };
            mapFrame.onload = hideLoader;
            mapFrame.src = embedUrl; 
            mapLoadTimeout = setTimeout(hideLoader, 5000); // Hata 7: Zaman aşımı referansını sakla.
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
                updateZoomLevel(currentZoom, false); // Sadece arayüzü güncelle, haritayı yeniden yükleme
            }
        }
@@ -523,26 +576,26 @@ document.getElementById('btn-verify').addEventListener('click', async () => {
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
        const nextGorevNo = cur + 1;
        const nextPuan = (data.puan || 1000) + 200;
        // Hata 9: Hatalı bölge ("2J") ataması düzeltildi. Bölge dinamik olarak hesaplanıyor (2A, 2B, 2C...).
        // A=65. Görev 2 için -> 65 + 2 - 1 = 66 -> 'B'.
        const nextBolge = nextGorevNo > 10 ? "TAMAMLANDI" : `2${String.fromCharCode(65 + nextGorevNo - 1)}`;

        update(scoreRef, { gorevNo: nextGorevNo, bolge: nextBolge, puan: nextPuan, durum: "Başarılı Analiz", ipucuSayisi: 0 });
        logBox("VERİ DOĞRULANDI!", "success");
    } else {
        const hCount = (data.hataSayisi || 0) + 1;
        const newPuan = (data.puan || 1000) - 50; // Hatalı cevapta puan düşür.
        update(scoreRef, { durum: "Hatalı Analiz Girişi", hataSayisi: hCount, puan: newPuan });
        logBox("HATA: Analiz verisi geçersiz. (-50 Puan)", "warning");
    }
    document.getElementById('kripto-val').value = "";
});

// Hata 1: Eksik `updateZoomLevel` fonksiyonu tanımlandı.
/**
 * Harita zoom seviyesini ve ilgili UI bileşenlerini günceller.
 * @param {string|number} level - Yeni zoom seviyesi.
 * @param {boolean} reloadMap - Haritanın yeni zoom seviyesiyle yeniden yüklenip yüklenmeyeceği.
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

// Hata 2: Zoom slider'ı için eksik olay dinleyicileri eklendi.
const zoomSlider = document.getElementById('zoom-slider');
if (zoomSlider) {
    // Kaydırma sırasında sadece değeri anlık güncelle
    zoomSlider.addEventListener('input', (e) => {
        updateZoomLevel(e.target.value, false);
    });
    // Kullanıcı kaydırmayı bitirdiğinde haritayı yeni zoom ile yeniden yükle
    zoomSlider.addEventListener('change', (e) => {
        updateZoomLevel(e.target.value, true);
    });
}
