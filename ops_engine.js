/* * ops_engine.js - Sürüm: v3.5.11
 * Hasbi Erdoğmuş | Görev 1-6 Tam Entegrasyon & Kesin Çözüm Protokolü
 * [Mülakat Hazırlık Protokolü - Görev 6: Eğim Eklendi]
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- 1. İPUCU KÜTÜPHANESİ ---
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
    ]
};

// --- 2. TERMİNAL HAFIZA VE MESAJ MOTORU ---
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

// --- 3. DİNAMİK BRİFİNG TETİKLEYİCİ ---
let lastGorevNo = 0;

function triggerBriefing(gorevNo) {
    if (lastGorevNo !== gorevNo) {
        terminal.innerHTML = "";
        logBox("[SİSTEM]: Yeni veri paketi tanımlandı.", "success");
        
        if (gorevNo === 1) {
            logBox("[MERKEZ]: Haritadaki konumun yükseltisini tespit et.", "");
            logBox("<span style='color:#ff3e3e; font-weight:bold;'>DİKKAT:</span> 1. Görev için şifreleme (h²) protokolü uygulanmalıdır!", "warning");
        } else if (gorevNo === 2) {
            logBox("[MERKEZ]: Haritada kalın çizgi ile gösterilen yerlerde hangi yeryüzü şekli bulunmaktadır?", "hint");
        } else if (gorevNo === 3) {
            logBox("[MERKEZ]: Haritada çizgi ile gösterilen yerlerin ortak özelliği nedir?", "hint");
        } else if (gorevNo === 4) {
            logBox("[MERKEZ]: Yeşil oklar ile gösterilen X ve Y noktaları kaç metre yükseltiyi göstermektedir?", "hint");
        } else if (gorevNo === 5) {
            logBox("[MERKEZ]: Haritada sarı daire ile gösterilen yerlerin ortak özelliği nedir?", "hint");
        } else if (gorevNo === 6) {
            logBox("[MERKEZ]: Haritada sarı çizgi ile gösterilen yerlerin ortak özelliği nedir?", "hint");
        }
        
        lastGorevNo = gorevNo;
        saveTerminal();
    }
}

// --- 4. BAĞLANTI VE CANLI SENKRONİZASYON ---
function initOperation() {
    if (!teamName) return;
    loadTerminal(); 
    update(scoreRef, { durum: "Bağlantı Kuruldu" });

    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev}. Görev ${bolge} Bölgesi`;
        
        const mapImg = document.getElementById('active-map');
        if (mapImg) mapImg.src = `assets/img/soru${gorev}.jpg`;

        triggerBriefing(gorev);

        const stars = document.querySelectorAll('.star');
        stars.forEach((star, i) => {
            star.classList.remove('filled');
            if (gorev >= 3 && i === 0) star.classList.add('filled');
            if (gorev >= 6 && i <= 1) star.classList.add('filled');
            if (gorev >= 9 && i <= 2) star.classList.add('filled');
            if (gorev >= 10 && i <= 3) star.classList.add('filled');
        });
    });
}

initOperation();

// --- 5. İPUCU TALEBİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0;
    const currentGorev = data.gorevNo || 1;
    const activeHints = hint_library[currentGorev] || [];

    if (count === 0) {
        logBox(activeHints[0], "hint");
        await update(scoreRef, { ipucuSayisi: 1, durum: "Kılavuz Kontrol Edildi" });
    } else if (count < activeHints.length) {
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        await update(scoreRef, {
            puan: newScore,
            ipucuSayisi: count + 1,
            durum: `G${currentGorev}-İpucu #${count} Kullanıldı`
        });
        logBox(`[İPUCU #${count}]: ${activeHints[count]}`, "hint");
    } else {
        logBox("Bu bölge için tüm ipuçları kullanıldı.", "warning");
    }
});

// --- 6. ONAYLA (CEVAP KONTROL) ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const rawInput = document.getElementById('kripto-val').value.trim().toLocaleLowerCase('tr');
    const snap = await get(scoreRef);
    const data = snap.val();
    const currentGorev = data.gorevNo || 1;

    if (currentGorev === 1 && Number(rawInput) === 360000) {
        await update(scoreRef, { gorevNo: 2, bolge: "2B", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0 });
        logBox("BAŞARILI! 1. Görev tamamlandı.", "success");
    } 
    else if (currentGorev === 2 && rawInput === "vadi") {
        await update(scoreRef, { gorevNo: 3, bolge: "2C", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0 });
        logBox("MUHTEŞEM ANALİZ! 2B bölgesi temizlendi.", "success");
    } 
    else if (currentGorev === 3 && rawInput.includes("eğim")) {
        await update(scoreRef, { gorevNo: 4, bolge: "2D", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0 });
        logBox("HARİKA! 2C bölgesi analiz edildi. 4. Görev aktif.", "success");
    }
    else if (currentGorev === 4 && rawInput.includes("200")) {
        await update(scoreRef, { gorevNo: 5, bolge: "2E", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0 });
        logBox("ANALİZ TAMAMLANDI! X ve Y yükseltileri doğrulandı. 5. Görev aktif.", "success");
    }
    else if (currentGorev === 5 && rawInput.includes("tepe")) {
        await update(scoreRef, { gorevNo: 6, bolge: "2F", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0 });
        logBox("ANALİZ DOĞRULANDI! Zirveye ulaşıldı. 6. Görev aktif.", "success");
    }
    else if (currentGorev === 6 && rawInput.includes("eğim")) {
        await update(scoreRef, { gorevNo: 7, bolge: "2G", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0 });
        logBox("MÜKEMMEL ANALİZ! Arazi yapısı çözüldü. 7. Görev aktif.", "success");
    }
    else {
        if (data.ipucuSayisi >= 4) {
            await update(scoreRef, { durum: `${currentGorev}. Soruyu Bilemedi!` });
            logBox("ANALİZ BAŞARISIZ: Karargâh desteği bekleniyor!", "warning");
        } else {
            await update(scoreRef, { durum: "Hatalı Giriş" });
            logBox("HATA: Gönderilen analiz verisi geçersiz.", "warning");
        }
    }
    document.getElementById('kripto-val').value = "";
});