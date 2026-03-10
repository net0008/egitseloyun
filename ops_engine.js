/* *****************************************************************************
 * ops_engine.js - Sürüm: v4.0.0 (Kararlı Birleştirilmiş Sürüm)                *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * CMS ve Karargah Senkronizasyon Protokolü Onarıldı.                         *
 * *************************************************************************** *
 * Bu modül, Firebase Realtime Database üzerinden saha ve karargah arasındaki *
 * senkronizasyonu yönetir. Hata ve İpucu sayıları anlık olarak mühürlenir.   *
 * *************************************************************************** */

import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

// --- 0. BAĞLANTI PARAMETRELERİ VE SABİTLER ---
// URL üzerinden gelen takım ismini yakalayarak veri tünelini aktif eder.
const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
if (!teamName) {
    document.body.innerHTML = '<h1>HATA: Takım adı URL\'de belirtilmemiş! Lütfen giriş ekranına dönün.</h1>';
    throw new Error("Takım adı URL'de eksik.");
}

const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const missionsRef = ref(db, 'gameContent/missions');
const terminal = document.getElementById('terminal-output');

// Veri Önbellekleri
let globalMissionData = null;
let teamScoreData = null;

// Durum Değişkenleri
let currentGorevNo = 1;
let lastGorevNo = 0;
let mapLoadTimeout = null;

// --- 1. GÖRSELLEŞTİRME VE ARAYÜZ YÖNETİMİ ---

function logBox(message, type = 'system') {
    if (!terminal) return;
    const div = document.createElement('div');
    div.className = `terminal-msg ${type}`;
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const span = document.createElement('span');
    span.textContent = `[${timestamp}] `;
    div.appendChild(span);
    div.appendChild(document.createTextNode(message));
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

function updateScoreDisplay(data) {
    if (!data) return;
    document.getElementById('current-score').innerText = data.puan || 1000;
    document.getElementById('current-sector').innerText = `${data.gorevNo || 1}. Görev ${data.bolge || '2A'} Bölgesi`;
    const starContainer = document.getElementById('star-container');
    if (starContainer) {
        const stars = Math.min(5, Math.ceil((data.gorevNo || 1) / 2));
        let starHTML = '';
        for (let i = 0; i < 5; i++) {
            starHTML += `<span class="star ${i < stars ? 'filled' : ''}">★</span>`;
        }
        starContainer.innerHTML = starHTML;
    }
}

function resetMapState() {
    const elements = {
        mapImg: document.getElementById('active-map'),
        mapFrame: document.getElementById('active-frame'),
        scanLine: document.querySelector('.scan-line'),
        mapOverlayBarrier: document.querySelector('.map-overlay-barrier'),
        zoomControls: document.querySelector('.zoom-controls'),
    };
    const rawIframeWrapper = document.getElementById('raw-iframe-temp');
    if (rawIframeWrapper) rawIframeWrapper.remove();
    Object.values(elements).forEach(el => {
        if (el) el.style.display = 'none';
    });
}

function updateMapVisuals(gorevNo) {
    if (mapLoadTimeout) clearTimeout(mapLoadTimeout);
    if (!globalMissionData) return;

    const loader = document.getElementById('map-loader');
    if (loader) loader.style.display = 'flex';

    resetMapState();

    if (gorevNo > 10) {
        if (loader) loader.style.display = 'none';
        return;
    }

    const cmsContent = globalMissionData[gorevNo]?.image?.trim();
    if (!cmsContent) {
        if (loader) loader.style.display = 'none';
        return;
    }

    // RAW IFRAME MODU
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
    // URL MODU (UMAP / Google Maps)
    else if (/(google\.[^/]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|umap\.openstreetmap\.fr)/i.test(cmsContent)) {
        let embedUrl = cmsContent;
        if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
        
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
    }
    // NORMAL RESİM MODU
    else {
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            mapImg.style.display = 'block';
            if (mapImg.src !== cmsContent) {
                mapImg.src = cmsContent;
            }
        }
        if (loader) loader.style.display = 'none';
    }
}

function triggerBriefing(gorevNo) {
    if (lastGorevNo === gorevNo || !globalMissionData) return;

    if (lastGorevNo !== gorevNo) {
        if(terminal) terminal.innerHTML = "";
        logBox("Yeni görev verisi alınıyor...", "system");
    }
    lastGorevNo = gorevNo;

    const mission = globalMissionData[gorevNo];
    if (!mission) {
        logBox(`HATA: Görev ${gorevNo} için içerik bulunamadı.`, "warning");
        return;
    }
    
    const text = mission.question || "Görev brifingi bekleniyor...";
    logBox(`GÖREV ${gorevNo} BRİFİNGİ: ${text}`, "briefing");
}

// --- 2. ETKİLEŞİM VE OYUN MANTIĞI ---

document.getElementById('btn-hint')?.addEventListener('click', async () => {
    if (!teamScoreData || !globalMissionData) return;
    
    const currentGorev = teamScoreData.gorevNo || 1;
    const mission = globalMissionData[currentGorev];
    if (!mission || !mission.hints) {
        logBox("Bu görev için ipucu bulunmuyor.", "warning");
        return;
    }

    const hints = mission.hints.split('\n').filter(h => h.trim() !== '');
    const usedHints = teamScoreData.ipucuSayisi || 0;

    if (usedHints < hints.length) {
        const hintText = hints[usedHints];
        logBox(`İPUCU: ${hintText}`, "hint");
        update(scoreRef, {
            ipucuSayisi: usedHints + 1,
            puan: (teamScoreData.puan || 1000) - 50,
            durum: `İpucu Alındı (${usedHints + 1})`
        });
    } else {
        logBox("Tüm ipuçları zaten alındı.", "warning");
    }
});

document.getElementById('btn-verify')?.addEventListener('click', async () => {
    const inputEl = document.getElementById('kripto-val');
    const rawInput = inputEl.value.trim();
    if (!rawInput) return;

    if (!teamScoreData || !globalMissionData) {
        logBox("Sistem verileri henüz hazır değil, lütfen bekleyin.", "warning");
        return;
    }

    const cur = teamScoreData.gorevNo || 1;
    const mission = globalMissionData[cur];
    if (!mission) {
        logBox("Görev verisi yüklenemedi, cevap kontrol edilemiyor.", "warning");
        return;
    }

    const correctAnswers = (mission.answers || "").split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    const userInput = rawInput.toLowerCase();
    let isCorrect = false;

    if (mission.requireAll) {
        // SIRALI KOMBİNASYON MODU
        let lastIndex = -1;
        isCorrect = correctAnswers.every(answer => {
            const idx = userInput.indexOf(answer, lastIndex + 1);
            if (idx === -1) return false;
            lastIndex = idx;
            return true;
        });
    } else {
        // STANDART MOD: Cevaplardan herhangi biri kullanıcı girdisinde geçiyorsa.
        isCorrect = correctAnswers.some(answer => userInput.includes(answer));
    }

    if (isCorrect) {
        const nextGorevNo = cur + 1;
        const nextPuan = (teamScoreData.puan || 1000) + 200;
        const nextBolge = nextGorevNo > 10 ? "TAMAMLANDI" : `2${String.fromCharCode(65 + nextGorevNo - 1)}`;
        update(scoreRef, {
            gorevNo: nextGorevNo,
            bolge: nextBolge,
            puan: nextPuan,
            durum: "Başarılı Analiz",
            ipucuSayisi: 0
        });
        logBox("VERİ DOĞRULANDI! Bir sonraki göreve geçiliyor...", "success");
    } else {
        const hCount = (teamScoreData.hataSayisi || 0) + 1;
        const newPuan = (teamScoreData.puan || 1000) - 50;
        update(scoreRef, { durum: "Hatalı Analiz Girişi", hataSayisi: hCount, puan: newPuan });
        logBox("HATA: Analiz verisi geçersiz. (-50 Puan)", "warning");
    }
    inputEl.value = "";
});

// --- 3. ANA OPERASYON BAŞLATICISI ---

function renderUI() {
    if (!teamScoreData || !globalMissionData) {
        console.log("Arayüz çizimi için bekleniyor. Skor:", !!teamScoreData, "Görevler:", !!globalMissionData);
        return;
    }
    console.log("Tüm veriler hazır. Arayüz çiziliyor.");
    
    const gorevNo = teamScoreData.gorevNo || 1;
    
    updateScoreDisplay(teamScoreData);
    updateMapVisuals(gorevNo);
    triggerBriefing(gorevNo);
}

function initOperation() {
    // 1. Karargaha anında "Bağlantı Kuruldu" sinyali gönder.
    update(scoreRef, { durum: "Bağlantı Kuruldu", sonAktiflik: new Date().toISOString() });
    logBox("Karargah ile güvenli bağlantı kuruldu.", "system");

    // 2. CMS'den görev içeriklerini dinle.
    onValue(missionsRef, (snapshot) => {
        if (snapshot.exists()) {
            globalMissionData = snapshot.val();
            console.log("Görev içerikleri (missions) yüklendi/güncellendi.");
            renderUI(); // Skor verisi zaten gelmiş olabilir, arayüzü çizmeyi dene.
        } else {
            logBox("KRİTİK HATA: Görev içerikleri veritabanında bulunamadı!", "warning");
        }
    });

    // 3. Takımın skor/durum verisini dinle.
    onValue(scoreRef, (snapshot) => {
        if (snapshot.exists()) {
            teamScoreData = snapshot.val();
            console.log("Takım skor/durum verisi yüklendi/güncellendi.");
            renderUI(); // Görev verisi zaten gelmiş olabilir, arayüzü çizmeyi dene.
        } else {
            logBox(`HATA: ${teamName} için skor verisi bulunamadı!`, "warning");
        }
    });
}

// Operasyonu başlat!
initOperation();