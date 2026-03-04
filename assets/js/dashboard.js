/* * dashboard.js - Sürüm: v2.4.2
 * Güncelleme: Veri senkronizasyonu ve otomatik eşleşme optimize edildi.
 */
import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];
const HEADER_ALIASES = {
    okulno: "Okul No", adisoyadi: "Adı Soyadı", takimadi: "Takım Adı", gorev: "Görev"
};

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

function renderDashboard(liveScores = {}) {
    const tbody = document.getElementById("status-body");
    if (!tbody) return;
    if (localStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff3e3e;">[SİSTEM]: Kadro bekleniyor...</td></tr>';
        return;
    }

    let rowsHTML = "";
    localStudents.forEach((student) => {
        const team = student["Takım Adı"];
        const stats = liveScores[team] || { puan: 1000, sektor: "2A", durum: "Sinyal Bekleniyor" };

        rowsHTML += `
            <tr>
                <td><span class="id-tag">${student["Okul No"] || "---"}</span></td>
                <td>${team}</td>
                <td><span class="sector-tag">${stats.sektor || "2A"}</span></td>
                <td class="neon-text">${stats.puan || 1000}</td>
                <td>
                    <strong>${student["Adı Soyadı"]}</strong>
                    <br><small style="color:${getStatusColor(stats.durum)}">${stats.durum}</small>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHTML;
}

function getStatusColor(s) {
    if (s === "Bağlantı Kuruldu" || s === "Başarılı") return "#39FF14";
    if (s === "İpucu Aldı") return "#00d4ff";
    if (s.includes("Hata")) return "#ff3e3e";
    return "#888";
}

// KRİTİK: Firebase'den verileri çek ve dinle
onValue(ref(db, "operasyon/kadro"), (snap) => {
    if (snap.exists()) {
        localStudents = snap.val();
        onValue(ref(db, "operasyon/skorlar"), (sSnap) => {
            renderDashboard(sSnap.val() || {});
        });
    }
});

document.getElementById("csv-input").addEventListener("change", function(e) {
    const file = e.target.files?.[0];
    Papa.parse(file, {
        header: true, skipEmptyLines: true, encoding: "UTF-8", transformHeader: canonicalHeader,
        complete: (r) => {
            localStudents = r.data.map(row => {
                const clean = {};
                Object.entries(row).forEach(([k, v]) => clean[canonicalHeader(k)] = String(v).trim());
                return clean;
            }).filter(s => s["Okul No"]);
            renderDashboard();
        }
    });
});

document.getElementById("btn-init-op").addEventListener("click", () => {
    if (localStudents.length === 0) return alert("Önce CSV yükle!");
    const teams = [...new Set(localStudents.map(s => s["Takım Adı"]))].filter(Boolean);
    const scores = {};
    teams.forEach(t => scores[t] = { puan: 1000, sektor: "2A", durum: "Sinyal Bekleniyor" });
    set(ref(db, "operasyon/skorlar"), scores);
    set(ref(db, "operasyon/kadro"), localStudents).then(() => alert("Operasyon Başladı."));
});