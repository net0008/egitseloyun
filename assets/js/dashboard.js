import { db, ref, set } from "./firebase-config.js";

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

function renderPreview() {
    const tbody = document.getElementById("status-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    localStudents.forEach((student) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><span class="id-tag">${student["Okul No"] || "---"}</span></td>
            <td>${student["Takım Adı"] || "Bilinmiyor"}</td>
            <td>2A</td>
            <td class="neon-text">1000</td>
            <td>
                <strong>${student["Adı Soyadı"] || "İsim Hatası"}</strong>
                <span class="role-text">(${student["Görev"] || "Analist"})</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById("csv-input").addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        delimiter: "",
        skipEmptyLines: true,
        encoding: "UTF-8",
        transformHeader: canonicalHeader,
        complete: function (results) {
            const missingHeaders = getMissingHeaders(results.meta?.fields || []);
            if (missingHeaders.length > 0) {
                alert(`HATA: CSV başlıkları eksik veya farklı. Eksik alan(lar): ${missingHeaders.join(", ")}`);
                localStudents = [];
                renderPreview();
                return;
            }

            localStudents = (results.data || []).map(sanitizeRow).filter(hasContent);

            if (localStudents.length === 0) {
                alert("HATA: CSV dosyasında geçerli personel satırı bulunamadı.");
                renderPreview();
                return;
            }

            console.log("Personel verileri yüklendi:", localStudents);
            renderPreview();
            alert(`SİSTEM ONAYI: ${localStudents.length} personel verisi yüklendi.`);
        },
        error: function (error) {
            console.error("CSV okunamadı:", error);
            alert("HATA: CSV dosyası okunamadı. Dosya formatını kontrol edin.");
        }
    });
});

document.getElementById("btn-init-op").addEventListener("click", function () {
    if (localStudents.length === 0) {
        alert("HATA: Önce personel listesini sisteme yükleyin!");
        return;
    }

    const teamsInFile = [...new Set(localStudents.map((s) => s["Takım Adı"]))].filter(Boolean);

    teamsInFile.forEach((team) => {
        set(ref(db, `operasyon/skorlar/${team}`), {
            puan: 1000,
            sektor: "2A",
            durum: "Aktif"
        });
    });

    set(ref(db, "operasyon/kadro"), localStudents).then(() => {
        alert("SİSTEM KİLİTLENDİ: Operasyonel veri akışı kilitlendi.");
    });
});