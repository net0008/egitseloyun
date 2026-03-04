/* * dashboard.js - Sürüm: v2.7.0
 * Karargâh Canlı İzleme ve Veri Yönetim Sistemi
 * [Hasbi Erdoğmuş - Operasyonel Mühür]
 */

import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];

// --- 1. VERİ NORMALİZASYON SİSTEMİ ---
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

function normalizeKey(text = "") {
    return String(text)
        .replace(/^\uFEFF/, "")
        .trim()
        .toLocaleLowerCase("tr")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]/g, "");
}

function canonicalHeader(header = "") {
    const normalized = normalizeKey(header);
    return HEADER_ALIASES[normalized] || String(header).replace(/^\uFEFF/, "").trim();
}

// --- 2. GÖRSELLEŞTİRME MOTORU ---

function getStatusColor(status) {
    if (status === "Bağlantı Kuruldu" || status === "Başarılı") return "#39FF14"; // Neon Yeşil
    if (status === "İpucu Aldı") return "#00d4ff"; // Siber Mavi
    if (status.includes("Hata") || status.includes("Hatalı")) return "#ff3e3e"; // Uyarı Kırmızısı
    return "#888"; // Bekleme Grisi
}

function renderDashboard(liveScores = {}) {
    const tbody = document.getElementById("status-body");
    if (!tbody) return;

    if (localStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff3e3e; padding:20px;">[SİSTEM]: Kadro verisi bekleniyor. Lütfen CSV yükleyin.</td></tr>';
        return;
    }

    let rowsHTML = "";
    localStudents.forEach((student) => {
        const teamName = student["Takım Adı"];
        // Firebase'den gelen canlı veriyi yakala, yoksa varsayılanı göster
        const stats = liveScores[teamName] || { puan: 1000, sektor: "2A", durum: "Sinyal Bekleniyor" };

        rowsHTML += `
            <tr>
                <td><span class="id-tag">${student["Okul No"] || "---"}</span></td>
                <td>${teamName || "Bilinmiyor"}</td>
                <td><span class="sector-tag">${stats.sektor || "2A"}</span></td>
                <td class="neon-text">${stats.puan || 1000}</td>
                <td>
                    <strong>${student["Adı Soyadı"]}</strong>
                    <br><small style="color:${getStatusColor(stats.durum)}; font-weight:bold;">${stats.durum}</small>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHTML;
}

// --- 3. FİREBASE SENKRONİZASYONU ---

// Sayfa açıldığında veya veri değiştiğinde kadroyu ve skorları çek
onValue(ref(db, "operasyon/kadro"), (snapshot) => {
    if (snapshot.exists()) {
        localStudents = snapshot.val();
        console.log("[SİSTEM]: Kadro Firebase'den geri yüklendi.");
        
        // Kadro varsa, skorları dinlemeye başla
        onValue(ref(db, "operasyon/skorlar"), (scoreSnap) => {
            renderDashboard(scoreSnap.val() || {});
        });
    } else {
        renderDashboard(); // Boş tabloyu göster
    }
});

// --- 4. ETKİLEŞİM VE DOSYA YÖNETİMİ ---

// CSV Dosyası Yükleme
document.getElementById("csv-input").addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        transformHeader: canonicalHeader,
        complete: function (results) {
            localStudents = results.data.map(row => {
                const clean = {};
                Object.entries(row).forEach(([k, v]) => {
                    clean[canonicalHeader(k)] = String(v || "").trim();
                });
                return clean;
            }).filter(s => s["Okul No"] && s["Takım Adı"]);

            if (localStudents.length > 0) {
                renderDashboard();
                alert(`BAŞARILI: ${localStudents.length} personel sisteme tanıtıldı.`);
            } else {
                alert("HATA: CSV içeriği anlaşılamadı. Başlıkları kontrol edin.");
            }
        }
    });
});

// Operasyonu Başlat Butonu
document.getElementById("btn-init-op").addEventListener("click", () => {
    if (localStudents.length === 0) {
        alert("HATA: Önce personel listesini yüklemelisiniz!");
        return;
    }

    const teams = [...new Set(localStudents.map(s => s["Takım Adı"]))].filter(Boolean);
    const initialScores = {};

    teams.forEach(team => {
        initialScores[team] = {
            puan: 1000,
            sektor: "2A",
            durum: "Sinyal Bekleniyor"
        };
    });

    // Verileri Firebase'e Mühürle
    set(ref(db, "operasyon/skorlar"), initialScores);
    set(ref(db, "operasyon/kadro"), localStudents).then(() => {
        alert("OPERASYON BAŞLATILDI: Tüm terminaller izlemeye alındı.");
    });
});