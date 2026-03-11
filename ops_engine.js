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
let lastVisualSignature = '';
let mapRenderToken = 0;

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

function normalizeVisualUrl(url = '') {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    return trimmed;
}

function parseMissionVisual(cmsContent = '') {
    const cleanContent = String(cmsContent || '').trim();
    if (!cleanContent) return { type: 'none', url: '', signature: 'none' };

    const iframeMatch = cleanContent.match(/<iframe[\s\S]*?<\/iframe>/i);
    if (iframeMatch) {
        const srcMatch = iframeMatch[0].match(/src=["']([^"']+)["']/i);
        const normalizedSrc = normalizeVisualUrl(srcMatch?.[1] || '');
        return {
            type: normalizedSrc ? 'iframe' : 'invalid',
            url: normalizedSrc,
            signature: `iframe:${normalizedSrc || iframeMatch[0]}`
        };
    }

    const normalizedUrl = normalizeVisualUrl(cleanContent);
    if (/(google\.[^/]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|umap\.openstreetmap\.fr)/i.test(normalizedUrl)) {
        return { type: 'iframe', url: normalizedUrl, signature: `iframe:${normalizedUrl}` };
    }

    return { type: 'image', url: normalizedUrl, signature: `image:${normalizedUrl}` };
}

function resetMapState(keepIframeSrc = true) {
    const elements = {
        mapImg: document.getElementById('active-map'),
        mapFrame: document.getElementById('active-frame'),
        scanLine: document.querySelector('.scan-line'),
        mapOverlayBarrier: document.querySelector('.map-overlay-barrier'),
        zoomControls: document.querySelector('.zoom-controls'),
    };

    if (elements.mapImg) {
        elements.mapImg.style.display = 'none';
    }
    if (elements.mapFrame) {
        elements.mapFrame.style.display = 'none';
        if (!keepIframeSrc) elements.mapFrame.src = 'about:blank';
    }
    if (elements.scanLine) elements.scanLine.style.display = 'none';
    if (elements.mapOverlayBarrier) elements.mapOverlayBarrier.style.display = 'none';
    if (elements.zoomControls) elements.zoomControls.style.display = 'none';
}

function updateMapVisuals(gorevNo) {
    if (mapLoadTimeout) clearTimeout(mapLoadTimeout);
    if (!globalMissionData) return;

    const loader = document.getElementById('map-loader');
    if (loader) loader.style.display = 'flex';

    if (gorevNo > 10) {
        resetMapState(false);
        lastVisualSignature = '';
        if (loader) loader.style.display = 'none';
        return;
    }

    // Görsel başlığını güncelle
    const missionTitle = globalMissionData[gorevNo]?.title || `GÖREV ${gorevNo} GÖRSELİ`;
    const titleBox = document.getElementById('visual-title');
    if (titleBox) {
        titleBox.textContent = missionTitle;
    }

    const cmsContent = globalMissionData[gorevNo]?.image || '';
    const parsedVisual = parseMissionVisual(cmsContent);

    if (parsedVisual.type === 'none' || parsedVisual.type === 'invalid') {
        resetMapState(false);
        lastVisualSignature = '';
        if (loader) loader.style.display = 'none';
        if (titleBox) {
            titleBox.textContent = 'GÖRSEL ANALİZİ BEKLENİYOR...';
        }
        if (parsedVisual.type === 'invalid') {
            logBox('HATA: İframe kodu geçersiz. Lütfen src içeren doğru iframe kaydedin.', 'warning');
        }
        return;
    }

    if (lastVisualSignature === parsedVisual.signature) {
        if (loader) loader.style.display = 'none';
        if (parsedVisual.type === 'iframe') {
            const mapFrame = document.getElementById('active-frame');
            if (mapFrame) mapFrame.style.display = 'block';
        } else {
            const mapImg = document.getElementById('active-map');
            if (mapImg) mapImg.style.display = 'block';
        }
        return;
    }

    mapRenderToken += 1;
    const token = mapRenderToken;

    resetMapState(true);

    if (parsedVisual.type === 'iframe') {
        const mapFrame = document.getElementById('active-frame');
        if (mapFrame) {
            mapFrame.style.display = 'block';
            mapFrame.onload = () => {
                if (token !== mapRenderToken) return;
                if (loader) loader.style.display = 'none';
            };
            mapFrame.onerror = () => {
                if (token !== mapRenderToken) return;
                if (loader) loader.style.display = 'none';
                logBox('UYARI: Harita iframe yüklenemedi. Linki kontrol edin.', 'warning');
            };
            if (mapFrame.src !== parsedVisual.url) {
                mapFrame.src = parsedVisual.url;
            } else if (loader) {
                loader.style.display = 'none';
            }
        }
    } else {
        const mapImg = document.getElementById('active-map');
        if (mapImg) {
            mapImg.style.display = 'block';
            mapImg.onload = () => {
                if (token !== mapRenderToken) return;
                if (loader) loader.style.display = 'none';
            };
            mapImg.onerror = () => {
                if (token !== mapRenderToken) return;
                if (loader) loader.style.display = 'none';
                logBox('UYARI: Görsel yüklenemedi. URL veya erişim iznini kontrol edin.', 'warning');
            };
            if (mapImg.src !== parsedVisual.url) {
                mapImg.src = parsedVisual.url;
            } else if (loader) {
                loader.style.display = 'none';
            }
        }
    }

    lastVisualSignature = parsedVisual.signature;

    mapLoadTimeout = setTimeout(() => {
        if (token !== mapRenderToken) return;
        if (loader) loader.style.display = 'none';
    }, 4000);
}

function triggerBriefing(gorevNo, force = false) {
    // Eğer zorunlu değilse ve görev numarası aynıysa VEYA görev verisi henüz yüklenmediyse çık.
    if ((!force && lastGorevNo === gorevNo) || !globalMissionData) return;

    // Eğer yeni bir göreve geçildiyse veya CMS'den zorunlu bir yenileme geldiyse terminali temizle.
    if (lastGorevNo !== gorevNo || force) {
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
    logBox(`GÖREV ${gorevNo}: ${text}`, "briefing");
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

        if (currentGorev === 10) {
            const briefing = document.getElementById('mission-10-briefing');
            const hintContainer = document.getElementById('mission-10-hint-container');
            const hintDisplay = document.getElementById('mission-10-hint-display');

            if (briefing) briefing.style.display = 'none';
            if (hintContainer) hintContainer.style.display = 'block';
            
            if (hintDisplay) {
                const p = document.createElement('p');
                p.style.borderLeft = '3px solid var(--info-blue)';
                p.style.paddingLeft = '10px';
                p.style.marginBottom = '10px';
                p.textContent = hintText;
                hintDisplay.appendChild(p);
            }
        } else {
            logBox(`İPUCU: ${hintText}`, "hint");
        }

        update(scoreRef, {
            ipucuSayisi: usedHints + 1,
            puan: (teamScoreData.puan || 1000) - 50,
            durum: `İpucu Alındı (${usedHints + 1})`
        });
    } else {
        logBox("Tüm ipuçları zaten alındı.", "warning");
        if (currentGorev === 10) {
            const hintDisplay = document.getElementById('mission-10-hint-display');
            if (hintDisplay && !hintDisplay.querySelector('.no-more-hints')) {
                const p = document.createElement('p');
                p.className = 'no-more-hints';
                p.style.color = 'var(--warning-red)';
                p.style.marginTop = '15px';
                p.textContent = '[SİSTEM]: Bu görev için başka ipucu kalmadı.';
                hintDisplay.appendChild(p);
            }
        } else {
            logBox("Tüm ipuçları zaten alındı.", "warning");
        }
    }
});

document.getElementById('btn-ai-verify')?.addEventListener('click', async () => {
    const inputEl = document.getElementById('coords-input');
    const rawInput = inputEl.value.trim();
    if (!rawInput) return;

    if (!teamScoreData || !globalMissionData) {
        logBox("Sistem verileri henüz hazır değil, lütfen bekleyin.", "warning");
        return;
    }

    const cur = teamScoreData.gorevNo || 1;
    if (cur !== 10) {
        logBox("HATA: Profil çıkarma modülü sadece 10. görevde aktiftir.", "warning");
        return;
    }

    const mission = globalMissionData[cur];
    if (!mission) {
        logBox("Görev verisi yüklenemedi, cevap kontrol edilemiyor.", "warning");
        return;
    }

    // Parse user input: expecting "lat, lon"
    const parts = rawInput.replace(',', ' ').split(/\s+/).filter(Boolean);
    if (parts.length !== 2) {
        logBox("HATA: Geçersiz format. Lütfen 'enlem, boylam' formatında veri girin.", "warning");
        update(scoreRef, { durum: "Hatalı Profil Verisi", hataSayisi: (teamScoreData.hataSayisi || 0) + 1, puan: (teamScoreData.puan || 1000) - 10 });
        return;
    }

    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
        logBox("HATA: Enlem ve boylam sayısal değerler olmalıdır.", "warning");
        update(scoreRef, { durum: "Hatalı Profil Verisi", hataSayisi: (teamScoreData.hataSayisi || 0) + 1, puan: (teamScoreData.puan || 1000) - 10 });
        return;
    }

    // Get correct answer from CMS
    const correctAnswers = (mission.answers || "").split(',').map(a => a.trim()).filter(Boolean);
    if (correctAnswers.length !== 2) {
        logBox("KRİTİK HATA: Görev 10 için cevaplar doğru formatta değil. CMS'i kontrol edin.", "warning");
        return;
    }

    const correctLat = parseFloat(correctAnswers[0]);
    const correctLon = parseFloat(correctAnswers[1]);

    // Check with a margin of error
    const latError = Math.abs(lat - correctLat);
    const lonError = Math.abs(lon - correctLon);
    const tolerance = 0.001; // ~111 meters margin of error

    if (latError <= tolerance && lonError <= tolerance) {
        // Correct
        const nextGorevNo = cur + 1;
        const nextPuan = (teamScoreData.puan || 1000) + 200;
        const nextBolge = "TAMAMLANDI";
        update(scoreRef, {
            gorevNo: nextGorevNo,
            bolge: nextBolge,
            puan: nextPuan,
            durum: "Profil Çıkarma Başarılı",
            ipucuSayisi: 0
        });
        logBox("YAPAY ZEKA ANALİZİ BAŞARILI! Profil doğrulandı. Operasyon tamamlanıyor...", "success");
    } else {
        // Incorrect
        const hCount = (teamScoreData.hataSayisi || 0) + 1;
        const newPuan = (teamScoreData.puan || 1000) - 50;
        update(scoreRef, { durum: "Hatalı Profil Verisi", hataSayisi: hCount, puan: newPuan });
        logBox("HATA: Yapay zeka analizi başarısız. Konum verisi eşleşmiyor. (-50 Puan)", "warning");
    }
    inputEl.value = "";
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

// Enter tuşu ile onayla
const kriptoInput = document.getElementById('kripto-val');
if (kriptoInput) {
    kriptoInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Formun gönderilmesini engelle
            document.getElementById('btn-verify')?.click();
        }
    });
}

// --- 3. ANA OPERASYON BAŞLATICISI ---

function renderUI() {
    if (!teamScoreData || !globalMissionData) {
        console.log("Arayüz çizimi için bekleniyor. Skor:", !!teamScoreData, "Görevler:", !!globalMissionData);
        return;
    }
    console.log("Tüm veriler hazır. Arayüz çiziliyor.");
    
    const gorevNo = teamScoreData.gorevNo || 1;
    
    const standardInput = document.getElementById('standard-mission-input');
    const mission10Input = document.getElementById('mission-10-input');
    const standardVisual = document.getElementById('standard-visual-content');
    const mission10Visual = document.getElementById('mission-10-visual-content');
    const terminalHeader = document.querySelector('.terminal-header');
    const extraTools = document.querySelector('.extra-tools');
    const commandPanel = document.querySelector('.command-panel');

    if (gorevNo > 10) {
        // Game finished
        if (standardVisual) standardVisual.style.display = 'block';
        if (mission10Visual) mission10Visual.style.display = 'none';
        resetMapState(false);
        if(terminal) terminal.innerHTML = "";
        logBox("Tebrikler! Bergama 2050 operasyonunu başarıyla tamamladınız. Skorunuz karargaha iletildi.", "success");
        const titleBox = document.getElementById('visual-title');
        if(titleBox) titleBox.textContent = "OPERASYON BAŞARIYLA TAMAMLANDI";
        if (standardInput) standardInput.style.display = 'none';
        if (mission10Input) mission10Input.style.display = 'none';
        if (extraTools) extraTools.style.display = 'none';
        updateScoreDisplay(teamScoreData); // Update score one last time
        return; // Stop further rendering
    }

    // Toggle mission inputs based on gorevNo
    if (gorevNo === 10) {
        // --- Mission 10 Layout ---
        if (standardInput) standardInput.style.display = 'none';
        if (mission10Input) mission10Input.style.display = 'flex';
        if (standardVisual) standardVisual.style.display = 'none';
        if (mission10Visual) mission10Visual.style.display = 'block';
        if (terminalHeader) terminalHeader.style.marginTop = '0'; // Reset margin
        
        // Move and style the tools container
        if (extraTools && mission10Visual && !mission10Visual.contains(extraTools)) {
             mission10Visual.appendChild(extraTools); // Move tools to the right panel
             extraTools.style.marginTop = 'auto';
             extraTools.style.paddingTop = '15px';
             extraTools.style.textAlign = 'center';
        }

        // Handle hint display vs briefing display
        const briefing = document.getElementById('mission-10-briefing');
        const hintContainer = document.getElementById('mission-10-hint-container');
        const hintDisplay = document.getElementById('mission-10-hint-display');
        const usedHints = teamScoreData.ipucuSayisi || 0;
        const missionHints = globalMissionData[10]?.hints?.split('\n').filter(h => h.trim() !== '') || [];

        if (usedHints > 0 && hintDisplay && missionHints.length > 0) {
            if (briefing) briefing.style.display = 'none';
            if (hintContainer) hintContainer.style.display = 'block';
            
            hintDisplay.innerHTML = ''; // Clear previous
            for (let i = 0; i < Math.min(usedHints, missionHints.length); i++) {
                const p = document.createElement('p');
                p.style.borderLeft = '3px solid var(--info-blue)';
                p.style.paddingLeft = '10px';
                p.style.marginBottom = '10px';
                p.textContent = missionHints[i];
                hintDisplay.appendChild(p);
            }
        } else {
            if (briefing) briefing.style.display = 'flex';
            if (hintContainer) hintContainer.style.display = 'none';
            if (hintDisplay) hintDisplay.innerHTML = '';
        }

        // Update Mission 10 button links from CMS
        const missionData = globalMissionData[10];
        const trainingBtn = document.getElementById('btn-training-video');
        const profilerBtn = document.getElementById('btn-profiler-tool');
        if (missionData && trainingBtn) trainingBtn.href = missionData.trainingVideoUrl || 'assets/video/10_gorev.mp4';
        if (missionData && profilerBtn) profilerBtn.href = missionData.profilerToolUrl || 'https://www.heywhatsthat.com/profiler.html';

    } else {
        // --- Standard Mission Layout (1-9) ---
        if (standardInput) standardInput.style.display = 'flex';
        if (mission10Input) mission10Input.style.display = 'none';
        if (standardVisual) standardVisual.style.display = 'block';
        if (mission10Visual) mission10Visual.style.display = 'none';
        if (terminalHeader) terminalHeader.style.marginTop = ''; // Use default margin
        if (extraTools && commandPanel && !commandPanel.contains(extraTools)) {
            commandPanel.appendChild(extraTools); // Move tools back to the left panel
            extraTools.style.marginTop = '';
            extraTools.style.paddingTop = '';
            extraTools.style.textAlign = '';
        }
    }
    
    updateScoreDisplay(teamScoreData);
    
    if (gorevNo <= 10) {
        updateMapVisuals(gorevNo);
        triggerBriefing(gorevNo);
    }
}

function initOperation() {
    // 1. Karargaha anında "Bağlantı Kuruldu" sinyali gönder.
    update(scoreRef, { durum: "Bağlantı Kuruldu", sonAktiflik: new Date().toISOString() });
    logBox("Karargah ile güvenli bağlantı kuruldu.", "system");

    // 2. CMS'den görev içeriklerini dinle.
    onValue(missionsRef, (snapshot) => {
        const isUpdate = !!globalMissionData; // Bu ilk yükleme mi yoksa bir güncelleme mi?
        if (snapshot.exists()) {
            globalMissionData = snapshot.val();
            console.log("Görev içerikleri (missions) yüklendi/güncellendi.");

            // Eğer bu bir güncelleme ise (ilk yükleme değil) ve oyun zaten başladıysa,
            // arayüzü yeni gelen CMS verisiyle yenilemeye zorla.
            if (isUpdate && teamScoreData) {
                console.log(`CMS güncellemesi algılandı. Görev ${currentGorevNo} için arayüz yenileniyor.`);
                updateMapVisuals(currentGorevNo);
                triggerBriefing(currentGorevNo, true); // force=true
            } else {
                renderUI(); // İlk yükleme ise, normal render akışını tetikle.
            }
        } else {
            logBox("KRİTİK HATA: Görev içerikleri veritabanında bulunamadı!", "warning");
        }
    });

    // 3. Takımın skor/durum verisini dinle.
    onValue(scoreRef, (snapshot) => {
        if (snapshot.exists()) {
            teamScoreData = snapshot.val();
            currentGorevNo = teamScoreData.gorevNo || 1;
            console.log("Takım skor/durum verisi yüklendi/güncellendi.");
            renderUI(); // Görev verisi zaten gelmiş olabilir, arayüzü çizmeyi dene.
        } else {
            logBox(`HATA: ${teamName} için skor verisi bulunamadı!`, "warning");
        }
    });
}

// Operasyonu başlat!
initOperation();