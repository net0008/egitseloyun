// main.js - Giriş Terminali, Canlı Saha Durumu Dedektörü ve Randevu Yönetimi
import { db, ref, set, onValue, get } from "./assets/js/firebase-config.js";

console.log("Saha Terminali Giriş Sistemi Aktif.");

// Standart MEB Ders Saatleri Blokları
const STANDARD_SLOTS = [
    "08:30 - 09:10",
    "09:20 - 10:00",
    "10:10 - 10:50",
    "11:00 - 11:40",
    "11:50 - 12:30",
    "13:10 - 13:50",
    "14:00 - 14:40",
    "14:50 - 15:30",
    "15:40 - 16:20"
];

// Önbellekler
let reservationsCache = {};
let scoresCache = {};

// Elementler
const statusBanner = document.getElementById('field-status-banner');
const statusTitle = document.getElementById('field-status-title');
const statusDesc = document.getElementById('field-status-desc');

const reservationModal = document.getElementById('reservation-modal');
const btnOpenReservation = document.getElementById('btn-open-reservation');
const btnCloseReservation = document.getElementById('btn-close-reservation');

const resTarihInput = document.getElementById('res-tarih');
const resDersSaatiInput = document.getElementById('res-ders-saati');
const resOkulAdiInput = document.getElementById('res-okul-adi');
const resOgretmenAdiInput = document.getElementById('res-ogretmen-adi');
const resSinifSubeInput = document.getElementById('res-sinif-sube');
const btnSaveReservation = document.getElementById('btn-save-reservation');
const resFormMsg = document.getElementById('res-form-msg');
const resSlotsList = document.getElementById('res-slots-list');
const resFilterDateLabel = document.getElementById('res-filter-date-label');

// Bugünün tarihini YYYY-MM-DD olarak al
function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 1. DEDEKTÖR: Saha Durumunu Hesapla ve Güncelle
function evaluateFieldStatus() {
    if (!statusBanner) return;

    const now = new Date();
    const todayStr = getTodayString();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let isBusy = false;
    let busyReason = "";

    // A) Randevu Kontrolü: Bugünün randevularında şu anki saate denk gelen var mı?
    if (reservationsCache) {
        for (const key in reservationsCache) {
            const res = reservationsCache[key];
            if (res && res.tarih === todayStr && res.dersSaati) {
                // Ders saati çözümle: "09:00 - 09:40"
                const parts = res.dersSaati.split('-').map(s => s.trim());
                if (parts.length === 2) {
                    const [startH, startM] = parts[0].split(':').map(Number);
                    const [endH, endM] = parts[1].split(':').map(Number);
                    const startTotal = startH * 60 + startM;
                    const endTotal = endH * 60 + endM;

                    if (currentMinutes >= startTotal && currentMinutes <= endTotal) {
                        isBusy = true;
                        busyReason = `[${res.okulAdi || 'Okul'} - ${res.sinifSube || 'Sınıf'}] şu an canlı ders seansında (${res.dersSaati}).`;
                        break;
                    }
                }
            }
        }
    }

    // B) Canlı Takım Hareketi Kontrolü: Son 20 dakika içinde operasyon/skorlar altında aktiflik var mı?
    if (!isBusy && scoresCache) {
        const twentyMinsAgo = Date.now() - (20 * 60 * 1000);
        for (const tName in scoresCache) {
            const s = scoresCache[tName];
            if (!s) continue;
            // sonAktiflik timestamp veya ISO string kontrolü
            let lastActiveTime = 0;
            if (s.sonAktiflik) {
                const parsed = new Date(s.sonAktiflik).getTime();
                if (!isNaN(parsed)) lastActiveTime = parsed;
            }
            if (s.timestamp && typeof s.timestamp === 'number') {
                lastActiveTime = Math.max(lastActiveTime, s.timestamp);
            }

            // Ayrıca gorevNo tamamlanmamışsa ve son 20 dakikada aktifse
            if (lastActiveTime > twentyMinsAgo && (s.gorevNo || 1) <= 10 && s.durum !== 'Bağlantı Bekleniyor') {
                isBusy = true;
                busyReason = `[${tName}] timi ve sınıfı sahada aktif görev çözüyor.`;
                break;
            }
        }
    }

    // Arayüzü Güncelle
    if (isBusy) {
        statusBanner.className = 'field-status-banner busy';
        if (statusTitle) statusTitle.textContent = '🔴 CANLI OPERASYON SÜRÜYOR (Saha Meşgul)';
        if (statusDesc) {
            statusDesc.innerHTML = `Dikkat: ${busyReason} Verilerin çakışmaması için lütfen seans bitimini bekleyin veya aşağıdaki takvimden randevu alın.`;
        }
    } else {
        statusBanner.className = 'field-status-banner available';
        if (statusTitle) statusTitle.textContent = '🟢 SİSTEM BOŞTA (Saha Müsait)';
        if (statusDesc) {
            statusDesc.textContent = 'Operasyon Hattı Açık: Saha şu an boşta. Takımınızı seçip göreve başlayabilirsiniz.';
        }
    }
}

// 2. TAKVİM VE SEANS LİSTESİ RENDER
function renderSlotsForDate(selectedDate) {
    if (!resSlotsList) return;
    if (resFilterDateLabel) resFilterDateLabel.textContent = selectedDate;

    resSlotsList.innerHTML = '';

    // Seçilen tarihteki randevuları bul
    const bookedMap = {};
    if (reservationsCache) {
        for (const id in reservationsCache) {
            const r = reservationsCache[id];
            if (r && r.tarih === selectedDate) {
                bookedMap[r.dersSaati] = r;
            }
        }
    }

    STANDARD_SLOTS.forEach(slot => {
        const isBooked = !!bookedMap[slot];
        const resInfo = bookedMap[slot];
        const div = document.createElement('div');
        div.className = `slot-item ${isBooked ? 'booked' : 'free'}`;

        if (isBooked) {
            div.innerHTML = `
                <div>
                    <span style="font-weight:bold; color:#fff;">⏰ ${slot}</span>
                    <div style="font-size:0.75rem; color:#ff9999; margin-top:2px;">
                        🏫 ${resInfo.okulAdi || ''} (${resInfo.sinifSube || ''}) - ${resInfo.ogretmenAdi || ''}
                    </div>
                </div>
                <span class="slot-status">DOLU</span>
            `;
        } else {
            div.innerHTML = `
                <div>
                    <span style="font-weight:bold; color:#fff;">⏰ ${slot}</span>
                    <div style="font-size:0.75rem; color:#88ff88; margin-top:2px;">
                        Müsait Ders Seansı
                    </div>
                </div>
                <span class="slot-status">MÜSAİT</span>
            `;
        }
        resSlotsList.appendChild(div);
    });
}

// 3. FİREBASE VERİ DİNLEYİCİLERİ
const reservationsRef = ref(db, 'operasyon/randevular');
const scoresRef = ref(db, 'operasyon/skorlar');

onValue(reservationsRef, (snapshot) => {
    reservationsCache = snapshot.val() || {};
    evaluateFieldStatus();
    if (resTarihInput && resTarihInput.value) {
        renderSlotsForDate(resTarihInput.value);
    }
});

onValue(scoresRef, (snapshot) => {
    scoresCache = snapshot.val() || {};
    evaluateFieldStatus();
});

// Periyodik kontrol (dakikada bir)
setInterval(evaluateFieldStatus, 30000);

// 4. RANDEVU MODALI OLAYLARI
if (btnOpenReservation && reservationModal) {
    btnOpenReservation.addEventListener('click', () => {
        reservationModal.style.display = 'block';
        if (resTarihInput && !resTarihInput.value) {
            const today = getTodayString();
            resTarihInput.value = today;
            resTarihInput.min = today;
            renderSlotsForDate(today);
        }
    });
}

if (btnCloseReservation && reservationModal) {
    btnCloseReservation.addEventListener('click', () => {
        reservationModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === reservationModal) {
        reservationModal.style.display = 'none';
    }
});

if (resTarihInput) {
    resTarihInput.addEventListener('change', () => {
        renderSlotsForDate(resTarihInput.value);
    });
}

// 5. YENİ RANDEVU KAYDI & ÇAKIŞMA KONTROLÜ
if (btnSaveReservation) {
    btnSaveReservation.addEventListener('click', async () => {
        const tarih = resTarihInput?.value?.trim();
        const dersSaati = resDersSaatiInput?.value?.trim();
        const okulAdi = resOkulAdiInput?.value?.trim();
        const ogretmenAdi = resOgretmenAdiInput?.value?.trim();
        const sinifSube = resSinifSubeInput?.value?.trim();

        if (!tarih || !dersSaati || !okulAdi || !ogretmenAdi || !sinifSube) {
            if (resFormMsg) {
                resFormMsg.style.color = 'var(--warning-red)';
                resFormMsg.textContent = 'Lütfen tüm alanları eksiksiz doldurun.';
            }
            return;
        }

        btnSaveReservation.disabled = true;
        btnSaveReservation.textContent = 'KONTROL EDİLİYOR...';

        try {
            // Sunucudaki son veriyi alarak çakışma kontrolü yap
            const snap = await get(reservationsRef);
            const currentReservations = snap.val() || {};

            let conflict = false;
            let conflictSchool = "";

            for (const id in currentReservations) {
                const r = currentReservations[id];
                if (r && r.tarih === tarih && r.dersSaati === dersSaati) {
                    conflict = true;
                    conflictSchool = `${r.okulAdi} (${r.sinifSube})`;
                    break;
                }
            }

            if (conflict) {
                if (resFormMsg) {
                    resFormMsg.style.color = 'var(--warning-red)';
                    resFormMsg.textContent = `HATA: ${tarih} günü ${dersSaati} saati zaten ${conflictSchool} tarafından rezerve edilmiş!`;
                }
                btnSaveReservation.disabled = false;
                btnSaveReservation.textContent = '💾 SEANSI REZERVE ET';
                return;
            }

            // Benzersiz anahtar oluştur: tarih_dersSaati (sanitize)
            const safeKey = `${tarih}_${dersSaati.replace(/[^0-9]/g, '')}`;
            const newResRef = ref(db, `operasyon/randevular/${safeKey}`);

            await set(newResRef, {
                tarih,
                dersSaati,
                okulAdi,
                ogretmenAdi,
                sinifSube,
                olusturulmaZamani: Date.now()
            });

            if (resFormMsg) {
                resFormMsg.style.color = 'var(--neon-green)';
                resFormMsg.textContent = '✓ Randevunuz başarıyla oluşturuldu! Sınıfınız bu saatte operasyona katılabilir.';
            }

            // Formu temizle
            if (resOkulAdiInput) resOkulAdiInput.value = '';
            if (resOgretmenAdiInput) resOgretmenAdiInput.value = '';
            if (resSinifSubeInput) resSinifSubeInput.value = '';
            if (resDersSaatiInput) resDersSaatiInput.value = '';

            renderSlotsForDate(tarih);
            evaluateFieldStatus();

        } catch (err) {
            console.error("Randevu kayıt hatası:", err);
            if (resFormMsg) {
                resFormMsg.style.color = 'var(--warning-red)';
                resFormMsg.textContent = 'Bağlantı hatası: Randevu kaydedilemedi.';
            }
        } finally {
            btnSaveReservation.disabled = false;
            btnSaveReservation.textContent = '💾 SEANSI REZERVE ET';
        }
    });
}

// 6. TAKIM SEÇİMİ VE YÖNLENDİRME
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.team-btn');
    if (btn) {
        const teamName = btn.getAttribute('data-team');
        console.log("Seçilen Tim:", teamName);
        if (teamName) {
            const targetURL = `operasyon.html?team=${encodeURIComponent(teamName)}`;
            window.location.replace(targetURL);
        }
    }
});