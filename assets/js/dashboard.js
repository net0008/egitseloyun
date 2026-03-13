/* *****************************************************************************
 * dashboard.js - Sürüm: v2.9.6                                                *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Karargâh Canlı İzleme, Veri Senkronizasyonu ve Operasyonel Yönetim         *
 * *************************************************************************** */

import { db, ref, set, onValue, update } from "./firebase-config.js";

// --- 0. HAFIZA VE SAHA BELLEĞİ BAŞLATICI ---
// Sayfa yüklendiğinde tarayıcı yerel depolamasında bekleyen CSV taslaklarını kontrol eder.
let localStudents = JSON.parse(localStorage.getItem("rosterDraft") || "[]");
let liveScoresCache = {}; // Canlı skor verilerini tutacak önbellek

// --- 1. VERİ NORMALİZASYON VE ANALİZ SİSTEMİ ---
// CSV başlıklarını sistemdeki standart anahtarlarla eşleştiren takma ad (alias) kütüphanesi.
const HEADER_ALIASES = {
    okulno: "Okul No",
    okulnumarasi: "Okul No",
    ogrencino: "Okul No",
    numara: "Okul No",
    adisoyadi: "Adı Soyadı",
    adsoyad: "Adı Soyadı",
    takimadi: "Takım Adı",
    takim: "Takım Adı",
    gorev: "Görev"
};

/**
 * normalizeKey: Metindeki Türkçe karakterleri ve gereksiz boşlukları temizleyerek 
 * teknik bir anahtar oluşturur.
 */
function normalizeKey(text = "") {
    return String(text)
        .replace(/^\uFEFF/, "")
        .trim()
        .toLocaleLowerCase("tr")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
        .replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c")
        .replace(/[^a-z0-9]/g, "");
}

/**
 * canonicalHeader: Kullanıcı tarafından yüklenen başlığı sistemin tanıdığı formata çevirir.
 */
function canonicalHeader(header = "") {
    const normalized = normalizeKey(header);
    return HEADER_ALIASES[normalized] || String(header).replace(/^\uFEFF/, "").trim();
}

// --- 2. DİNAMİK GÖRSELLEŞTİRME MOTORU ---
/**
 * getStatusColor: Sahadan gelen durum sinyallerine göre hücrelerin neon rengini belirler.
 */
function getStatusColor(status) {
    if (!status) return "#888";
    if (status.includes("Başarılı") || status.includes("TAMAM") || status.includes("Kuruldu")) return "#39FF14";
    if (status.includes("İpucu")) return "#00d4ff"; // İpucu modunda mavi sinyal
    if (status.includes("Hata") || status.includes("Hatalı") || status.includes("Bilemedi")) return "#ff3e3e"; // Hata durumunda kırmızı alarm
    return "#39FF14"; 
}

/**
 * renderDashboard: Firebase'den gelen canlı skorları ve yerel kadroyu birleştirerek 
 * karargah tablosunu inşa eder.
 */
function renderDashboard(liveScores = {}) {
    const tbody = document.getElementById("status-body");
    if (!tbody) return;

    if (localStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff3e3e; padding:30px; font-weight:bold; border:1px dashed #ff3e3e;">[SİSTEM]: Kadro verisi bekleniyor. Lütfen CSV yükleyin.</td></tr>';
        return;
    }

    let rowsHTML = "";
    localStudents.forEach((student) => {
        const teamName = student["Takım Adı"];
        // Sahadan gelen canlı verileri yakala, yoksa varsayılan değerleri ata.
        const stats = liveScores[teamName] || { puan: 1000, bolge: "2A", gorevNo: 1, durum: "Sinyal Bekleniyor", ipucuSayisi: 0, hataSayisi: 0 };

        rowsHTML += `
    <tr style="border-bottom: 1px solid #222;">
        <td style="padding:12px;"><span class="id-tag">${student["Okul No"] || "---"}</span></td>
        <td><span style="color:#00d4ff; font-weight:bold;">${teamName || "Bilinmiyor"}</span></td>
        <td><span class="sector-tag">${stats.bolge || stats.sektor || "2A"}</span></td>
        <td><span class="neon-text" style="font-weight:bold;">#${stats.gorevNo || 1}</span></td> <td class="neon-text" style="font-size:1.1rem;">${stats.puan || 1000}</td>
        <td style="padding:10px;">
            <div style="font-weight:bold; color:#fff;">${student["Adı Soyadı"]}</div>
            <div style="font-size:0.85rem; margin-top:4px;">
                <span style="color:${getStatusColor(stats.durum)};">[${stats.durum}]</span>
                <span style="color:#00d4ff; margin-left:8px;">İ:${stats.ipucuSayisi || 0}</span>
                <span style="color:#ff3e3e; margin-left:8px;">H:${stats.hataSayisi || 0}</span>
            </div>
        </td>
    </tr>
`;
    });
    tbody.innerHTML = rowsHTML;
}

// --- 3. FİREBASE CANLI SENKRONİZASYON PROTOKOLÜ ---
// Veritabanındaki kadro ve skor değişimlerini milisaniyelik gecikmeyle karargaha yansıtır.
onValue(ref(db, "operasyon/kadro"), (snapshot) => {
    if (snapshot.exists()) {
        localStudents = snapshot.val();
        localStorage.removeItem("rosterDraft"); // Veritabanı mühürlendiği için yerel taslağı temizle.
        console.log("[KARARGAH]: Canlı kadro veritabanından senkronize edildi.");
    } else {
        // Veritabanında kadro yoksa, yerel öğrenci listesini temizle.
        // Bu, 'renderDashboard'un "veri bekleniyor" mesajını göstermesini sağlar.
        localStudents = [];
    }
    // Arayüzü mevcut skor önbelleği ile yeniden çiz.
    renderDashboard(liveScoresCache);
});

// Skor verilerini dinle
onValue(ref(db, "operasyon/skorlar"), (scoreSnap) => {
    liveScoresCache = scoreSnap.val() || {};
    // Arayüzü mevcut kadro ile yeniden çiz.
    renderDashboard(liveScoresCache);
});

// --- 4. DOSYA VE OPERASYON YÖNETİMİ ---

// CSV Dosya Yükleme ve Parse İşlemi
document.getElementById("csv-input")?.addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: function (results) {
            localStudents = results.data.map(row => {
                const clean = {};
                Object.entries(row).forEach(([k, v]) => {
                    clean[canonicalHeader(k)] = String(v || "").trim();
                });
                return clean;
            }).filter(s => s["Okul No"] && s["Takım Adı"]);

            localStorage.setItem("rosterDraft", JSON.stringify(localStudents));
            renderDashboard();
            if (localStudents.length > 0) {
                alert(`İŞLEM TAMAM: ${localStudents.length} personel operasyon listesine eklendi.`);
            }
        }
    });
});

// Operasyonu Başlat: Sahadaki tüm birimlere ilk görev emrini ve başlangıç puanlarını gönderir.
document.getElementById("btn-init-op")?.addEventListener("click", () => {
    if (localStudents.length === 0) return alert("HATA: Önce CSV yüklemesi yapmalısınız!");

    const teams = [...new Set(localStudents.map(s => s["Takım Adı"]))].filter(Boolean);
    const initialScores = {};

    teams.forEach(t => {
        initialScores[t] = {
            puan: 1000,
            bolge: "2A",
            gorevNo: 1,
            durum: "Bağlantı Bekleniyor",
            ipucuSayisi: 0,
            hataSayisi: 0 // Hata takip sistemi karargah için mühürlendi.
        };
    });

    const payload = {
        kadro: localStudents,
        skorlar: initialScores,
    };

    update(ref(db, "operasyon"), payload)
        .then(() => {
            localStorage.removeItem("rosterDraft");
            alert("OPERASYON BAŞLATILDI");
        })
        .catch(() => {
            alert("KRİTİK HATA");
        });
});

// --- 5. SİSTEM SIFIRLAMA (WIPE OUT) ---
// Karargah ve saha üzerindeki tüm dijital izleri temizler.
document.getElementById("btn-reset-db")?.addEventListener("click", () => {
    if (confirm("DİKKAT: Sunucudaki tüm canlı veriler ve yerel hafıza silinecek. Emin misiniz?")) {
        set(ref(db, "operasyon"), null).then(() => {
            localStudents = [];
            localStorage.removeItem("rosterDraft");
            renderDashboard();
            alert("SİSTEM SIFIRLANDI: Tüm saha temizlendi.");
        }).catch(err => {
            alert("SIFIRLAMA HATASI: Bağlantı kesilmiş olabilir.");
        });
    }
});