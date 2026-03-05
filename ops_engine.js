/* *****************************************************************************
 * ops_engine.js - Sürüm: v3.5.17                                              *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Görev 1-10 Tam Senkronizasyon | Arazi Profili ve Matematiksel Sıralama     *
 * *************************************************************************** */

import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

// --- 0. BAĞLANTI PARAMETRELERİ VE SABİTLER ---
const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// --- 1. İPUCU KÜTÜPHANESİ (HİNT REPOSITORY - KADEMELİ SİSTEM) ---
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
        "Saha kılavuzunu dikkatlice oku.",
        "A ve B noktaları arasındaki yükselti profilini zihninde canlandır.",
        "Haritadaki her izohips kesişimini dikey eksene taşıdığında çıkan şekle odaklan.",
        "Profilin zirve ve çukur noktalarını (akarsu geçişi gibi) kontrol et."
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

// --- 3. DİNAMİK BRİFİNG TETİKLEYİCİ (TASK BRIEFING) ---
let lastGorevNo = 0;

function triggerBriefing(gorevNo) {
    if (lastGorevNo !== gorevNo) {
        terminal.innerHTML = "";
        logBox("[SİSTEM]: Yeni veri paketi tanımlandı.", "success");
        
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
            logBox("[MERKEZ]: Haritadaki A-B hattı boyunca çıkarılan arazi profilini analiz et.", "hint");
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
    update(scoreRef, { durum: "Aktif Bağlantı", sonSinyal: new Date().toISOString() });

    onValue(scoreRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const gorev = data.gorevNo || 1;
        const bolge = data.bolge || "2A";
        
        if(document.getElementById('current-score')) document.getElementById('current-score').innerText = data.puan || 1000;
        if(document.getElementById('current-sector')) document.getElementById('current-sector').innerText = `${gorev > 10 ? 'BİTTİ' : gorev + '. Görev ' + bolge}`;
        
        const mapImg = document.getElementById('active-map');
        if (mapImg) mapImg.src = `assets/img/soru${gorev > 10 ? 10 : gorev}.jpg`;

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

// --- 5. İPUCU TALEBİ PANELİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0;
    const currentGorev = data.gorevNo || 1;
    const activeHints = hint_library[currentGorev] || [];

    if (count === 0 && activeHints.length > 0) {
        logBox(activeHints[0], "hint");
        await update(scoreRef, { ipucuSayisi: 1, durum: "Kılavuz Kontrol Edildi" });
    } else if (count < activeHints.length) {
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        await update(scoreRef, {
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
    // rawInput: Boşlukları temizle ve küçük harfe çevir
    const rawInput = document.getElementById('kripto-val').value.trim().toLocaleLowerCase('tr').replace(/\s/g, "");
    const snap = await get(scoreRef);
    const data = snap.val();
    const cur = data.gorevNo || 1;

    let isCorrect = false;

    // MATEMATİKSEL VE METİNSEL KONTROL ZİNCİRİ
    if (cur === 1 && Number(rawInput) === 360000) isCorrect = true;
    else if (cur === 2 && rawInput === "vadi") isCorrect = true;
    else if (cur === 3 && rawInput.includes("eğim")) isCorrect = true;
    else if (cur === 4 && rawInput.includes("200")) isCorrect = true;
    else if (cur === 5 && rawInput.includes("tepe")) isCorrect = true;
    else if (cur === 6 && rawInput.includes("eğim")) isCorrect = true;
    else if (cur === 7 && rawInput.includes("plato") && rawInput.includes("ova")) isCorrect = true;
    else if (cur === 8 && rawInput.includes("delta") && rawInput.includes("falez")) isCorrect = true;
    
    // --- GÖREV 9: MATEMATİKSEL SIRALAMA KONTROLÜ ---
    else if (cur === 9 && rawInput === "y>z>v") isCorrect = true;
    
    // --- GÖREV 10: ARAZİ PROFİLİ ANALİZİ ---
    else if (cur === 10 && rawInput === "profil") isCorrect = true;

    if (isCorrect) {
        const nextG = cur + 1;
        const bolgeKodu = nextG > 10 ? "TAMAMLANDI" : "2" + String.fromCharCode(74 + (cur - 9));
        
        await update(scoreRef, { 
            gorevNo: nextG, 
            bolge: bolgeKodu,
            puan: data.puan + 200, 
            durum: nextG > 10 ? "OPERASYON TAMAM" : "Başarılı Analiz", 
            ipucuSayisi: 0 
        });
        
        logBox("VERİ DOĞRULANDI! Mükemmel analiz.", "success");
    } else {
        await update(scoreRef, { durum: "Hatalı Giriş Denemesi" });
        logBox("HATA: Gönderilen analiz verisi geçersiz.", "warning");
    }
    
    // Giriş alanını temizle
    document.getElementById('kripto-val').value = "";
});