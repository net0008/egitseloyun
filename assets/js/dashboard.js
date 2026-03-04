/* * dashboard.js - Sürüm: v2.4.0
 * Karargâh Canlı İzleme ve Veri Yönetim Sistemi
 * Değişiklik Notu: Otomatik Kadro Senkronizasyonu ve Canlı Durum Takibi eklendi.
 */

import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];
const REQUIRED_HEADERS = ["Okul No", "Adı Soyadı", "Takım Adı"];

const HEADER_ALIASES = {
    okulno: "Okul No", okulnumarasi: "Okul No", ogrencino: "Okul No", numara: "Okul No",
    adisoyadi: "Adı Soyadı", adsoyad: "Adı Soyadı", takimadi: "Takım Adı", takim: "Takım Adı", gorev: "Görev"
};

// --- NORMALİZASYON VE GÜVENLİK ---
function normalizeKey(text = "") {
    return String(text).replace(/^\uFEFF/, "").trim().toLocaleLowerCase("tr")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
        .replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c")
        .replace(/[^a-z0-9]/g, "");
}

function canonicalHeader(header = "") {
    const normalized = normalizeKey(header);
    return HEADER_ALIASES[normalized] || String(header).replace(/^\uFEFF/, "").trim();
}

function sanitizeRow(row = {}) {
    const cleanRow = {};
    Object.entries(row).forEach(([key, value]) => {
        cleanRow[canonicalHeader(key)] = String(value || "").trim();
    });
    return cleanRow;
}

// --- CANLI TAKİP MOTORU ---

/**
 * Tabloyu hem yerel verilerle hem de Firebase'den gelen canlı skorlarla günceller.
 */
function renderDashboard(liveScores = {}) {
    const tbody = document.getElementById("status-body");
    if (!tbody) return;

    if (localStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff3e3e;">[SİSTEM]: Kadro yüklenmedi veya bekleniyor...</td></tr>';
        return;
    }

    let rowsHTML = "";
    localStudents.forEach((student) => {
        const teamName = student["Takım Adı"];
        // Firebase'den bu takıma ait veriyi çek
        const stats = liveScores[teamName] || { puan: 1000, sektor: "2A", durum: "Hazır" };

        rowsHTML += `
            <tr>
                <td><span class="id-tag">${student["Okul No"] || "---"}</span></td>
                <td>${teamName || "Bilinmiyor"}</td>
                <td><span class="sector-tag">${stats.sektor || "2A"}</span></td>
                <td class="neon-text">${stats.puan || 1000}</td>
                <td>
                    <strong>${student["Adı Soyadı"]}</strong>
                    <br><small class="status-msg" style="color: ${getStatusColor(stats.durum)}">${stats.durum || "Aktif"}</small>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHTML;
}

function getStatusColor(status) {
    if (status === "Başarılı") return "#39FF14";
    if (status === "İpucu Aldı") return "#00d4ff";
    if (status === "Hata Yapıldı" || status === "Hatalı Giriş") return "#ff3e3e";
    return "#888";
}

// --- FİREBASE BAĞLANTILARI ---

// 1. Kadro Takibi: Sayfa açıldığında veya CSV yüklendiğinde kadroyu mühürle
onValue(ref(db, "operasyon/kadro"), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        localStudents = data;
        console.log("[SİSTEM]: Kadro Firebase'den geri yüklendi.");
        // Kadro gelince skorları da dinlemeye başla
        onValue(ref(db, "operasyon/skorlar"), (scoreSnap) => {
            renderDashboard(scoreSnap.val() || {});
        });
    }
});

// --- ETKİLEŞİM YÖNETİMİ ---

document.getElementById("csv-input").addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        transformHeader: canonicalHeader,
        complete: function (results) {
            localStudents = (results.data || []).map(sanitizeRow).filter(row => row["Okul No"]);
            renderDashboard();
            alert(`SİSTEM ONAYI: ${localStudents.length} personel yüklendi. 'Operasyonu Başlat' butonuna basın.`);
        }
    });
});

document.getElementById("btn-init-op").addEventListener("click", function () {
    if (localStudents.length === 0) return alert("Önce CSV yükleyin!");

    const teams = [...new Set(localStudents.map(s => s["Takım Adı"]))].filter(Boolean);
    
    // Skorları ve Kadroyu Firebase'e Mühürle
    const initialScores = {};
    teams.forEach(team => {
        initialScores[team] = { puan: 1000, sektor: "2A", durum: "Aktif" };
    });

    set(ref(db, "operasyon/skorlar"), initialScores);
    set(ref(db, "operasyon/kadro"), localStudents).then(() => {
        alert("OPERASYON BAŞLADI: Tüm terminaller canlı takibe alındı.");
    });
});