/* * dashboard.js - Sürüm: v2.9.0
 * Karargâh Canlı İzleme ve Veri Yönetim Sistemi
 * [Hasbi Erdoğmuş - Sistem Temizlik & Taslak Hafızası Protokolü]
 */

import { db, ref, set, onValue } from "./firebase-config.js";

// --- 0. HAFIZA BAŞLATICI ---
// Sayfa açıldığında tarayıcıda yarım kalmış bir CSV yüklemesi var mı kontrol et
let localStudents = JSON.parse(localStorage.getItem("rosterDraft") || "[]");

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
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
        .replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c")
        .replace(/[^a-z0-9]/g, "");
}

function canonicalHeader(header = "") {
    const normalized = normalizeKey(header);
    return HEADER_ALIASES[normalized] || String(header).replace(/^\uFEFF/, "").trim();
}

// --- 2. GÖRSELLEŞTİRME MOTORU ---
function getStatusColor(status) {
    if (!status) return "#888";
    if (status === "Bağlantı Kuruldu" || status === "Başarılı") return "#39FF14";
    if (status.includes("İpucu")) return "#00d4ff"; // İpucu durumunda mavi yanar
    if (status.includes("Hata") || status.includes("Hatalı") || status.includes("Bilemedi") || status.includes("Destek")) return "#ff3e3e";
    return "#39FF14"; // Diğer aktif durumlar için yeşil
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
        const stats = liveScores[teamName] || { puan: 1000, sektor: "2A", durum: "Sinyal Bekleniyor" };

        rowsHTML += `
            <tr>
                <td><span class="id-tag">${student["Okul No"] || "---"}</span></td>
                <td>${teamName || "Bilinmiyor"}</td>
                <td><span class="sector-tag">${stats.sektor || stats.bolge || "2A"}</span></td>
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
// Veritabanında hali hazırda bir kadro varsa, yerel taslağı ezer ve orayı dinler
onValue(ref(db, "operasyon/kadro"), (snapshot) => {
    if (snapshot.exists()) {
        localStudents = snapshot.val();
        localStorage.removeItem("rosterDraft"); // Veritabanında varsa taslağa gerek yok
        console.log("[SİSTEM]: Canlı kadro veritabanından yüklendi.");
        onValue(ref(db, "operasyon/skorlar"), (scoreSnap) => {
            renderDashboard(scoreSnap.val() || {});
        });
    } else {
        // Veritabanı boşsa ama hafızada taslak varsa onu render et
        renderDashboard();
    }
});

// --- 4. ETKİLEŞİM VE DOSYA YÖNETİMİ ---

// CSV Yükleme
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

            // KRİTİK: Yüklenen veriyi tarayıcı hafızasına (taslak olarak) kaydet
            localStorage.setItem("rosterDraft", JSON.stringify(localStudents));
            
            renderDashboard();
            if (localStudents.length > 0) alert(`BAŞARILI: ${localStudents.length} personel taslak olarak yüklendi.`);
        }
    });
});

// Operasyonu Başlat
document.getElementById("btn-init-op").addEventListener("click", () => {
    if (localStudents.length === 0) return alert("Önce CSV yüklemelisiniz!");

    const teams = [...new Set(localStudents.map(s => s["Takım Adı"]))].filter(Boolean);
    const initialScores = {};
    teams.forEach(t => initialScores[t] = { 
        puan: 1000, 
        bolge: "2A", 
        gorevNo: 1, 
        durum: "Sinyal Bekleniyor",
        ipucuSayisi: 0 
    });

    set(ref(db, "operasyon/skorlar"), initialScores);
    set(ref(db, "operasyon/kadro"), localStudents).then(() => {
        localStorage.removeItem("rosterDraft"); // Başarıyla yüklendiği için taslağı silebiliriz
        alert("OPERASYON BAŞLATILDI: Tüm birimlere görev emri gönderildi.");
    });
});

// --- 5. KRİTİK: SUNUCU SIFIRLAMA ---
document.getElementById("btn-reset-db").addEventListener("click", () => {
    if (confirm("DİKKAT: Sunucudaki ve hafızadaki tüm veriler silinecek. Emin misiniz?")) {
        set(ref(db, "operasyon"), null).then(() => {
            localStudents = [];
            localStorage.removeItem("rosterDraft"); // Hafızayı da temizle
            renderDashboard();
            alert("SİSTEM SIFIRLANDI: Hafıza ve Sunucu temizlendi.");
        });
    }
});