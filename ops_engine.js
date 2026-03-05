/* * ops_engine.js - Sürüm: v3.4.5
 * Hasbi Erdoğmuş | Kutulu Mesajlar, Numaralı İpuçları ve Puan Sistemi
 */
import { db, ref, onValue, update, get } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const teamName = decodeURIComponent(params.get('team') || "");
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
const terminal = document.getElementById('terminal-output');

// Resmi Coğrafya İpuçları (İpucu #1'den başlar)
const geo_hints = [
    "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.",
    "Deniz kıyı çizgisi ile kıyıdan itibaren ilk izohips eğrisi arasındaki fark eküidistans değeridir. Yani yükselti farkıdır.",
    "Birbirini çevrelemeyen komşu iki izohipsin yükselti değeri aynıdır. Yükselti farkı 200m. Kıyıdan itibaren izohipsleri say. (Yükseklik = İzohips Sayısı x 200)"
];

// --- YARDIMCI: KUTULU MESAJ MOTORU ---
function logBox(message, type = "") {
    if (!terminal) return;
    const div = document.createElement('div');
    div.className = `terminal-msg ${type}`; // style.css'deki .terminal-msg sınıflarını kullanır
    div.innerHTML = `> ${message}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

// --- 1. İPUCU TALEBİ VE CEZA SİSTEMİ ---
document.getElementById('btn-hint').addEventListener('click', async () => {
    const snap = await get(scoreRef);
    const data = snap.val();
    const count = data.ipucuSayisi || 0;

    if (count === 0) {
        // İLK BASIŞ: Bilgilendirme (Puan düşmez, resmi ipucu sayılmaz)
        logBox("Saha kılavuzunu dikkatlice okudun mu?", "hint");
        await update(scoreRef, { ipucuSayisi: 1, durum: "Kılavuz Kontrol Edildi" });
    } else if (count <= geo_hints.length) {
        // SONRAKİ BASIŞLAR: Numaralı Coğrafya İpuçları (-50 Puan)
        const hintIdx = count - 1;
        const newScore = Math.max(0, (data.puan || 1000) - 50);
        
        await update(scoreRef, {
            puan: newScore,
            ipucuSayisi: count + 1,
            durum: `İpucu #${count} Kullanıldı`
        });
        logBox(`[İPUCU #${count}]: ${geo_hints[hintIdx]}`, "hint");
    } else {
        logBox("Mevcut bölge için tüm veri paketleri (ipuçları) kullanıldı.", "warning");
    }
});

// --- 2. DOĞRULAMA (ONAYLA) SİSTEMİ ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const input = document.getElementById('kripto-val').value.trim();
    const snap = await get(scoreRef);
    const data = snap.val();
    
    // GÖREV 1 (2A Bölgesi): 200m karesi = 40000
    if ((data.gorevNo === 1 || data.sektor === "2A") && input === "40000") {
        await update(scoreRef, {
            gorevNo: 2, bolge: "2B", puan: (data.puan || 1000) + 200, durum: "Başarılı", ipucuSayisi: 0
        });
        logBox("BAŞARILI! Veri doğrulandı. 2. Görev 2B Bölgesi aktif edildi.", "success");
        document.getElementById('active-map').src = "assets/img/soru2.png";
    } else {
        // 3 İpucu sonrası yanlış cevap uyarısı
        if (data.ipucuSayisi >= 4) {
            await update(scoreRef, { durum: "3. Soruyu Doğru Cevaplayamadı!" });
            logBox("KRİTİK ANALİZ HATASI: Karargâh desteği bekleniyor!", "warning");
        } else {
            await update(scoreRef, { durum: "Hatalı Giriş" });
            logBox("HATA: Gönderilen kripto kodu geçersiz.", "warning");
        }
    }
    document.getElementById('kripto-val').value = "";
});

// --- 3. CANLI VERİ VE BAŞLANGIÇ MESAJLARI ---
onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // Arayüz Güncelleme
    document.getElementById('current-score').innerText = data.puan || 1000;
    const task = data.gorevNo || 1;
    const region = data.bolge || data.sektor || "2A";
    document.getElementById('current-sector').innerText = `${task}. Görev ${region} Bölgesi`;
    
    // Yıldız Boyama Mantığı (3, 6, 9, 10)
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, i) => {
        star.classList.remove('filled');
        if (task >= 3 && i === 0) star.classList.add('filled');
        if (task >= 6 && i <= 1) star.classList.add('filled');
        if (task >= 9 && i <= 2) star.classList.add('filled');
        if (task >= 10 && i <= 3) star.classList.add('filled');
    });
}, { onlyOnce: false });

// Terminali İlk Mesajlarla Doldur (Kutu İçinde)
terminal.innerHTML = ""; 
logBox("[SİSTEM]: Bağlantı güvenli değil.", "warning");
logBox("[MERKEZ]: Haritadaki konumun yüksekliğini bul ve şifreli olarak gönder.", "");
logBox("<span style='color:#ff3e3e; font-weight:bold;'>DİKKAT:</span> Karşıt unsurların sızmaması için yükselti değerinin karesini ($h^2$) girmelisin!", "warning");