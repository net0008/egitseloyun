/* * dashboard.js - Sürüm: v2.3.5
 * Karargâh Canlı İzleme ve Veri Yönetim Sistemi
 */

import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];

const REQUIRED_HEADERS = ["Okul No", "Adı Soyadı", "Takım Adı"];

const HEADER_ALIASES = {
    okulno: "Okul No",
    okulnumarasi: "Okul No",
    ogrencino: "Okul No",
    numara: "Okul No",
    adisoyadi: "Adı Soyadı",
    adsoyad: "Adı Soyadı",
    advesoyad: "Adı Soyadı",
    isimsoyisim: "Adı Soyadı",
    adisoyisim: "Adı Soyadı",
    takimadi: "Takım Adı",
    takim: "Takım Adı",
    gorev: "Görev"
};

// --- YARDIMCI FONKSİYONLAR ---

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

function sanitizeValue(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function sanitizeRow(row = {}) {
    const cleanRow = {};
    Object.entries(row).forEach(([key, value]) => {
        cleanRow[canonicalHeader(key)] = sanitizeValue(value);
    });
    return cleanRow;
}

function hasContent(student) {
    return REQUIRED_HEADERS.some((header) => Boolean(student[header]));
}

function getMissingHeaders(fields = []) {
    const normalizedFields = new Set(fields.map(canonicalHeader));
    return REQUIRED_HEADERS.filter((header) => !normalizedFields.has(header));
}

// --- GÖRSELLEŞTİRME VE CANLI TAKİP ---

/**
 * Tabloyu hem yerel verilerle hem de Firebase'den gelen canlı skorlarla günceller.
 * @param {Object} liveData Firebase'den gelen 'operasyon/skorlar' verisi
 */
function renderDashboard(liveData = {}) {
    const tbody = document.getElementById("status-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (localStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Veri bekleniyor... Lütfen CSV yükleyin.</td></tr>';
        return;
    }

    localStudents.forEach((student) => {
        const teamName = student["Takım Adı"];
        // Eğer Firebase'de bu takıma ait veri varsa çek, yoksa varsayılanı kullan
        const stats = liveData[teamName] || { puan: 1000, sektor: "2A", durum: "Hazır" };

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><span class="id-tag">${student["Okul No"] || "---"}</span></td>
            <td>${teamName || "Bilinmiyor"}</td>
            <td>${stats.sektor || "2A"}</td>
            <td class="neon-text">${stats.puan || 1000}</td>
            <td>
                <strong>${student["Adı Soyadı"] || "İsim Hatası"}</strong>
                <span class="role-text">(${stats.durum || student["Görev"] || "Analist"})</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 1. Canlı İzleme Dinleyicisi: Firebase'de skor değiştikçe tabloyu tazeler
onValue(ref(db, "operasyon/skorlar"), (snapshot) => {
    const data = snapshot.val() || {};
    renderDashboard(data);
});

// --- EVENT LISTENERS (ETKİLEŞİM) ---

// CSV Dosyası Seçildiğinde
document.getElementById("csv-input").addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        delimiter: "", // Otomatik tespit
        skipEmptyLines: true,
        encoding: "UTF-8",
        transformHeader: canonicalHeader,
        complete: function (results) {
            const missingHeaders = getMissingHeaders(results.meta?.fields || []);
            if (missingHeaders.length > 0) {
                alert(`HATA: CSV başlıkları eksik. Eksik alan(lar): ${missingHeaders.join(", ")}`);
                localStudents = [];
                renderDashboard();
                return;
            }

            localStudents = (results.data || []).map(sanitizeRow).filter(hasContent);

            if (localStudents.length === 0) {
                alert("HATA: CSV dosyasında geçerli personel bulunamadı.");
                renderDashboard();
                return;
            }

            console.log("CSV Yüklendi:", localStudents);
            renderDashboard(); 
            alert(`SİSTEM ONAYI: ${localStudents.length} personel verisi hazır.`);
        },
        error: function (error) {
            alert("HATA: CSV okunamadı. Formatı kontrol edin.");
        }
    });
});

// Operasyonu Başlat Düğmesi
document.getElementById("btn-init-op").addEventListener("click", function () {
    if (localStudents.length === 0) {
        alert("HATA: Önce personel listesini sisteme yükleyin!");
        return;
    }

    const teamsInFile = [...new Set(localStudents.map((s) => s["Takım Adı"]))].filter(Boolean);

    // Her takım için başlangıç değerlerini buluta gönder
    teamsInFile.forEach((team) => {
        set(ref(db, `operasyon/skorlar/${team}`), {
            puan: 1000,
            sektor: "2A",
            durum: "Aktif"
        });
    });

    // Tüm kadroyu buluta yedekle
    set(ref(db, "operasyon/kadro"), localStudents).then(() => {
        alert("SİSTEM KİLİTLENDİ: Operasyonel veri akışı canlıya alındı.");
    });
});