/* *****************************************************************************
 * ops_engine.js - Sürüm: v4.2.0 (Tekil & Çok Oyunculu Tam Eşzamanlı Sürüm)    *
 * Hasbi Erdoğmuş | Modern Soru Atlası Entegre Sürümü                          *
 * - OpenTopoMap Fiziki Altlık (Dikili - Akhisar)                              *
 * - Dinamik Topoğrafik Kesit Profili (SVG)                                    *
 * - 4 Seçenekli Profil Eşleştirme Testi (Görev 11)                           *
 * - Esnek Cevap Doğrulama (Eğim, Tepe/Zirve, Z>Y>V)                           *
 * *************************************************************************** */

import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';
import { DEFAULT_MISSIONS } from './assets/js/default-missions.js';

// --- 0. BAĞLANTI PARAMETRELERİ VE SABİTLER ---
const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
if (!teamName) {
    document.body.innerHTML = '<h1>HATA: Takım adı URL\'de belirtilmemiş! Lütfen giriş ekranına dönün.</h1>';
    throw new Error("Takım adı URL'de eksik.");
}

const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const missionsRef = ref(db, 'gameContent/missions');
const terminal = document.getElementById('terminal-output');

// Veri Önbellekleri (Varsayılan olarak DEFAULT_MISSIONS ile başlar, asla boş kalmaz)
let globalMissionData = { ...DEFAULT_MISSIONS };
let teamScoreData = null;

// Durum Değişkenleri
let currentGorevNo = 1;
let lastGorevNo = 0;
let mapLoadTimeout = null;
let lastVisualSignature = '';
let mapRenderToken = 0;
let operationStartTime = Date.now();
let missionStartTime = Date.now();

// 10. ve 11. Görev Durumları
let selectedPoints = { dikili: false, akhisar: false };
let profileGenerated = false;
let selectedProfileOpt = null;
let leafletMapInstance = null;
let leafletMarkers = { a: null, b: null, line: null };

const COORD_DIKILI = [39.0725, 26.8906];
const COORD_AKHISAR = [38.9242, 27.8406];

// Dış Platform (Iframe) postMessage İletişim Protokolü
function notifyParentPlatform(gorevNo, kpScore, isCompleted) {
    if (window.parent) {
        window.parent.postMessage({
            type: 'IZOHIPS_MISSION_UPDATE',
            teamName: teamName,
            gorevNo: gorevNo,
            kp: kpScore || 0,
            completed: isCompleted || gorevNo > getTotalMissions()
        }, '*');
    }
}

function getTotalMissions() {
    return 11;
}

// --- 1. GÖRSELLEŞTİRME VE ARAYÜZ YÖNETİMİ ---

function logBox(message, type = 'system', atTop = false) {
    if (!terminal) return;
    const div = document.createElement('div');
    div.className = `terminal-msg ${type}`;
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const span = document.createElement('span');
    span.textContent = `[${timestamp}] `;
    div.appendChild(span);

    if (type === 'briefing' && message.startsWith('GÖREV')) {
        const parts = message.split(/:(.*)/s);
        if (parts.length > 1) {
            const taskTitle = parts[0];
            const taskDescription = parts[1] || '';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = taskTitle + ':';
            titleSpan.style.color = '#e0e0e0';
            titleSpan.style.marginRight = '8px';

            div.appendChild(titleSpan);
            div.appendChild(document.createTextNode(taskDescription.trim()));
        } else {
            div.appendChild(document.createTextNode(message));
        }
    } else {
        div.appendChild(document.createTextNode(message));
    }

    terminal.appendChild(div);
    if (type === 'success') {
        setTimeout(() => {
            div.style.transition = 'opacity 0.5s ease';
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 500);
        }, 4000);
    }
    terminal.scrollTop = terminal.scrollHeight;
}

function updateScoreDisplay(data) {
    if (!data) return;
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) scoreEl.innerText = data.puan || 1000;

    const totalMissions = getTotalMissions();
    const curNo = data.gorevNo || 1;
    const sectorText = curNo > totalMissions ? 'OPERASYON TAMAMLANDI' : `${curNo}. Görev ${data.bolge || '2A'} Bölgesi`;
    const sectorEl = document.getElementById('current-sector');
    if (sectorEl) sectorEl.innerText = sectorText;

    const starContainer = document.getElementById('star-container');
    if (starContainer) {
        const stars = Math.min(5, Math.ceil(5 * curNo / totalMissions));
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
    const mapImg = document.getElementById('active-map');
    const mapFrame = document.getElementById('active-frame');
    if (mapImg) mapImg.style.display = 'none';
    if (mapFrame) {
        mapFrame.style.display = 'none';
        if (!keepIframeSrc) mapFrame.src = 'about:blank';
    }
}

function updateMapVisuals(gorevNo) {
    if (mapLoadTimeout) clearTimeout(mapLoadTimeout);
    if (!globalMissionData) return;

    const loader = document.getElementById('map-loader');
    if (loader) loader.style.display = 'flex';

    const totalMissions = getTotalMissions();
    if (gorevNo > totalMissions || gorevNo >= 10) {
        resetMapState(false);
        lastVisualSignature = '';
        if (loader) loader.style.display = 'none';
        return;
    }

    const missionTitle = globalMissionData[gorevNo]?.title || `GÖREV ${gorevNo} ANALİZİ`;
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

// Yeni göreve geçiş brifingi - SAĞ TARAFI TEMİZLER, SADECE AKTİF GÖREVE AİT UNSURLARI YÜKLER
function triggerBriefing(gorevNo, force = false) {
    if ((!force && lastGorevNo === gorevNo) || !globalMissionData) return;

    if (terminal) terminal.innerHTML = "";
    lastGorevNo = gorevNo;

    const mission = globalMissionData[gorevNo];
    if (!mission) {
        logBox(`HATA: Görev ${gorevNo} için içerik bulunamadı.`, "warning");
        return;
    }

    const titleText = mission.title || `GÖREV ${gorevNo}`;
    logBox(`GÖREV ${gorevNo} / ${getTotalMissions()} AKTİF // ${titleText}`, 'system');
    logBox(`GÖREV ${gorevNo}: ${mission.question}`, 'briefing');
}

// --- 10. GÖREV LEAFLET & DİNAMİK PROFİL MODÜLÜ ---
function initOpenTopoMap() {
    const container = document.getElementById('opentopo-map');
    if (!container || typeof L === 'undefined') return;

    if (leafletMapInstance) {
        leafletMapInstance.invalidateSize();
        updateLeafletMission10State();
        return;
    }

    try {
        const map = L.map('opentopo-map', {
            center: [38.998, 27.365],
            zoom: 9,
            minZoom: 8,
            maxZoom: 15,
            zoomControl: true,
        });

        L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17,
            attribution: '&copy; OpenTopoMap | CC-BY-SA',
        }).addTo(map);

        map.fitBounds([COORD_DIKILI, COORD_AKHISAR], { padding: [30, 30] });

        leafletMapInstance = map;

        setTimeout(() => {
            if (leafletMapInstance) leafletMapInstance.invalidateSize();
        }, 300);

        updateLeafletMission10State();
    } catch (e) {
        console.error("OpenTopoMap başlatma hatası:", e);
    }
}

function updateLeafletMission10State() {
    if (!leafletMapInstance || typeof L === 'undefined') return;

    if (leafletMarkers.a) leafletMarkers.a.remove();
    if (leafletMarkers.b) leafletMarkers.b.remove();
    if (leafletMarkers.line) leafletMarkers.line.remove();

    const isConnected = profileGenerated || (selectedPoints.dikili && selectedPoints.akhisar);

    // Dikili İkonu
    const iconDikili = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
            <div style="cursor: pointer; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: bold; background: ${
                selectedPoints.dikili ? '#39FF14' : '#000000cc'
            }; color: ${selectedPoints.dikili ? '#000' : '#fbbf24'}; border: 2px solid ${
                selectedPoints.dikili ? '#39FF14' : '#f59e0b'
            }; box-shadow: 0 0 12px ${selectedPoints.dikili ? '#39FF14' : 'rgba(245,158,11,0.6)'}; white-space: nowrap;">
                <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: currentColor;"></span>
                <span>A: DİKİLİ (0m)</span>
                ${selectedPoints.dikili ? '<span>✓</span>' : ''}
            </div>
        `,
        iconSize: [0, 0],
    });

    leafletMarkers.a = L.marker(COORD_DIKILI, { icon: iconDikili })
        .addTo(leafletMapInstance)
        .on('click', () => togglePoint('dikili'));

    // Akhisar İkonu
    const iconAkhisar = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
            <div style="cursor: pointer; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: bold; background: ${
                selectedPoints.akhisar ? '#39FF14' : '#000000cc'
            }; color: ${selectedPoints.akhisar ? '#000' : '#fbbf24'}; border: 2px solid ${
                selectedPoints.akhisar ? '#39FF14' : '#f59e0b'
            }; box-shadow: 0 0 12px ${selectedPoints.akhisar ? '#39FF14' : 'rgba(245,158,11,0.6)'}; white-space: nowrap;">
                <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: currentColor;"></span>
                <span>B: AKHİSAR (95m)</span>
                ${selectedPoints.akhisar ? '<span>✓</span>' : ''}
            </div>
        `,
        iconSize: [0, 0],
    });

    leafletMarkers.b = L.marker(COORD_AKHISAR, { icon: iconAkhisar })
        .addTo(leafletMapInstance)
        .on('click', () => togglePoint('akhisar'));

    if (isConnected) {
        leafletMarkers.line = L.polyline([COORD_DIKILI, COORD_AKHISAR], {
            color: '#39FF14',
            weight: 4,
            dashArray: '8, 6',
            opacity: 0.95,
        }).addTo(leafletMapInstance);
    }

    renderMission10SvgProfile();
}

function togglePoint(pt) {
    selectedPoints[pt] = true;
    if (selectedPoints.dikili && selectedPoints.akhisar) {
        profileGenerated = true;
        logBox("⚡ Dikili (0m - Kıyı) ve Akhisar (95m - Ova) noktaları birleştirildi! OpenTopoMap A-B Lazer Doğrultusu ve Kesit Profili hazır.", "success");
    } else {
        logBox(`📍 Hedef [${pt === 'dikili' ? 'DİKİLİ (0m - Kıyı)' : 'AKHİSAR (95m - Ova)'}] kilitlendi. Şimdi diğer noktayı seçiniz.`, "system");
    }
    updateLeafletMission10State();
    updateMission10InputControls();
}

function connectPointsDirectly() {
    selectedPoints = { dikili: true, akhisar: true };
    profileGenerated = true;
    logBox("⚡ Dikili (0m) ve Akhisar (95m) noktaları otomatik olarak bağlandı! OpenTopoMap A-B Topografik Kesit Profili oluşturuldu.", "success");
    updateLeafletMission10State();
    updateMission10InputControls();
}

function updateMission10InputControls() {
    const isConnected = profileGenerated || (selectedPoints.dikili && selectedPoints.akhisar);
    const statusText = document.getElementById('m10-status-text');
    const btnConnect = document.getElementById('btn-connect-line');
    const btnConfirm = document.getElementById('btn-confirm-m10');

    if (statusText) {
        statusText.textContent = isConnected ? 'HAT AKTİF ✓' : 'BEKLENİYOR...';
    }
    if (btnConnect && btnConfirm) {
        if (isConnected) {
            btnConnect.style.display = 'none';
            btnConfirm.style.display = 'block';
        } else {
            btnConnect.style.display = 'block';
            btnConfirm.style.display = 'none';
        }
    }
}

function renderMission10SvgProfile() {
    const container = document.getElementById('mission-10-chart-body');
    if (!container) return;

    const isConnected = profileGenerated || (selectedPoints.dikili && selectedPoints.akhisar);

    if (isConnected) {
        container.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center;">
                <svg viewBox="0 0 400 95" style="width: 100%; height: 85px; overflow: visible;">
                    <defs>
                        <linearGradient id="profileFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#39FF14" stop-opacity="0.45" />
                            <stop offset="100%" stop-color="#39FF14" stop-opacity="0.02" />
                        </linearGradient>
                    </defs>
                    <line x1="30" y1="14" x2="380" y2="14" stroke="#334155" stroke-width="0.5" stroke-dasharray="2,2" />
                    <line x1="30" y1="47" x2="380" y2="47" stroke="#334155" stroke-width="0.5" stroke-dasharray="2,2" />
                    <line x1="30" y1="80" x2="380" y2="80" stroke="#334155" stroke-width="0.5" stroke-dasharray="2,2" />
                    <text x="25" y="17" fill="#64748b" font-size="8" text-anchor="end" font-family="monospace">680m</text>
                    <text x="25" y="50" fill="#64748b" font-size="8" text-anchor="end" font-family="monospace">350m</text>
                    <text x="25" y="83" fill="#64748b" font-size="8" text-anchor="end" font-family="monospace">0m (Deniz)</text>
                    <polygon points="40,80 110,74 190,45 240,14 300,58 365,71 365,80 40,80" fill="url(#profileFill)" />
                    <polyline points="40,80 110,74 190,45 240,14 300,58 365,71" fill="none" stroke="#39FF14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="40" cy="80" r="3.5" fill="#39FF14" stroke="#000" stroke-width="1" />
                    <text x="40" y="92" fill="#38bdf8" font-size="8" font-weight="bold" text-anchor="middle" font-family="monospace">A: Dikili (0m)</text>
                    <circle cx="110" cy="74" r="2.5" fill="#38bdf8" />
                    <text x="110" y="66" fill="#94a3b8" font-size="7" text-anchor="middle" font-family="monospace">Bakırçay Tabanı (60m)</text>
                    <circle cx="240" cy="14" r="4" fill="#f59e0b" stroke="#000" stroke-width="1" />
                    <text x="240" y="8" fill="#f59e0b" font-size="8" font-weight="bold" text-anchor="middle" font-family="monospace">Yunt Dağları (680m)</text>
                    <circle cx="365" cy="71" r="3.5" fill="#39FF14" stroke="#000" stroke-width="1" />
                    <text x="365" y="63" fill="#38bdf8" font-size="8" font-weight="bold" text-anchor="middle" font-family="monospace">B: Akhisar (95m)</text>
                </svg>
                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #10b981; font-family: monospace; margin-top: 4px;">
                    <span>✓ KESİT PROFİLİ ÇIKARILDI (0m &rarr; 680m Dağ Kütlesi &rarr; 95m Ova)</span>
                    <span style="color: #94a3b8;">Doğrultu: Ege Kıyısı &rarr; İç Kesim</span>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="text-align: center; color: #94a3b8; font-size: 0.8rem; font-family: monospace;">
                <p style="color: #f59e0b; margin: 0 0 5px 0;">⚠️ Kesit profili henüz oluşturulmadı.</p>
                <p style="margin: 0;">Haritadaki <strong style="color: #fde047;">A (Dikili - 0m)</strong> ve <strong style="color: #fde047;">B (Akhisar - 95m)</strong> hedeflerine tıklayın veya aşağıdaki butonu kullanın.</p>
            </div>
        `;
    }
}

// 11. Görev Profil Seçimi
window.selectProfileOption = function(opt) {
    selectedProfileOpt = opt;
    ['A', 'B', 'C', 'D'].forEach(o => {
        const card = document.getElementById(`card-opt-${o.toLowerCase()}`);
        const btn = document.getElementById(`btn-opt-${o}`);
        if (card) {
            if (o === opt) card.classList.add('selected');
            else card.classList.remove('selected');
        }
        if (btn) {
            if (o === opt) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    const statusEl = document.getElementById('m11-status-text');
    if (statusEl) statusEl.textContent = `SEÇİLEN: PROFİL ${opt}`;

    const confirmBtn = document.getElementById('btn-confirm-m11');
    if (confirmBtn) confirmBtn.removeAttribute('disabled');
};

// --- 2. CEVAP DOĞRULAMA VE ETKİLEŞİM MANTIĞI ---

// 10. Görev Onayı
async function handleConfirmMission10() {
    const bonus = 300;
    const nextPuan = (teamScoreData?.puan || 1000) + bonus;
    logBox(`DİKİLİ - AKHİSAR PROFİL HATTI DOĞRULANDI! (+${bonus} KP) Final Görev 11'e geçiliyor...`, "success");

    await update(scoreRef, {
        gorevNo: 11,
        bolge: "2K",
        puan: nextPuan,
        durum: "Profil Hattı Tamamlandı",
        ipucuSayisi: 0,
        sonAktiflik: new Date().toISOString()
    });

    notifyParentPlatform(11, nextPuan, false);
}

// 11. Görev Onayı
async function handleConfirmMission11() {
    if (!selectedProfileOpt) return;

    if (selectedProfileOpt === 'A') {
        const bonus = 300;
        const nextPuan = (teamScoreData?.puan || 1000) + bonus;
        logBox(`TEBRİKLER! Profil A doğrudur: Kıyıdan (0m) başlar, Yunt Dağları kütlesini aşarak ~680m yükseltiye ulaşır ve iç kesimdeki Akhisar Ovası tabanına (~95m) iner. (+${bonus} KP)`, "success");

        await update(scoreRef, {
            gorevNo: 12,
            bolge: "TAMAMLANDI",
            puan: nextPuan,
            durum: "Operasyon Başarıyla Tamamlandı",
            ipucuSayisi: 0,
            sonAktiflik: new Date().toISOString()
        });

        notifyParentPlatform(12, nextPuan, true);
    } else {
        const hCount = (teamScoreData?.hataSayisi || 0) + 1;
        const newPuan = Math.max(0, (teamScoreData?.puan || 1000) - 50);

        await update(scoreRef, {
            durum: "Hatalı Profil Seçimi",
            hataSayisi: hCount,
            puan: newPuan,
            sonAktiflik: new Date().toISOString()
        });

        const reason = selectedProfileOpt === 'B'
            ? 'HATA (Profil B): Dikili kıyıda yer alır, profil 500 metreden başlayamaz! (-50 KP)'
            : selectedProfileOpt === 'C'
            ? 'HATA (Profil C): Akhisar bir dağ doruğu değil çöküntü ovasıdır; profil sürekli durmaksızın yükselemez! (-50 KP)'
            : 'HATA (Profil D): Akhisar denize kıyısı olan bir yer değildir ve Dikili dağda başlamaz! (-50 KP)';
        logBox(reason, 'warning');
    }
}

// Standart Doğrulama (Görev 1-9)
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

    const normalized = (s) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
    const compactText = normalized(rawInput).replace(/\s+/g, '');
    const userTokens = normalized(rawInput).split(',').map(x => x.trim()).filter(Boolean);
    const answerTokens = (mission.answers || "").split(',').map(x => normalized(x)).filter(Boolean);

    let isCorrect = false;

    // Görev 3 Özel Kontrolü: İçinde "eğim" geçen ("eğim azalır" hariç) kelimeleri doğru kabul et
    if (cur === 3) {
        const uText = normalized(rawInput);
        if (uText.includes("eğim") || uText.includes("egim")) {
            if (!uText.includes("eğim azal") && !uText.includes("egim azal")) {
                isCorrect = true;
            }
        }
    }

    // Görev 9 Özel Kontrolü: Z > Y > V veya Y > Z > V
    if (cur === 9) {
        if (compactText === 'z>y>v' || compactText === 'y>z>v') {
            isCorrect = true;
        }
    }

    if (!isCorrect) {
        isCorrect = mission.requireAll
            ? (userTokens.length === answerTokens.length && answerTokens.every((ans, i) => userTokens[i] === ans))
            : answerTokens.some(ans => userTokens.includes(ans) || compactText === ans.replace(/\s+/g, ''));
    }

    if (isCorrect) {
        const nextGorevNo = cur + 1;
        const totalMissions = getTotalMissions();
        const nextPuan = (teamScoreData.puan || 1000) + 200;
        const nextBolge = nextGorevNo > totalMissions ? "TAMAMLANDI" : `2${String.fromCharCode(65 + nextGorevNo - 1)}`;
        
        await update(scoreRef, {
            gorevNo: nextGorevNo,
            bolge: nextBolge,
            puan: nextPuan,
            durum: "Başarılı Analiz",
            ipucuSayisi: 0,
            sonAktiflik: new Date().toISOString()
        });

        notifyParentPlatform(nextGorevNo, nextPuan, nextGorevNo > totalMissions);
        logBox(`VERİ DOĞRULANDI! (+200 KP) Bir sonraki göreve geçiliyor...`, "success");
    } else {
        const hCount = (teamScoreData.hataSayisi || 0) + 1;
        const newPuan = Math.max(0, (teamScoreData.puan || 1000) - 50);
        update(scoreRef, {
            durum: "Hatalı Analiz Girişi",
            hataSayisi: hCount,
            puan: newPuan,
            sonAktiflik: new Date().toISOString()
        });
        logBox("HATA: Analiz verisi geçersiz. (-50 KP)", "warning");
    }
    inputEl.value = "";
});

// Enter tuşu ile onayla
const kriptoInput = document.getElementById('kripto-val');
if (kriptoInput) {
    kriptoInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('btn-verify')?.click();
        }
    });
}

// 10. ve 11. Görev Buton Olayları
document.getElementById('btn-connect-line')?.addEventListener('click', connectPointsDirectly);
document.getElementById('btn-confirm-m10')?.addEventListener('click', handleConfirmMission10);
document.getElementById('btn-confirm-m11')?.addEventListener('click', handleConfirmMission11);

// İpucu Talebi
document.getElementById('btn-hint')?.addEventListener('click', async () => {
    if (!teamScoreData || !globalMissionData) return;
    
    const cur = teamScoreData.gorevNo || 1;
    const mission = globalMissionData[cur];
    if (!mission || !mission.hints) {
        logBox("Bu görev için ipucu bulunmuyor.", "warning");
        return;
    }

    const hints = mission.hints.split('\n').filter(h => h.trim());
    const used = teamScoreData.ipucuSayisi || 0;

    if (used < hints.length) {
        const newHints = used + 1;
        const newPuan = Math.max(0, (teamScoreData.puan || 1000) - 50);
        await update(scoreRef, {
            ipucuSayisi: newHints,
            puan: newPuan,
            durum: "İpucu Kullanıldı",
            sonAktiflik: new Date().toISOString()
        });
        logBox(`İPUCU [${newHints}/${hints.length}]: ${hints[used]} (-50 KP)`, 'hint');
    } else {
        logBox("Mevcut tüm ipuçlarını kullandınız.", "warning");
    }
});

// Saha Kılavuzu Modalı
const modal = document.getElementById('manual-modal');
document.getElementById('btn-open-manual')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'block';
});
document.getElementById('btn-close-manual')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
});
window.addEventListener('click', (e) => {
    if (e.target === modal && modal) modal.style.display = 'none';
});

// --- 3. ANA OPERASYON ARAYÜZ YÖNETİCİSİ ---

function renderUI() {
    if (!teamScoreData || !globalMissionData) return;

    const gorevNo = teamScoreData.gorevNo || 1;
    const totalMissions = getTotalMissions();

    const standardInput = document.getElementById('standard-mission-input');
    const mission10Input = document.getElementById('mission-10-input');
    const mission11Input = document.getElementById('mission-11-input');

    const standardVisual = document.getElementById('standard-visual-content');
    const mission10Visual = document.getElementById('mission-10-visual-content');
    const mission11Visual = document.getElementById('mission-11-visual-content');
    const gameOverContent = document.getElementById('game-over-content');

    if (gorevNo > totalMissions) {
        // Oyun Bitti
        if (standardVisual) standardVisual.style.display = "none";
        if (mission10Visual) mission10Visual.style.display = "none";
        if (mission11Visual) mission11Visual.style.display = "none";
        if (gameOverContent) gameOverContent.style.display = "flex";

        if (standardInput) standardInput.style.display = "none";
        if (mission10Input) mission10Input.style.display = "none";
        if (mission11Input) mission11Input.style.display = "none";

        resetMapState(false);
        if (terminal) terminal.innerHTML = "";
        logBox("Tebrikler! Bergama 2050 operasyonunu başarıyla tamamladınız. Skorunuz karargaha iletildi.", "success");

        const reportTeamName = document.getElementById('report-team-name');
        const reportTotalKp = document.getElementById('report-total-kp');
        const reportDuration = document.getElementById('report-duration');
        const reportHints = document.getElementById('report-hints');

        if (reportTeamName) reportTeamName.textContent = teamName;
        if (reportTotalKp) reportTotalKp.textContent = `${teamScoreData.puan || 1000} KP`;
        if (reportHints) reportHints.textContent = teamScoreData.ipucuSayisi || 0;

        const totalElapsedSec = Math.max(0, Math.round((Date.now() - operationStartTime) / 1000));
        const elapsedMins = Math.floor(totalElapsedSec / 60);
        const elapsedSecs = totalElapsedSec % 60;
        if (reportDuration) reportDuration.textContent = `${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')} dk`;

        notifyParentPlatform(gorevNo, teamScoreData.puan || 1000, true);
        return;
    }

    if (gameOverContent) gameOverContent.style.display = "none";

    if (gorevNo === 10) {
        // 10. Görev
        if (standardVisual) standardVisual.style.display = "none";
        if (mission10Visual) mission10Visual.style.display = "flex";
        if (mission11Visual) mission11Visual.style.display = "none";

        if (standardInput) standardInput.style.display = "none";
        if (mission10Input) mission10Input.style.display = "flex";
        if (mission11Input) mission11Input.style.display = "none";

        initOpenTopoMap();
        updateMission10InputControls();
    } else if (gorevNo === 11) {
        // 11. Görev
        if (standardVisual) standardVisual.style.display = "none";
        if (mission10Visual) mission10Visual.style.display = "none";
        if (mission11Visual) mission11Visual.style.display = "flex";

        if (standardInput) standardInput.style.display = "none";
        if (mission10Input) mission10Input.style.display = "none";
        if (mission11Input) mission11Input.style.display = "flex";
    } else {
        // 1-9. Görevler
        if (standardVisual) standardVisual.style.display = "block";
        if (mission10Visual) mission10Visual.style.display = "none";
        if (mission11Visual) mission11Visual.style.display = "none";

        if (standardInput) standardInput.style.display = "flex";
        if (mission10Input) mission10Input.style.display = "none";
        if (mission11Input) mission11Input.style.display = "none";

        updateMapVisuals(gorevNo);
    }

    updateScoreDisplay(teamScoreData);
    triggerBriefing(gorevNo);
}

function initOperation() {
    update(scoreRef, { durum: "Bağlantı Kuruldu", sonAktiflik: new Date().toISOString() });
    logBox("Karargah ile güvenli bağlantı kuruldu.", "system");

    // CMS / Firebase görev içeriklerini dinle (Varsayılan olarak DEFAULT_MISSIONS ile harmanla)
    onValue(missionsRef, (snapshot) => {
        const isUpdate = !!globalMissionData;
        if (snapshot.exists()) {
            globalMissionData = { ...DEFAULT_MISSIONS, ...snapshot.val() };
        } else {
            globalMissionData = { ...DEFAULT_MISSIONS };
        }
        if (isUpdate && teamScoreData) {
            renderUI();
        }
    });

    // Takım skor ve durumunu dinle
    onValue(scoreRef, (snapshot) => {
        if (snapshot.exists()) {
            const previousData = teamScoreData;
            teamScoreData = snapshot.val();
            currentGorevNo = teamScoreData.gorevNo || 1;

            if (previousData && (teamScoreData.gorevNo || 1) > (previousData.gorevNo || 1)) {
                logBox("Tebrikler yeni aşamaya geçtiniz!", "success", true);
            }

            notifyParentPlatform(currentGorevNo, teamScoreData.puan || 1000, currentGorevNo > getTotalMissions());
            renderUI();
        } else {
            // Takım kaydı yoksa varsayılan skor oluştur
            update(scoreRef, {
                gorevNo: 1,
                bolge: "2A",
                puan: 1000,
                ipucuSayisi: 0,
                hataSayisi: 0,
                durum: "Başladı",
                sonAktiflik: new Date().toISOString()
            });
        }
    });
}

initOperation();