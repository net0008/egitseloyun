// main.js - Giriş Terminali, Canlı Saha Durumu Dedektörü, Randevu Yönetimi ve Kodlu Erişim Protokolü
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
let activeSlotReservation = null; // Şu anki saat dilimine ait aktif randevu varsa
let currentFieldIsBusy = false;

// Elementler
const statusBanner = document.getElementById('field-status-banner');
const statusTitle = document.getElementById('field-status-title');
const statusDesc = document.getElementById('field-status-desc');

const codeEntryBox = document.getElementById('code-entry-box');
const inputAccessCode = document.getElementById('input-access-code');
const btnVerifyAccessCode = document.getElementById('btn-verify-access-code');
const codeEntryMsg = document.getElementById('code-entry-msg');

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

// Rastgele benzersiz Randevu Kodu Üretici (Örn: B2050-9A-8419)
function generateAccessCode(sinifSube) {
    const cleanSube = (sinifSube || "TR").replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || "TR";
    const randNum = Math.floor(1000 + Math.random() * 9000);
    return `B2050-${cleanSube}-${randNum}`;
}

// 1. DEDEKTÖR: Saha Durumunu Hesapla, 15 Dakika İptal Kuralını Uygula ve Güncelle
async function evaluateFieldStatus() {
    if (!statusBanner) return;

    const now = new Date();
    const todayStr = getTodayString();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let isBusy = false;
    let busyReason = "";
    activeSlotReservation = null;

    // A) Randevu Kontrolü: Bugünün randevularında şu anki saate denk gelen var mı?
    if (reservationsCache) {
        for (const key in reservationsCache) {
            const res = reservationsCache[key];
            if (!res || res.tarih !== todayStr || !res.dersSaati) continue;
            if (res.durum === 'iptal_edildi') continue;

            const parts = res.dersSaati.split('-').map(s => s.trim());
            if (parts.length === 2) {
                const [startH, startM] = parts[0].split(':').map(Number);
                const [endH, endM] = parts[1].split(':').map(Number);
                const startTotal = startH * 60 + startM;
                const endTotal = endH * 60 + endM;

                // Şu an bu ders saatinin aralığında mıyız?
                if (currentMinutes >= startTotal && currentMinutes <= endTotal) {
                    activeSlotReservation = { ...res, key };

                    // 15 DAKİKA KURALI:
                    // Randevu saati başladıktan sonra ilk 15 dakika içinde oyun başlatılmış mı?
                    const minutesPassedSinceStart = currentMinutes - startTotal;

                    // Oyunun başlatılıp başlatılmadığını kontrol et:
                    // (res.baslatildi === true VEYA son 20 dakika içinde operasyon/skorlar altında aktivite var mı?)
                    let hasActivity = !!res.baslatildi;
                    if (!hasActivity && scoresCache) {
                        const fifteenMinsAgo = Date.now() - (15 * 60 * 1000);
                        for (const tName in scoresCache) {
                            const sc = scoresCache[tName];
                            if (sc && sc.sonAktiflik) {
                                const parsed = new Date(sc.sonAktiflik).getTime();
                                if (parsed > fifteenMinsAgo && (sc.gorevNo || 1) <= 10 && sc.durum !== 'Bağlantı Bekleniyor') {
                                    hasActivity = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (minutesPassedSinceStart >= 15 && !hasActivity) {
                        // 15 dakika geçmiş ve kimse başlatmamış -> Randevuyu İptal Et!
                        console.warn(`[RANDEVU İPTALİ]: 15 dakika içinde başlatılmadığı için ${res.dersSaati} randevusu iptal edildi.`);
                        set(ref(db, `operasyon/randevular/${key}/durum`), 'iptal_edildi');
                        activeSlotReservation = null;
                        // İptal edildiği için bu randevu sahayı meşgul etmez
                    } else {
                        // Randevu geçerli ve aktif
                        isBusy = true;
                        busyReason = `[${res.okulAdi || 'Okul'} - ${res.sinifSube || 'Sınıf'}] için rezerve edilmiş randevu dilimindesiniz (${res.dersSaati}).`;
                        break;
                    }
                }
            }
        }
    }

    // B) Canlı Takım Hareketi Kontrolü: Son 20 dakika içinde sahada aktif takım var mı?
    if (!isBusy && scoresCache) {
        const twentyMinsAgo = Date.now() - (20 * 60 * 1000);
        for (const tName in scoresCache) {
            const s = scoresCache[tName];
            if (!s) continue;
            let lastActiveTime = 0;
            if (s.sonAktiflik) {
                const parsed = new Date(s.sonAktiflik).getTime();
                if (!isNaN(parsed)) lastActiveTime = parsed;
            }
            if (s.timestamp && typeof s.timestamp === 'number') {
                lastActiveTime = Math.max(lastActiveTime, s.timestamp);
            }

            if (lastActiveTime > twentyMinsAgo && (s.gorevNo || 1) <= 10 && s.durum !== 'Bağlantı Bekleniyor') {
                isBusy = true;
                busyReason = `[${tName}] timi sahada aktif görev çözüyor.`;
                break;
            }
        }
    }

    currentFieldIsBusy = isBusy;

    // Arayüzü ve Randevu Kodu Giriş Kutusunu Güncelle
    if (isBusy) {
        statusBanner.className = 'field-status-banner busy';
        if (statusTitle) statusTitle.textContent = '🔴 CANLI OPERASYON SÜRÜYOR (Saha Meşgul)';
        if (statusDesc) {
            statusDesc.innerHTML = `Dikkat: ${busyReason} Randevulu sınıf iseniz lütfen aşağıdaki alana randevu kodunuzu giriniz; aksi halde seans bitimini bekleyiniz veya takvimden randevu ayarlayınız.`;
        }
        // Saha meşgulken kod kutusunu görünür yap
        if (codeEntryBox) codeEntryBox.style.display = 'block';
    } else {
        statusBanner.className = 'field-status-banner available';
        if (statusTitle) statusTitle.textContent = '🟢 SİSTEM BOŞTA (Saha Müsait)';
        if (statusDesc) {
            statusDesc.textContent = 'Operasyon Hattı Açık: Saha şu an boşta. Takımınızı seçip doğrudan göreve başlayabilirsiniz.';
        }
        // Saha boşken normal giriş serbest, kod kutusu gizlenebilir veya opsiyonel kalabilir
        if (codeEntryBox) codeEntryBox.style.display = 'none';
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
            if (r && r.tarih === selectedDate && r.durum !== 'iptal_edildi') {
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
                        Müsait Görev Saati
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

// Periyodik kontrol (30 saniyede bir durum ve 15dk iptal denetimi)
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

// 5. YENİ RANDEVU KAYDI & KOD OLUŞTURMA
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
                if (r && r.tarih === tarih && r.dersSaati === dersSaati && r.durum !== 'iptal_edildi') {
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
                btnSaveReservation.textContent = '💾 RANDEVUYU ONAYLA';
                return;
            }

            // Benzersiz Randevu Kodu Üret
            const accessCode = generateAccessCode(sinifSube);

            // Benzersiz anahtar oluştur: tarih_dersSaati
            const safeKey = `${tarih}_${dersSaati.replace(/[^0-9]/g, '')}`;
            const newResRef = ref(db, `operasyon/randevular/${safeKey}`);

            await set(newResRef, {
                tarih,
                dersSaati,
                okulAdi,
                ogretmenAdi,
                sinifSube,
                randevuKodu: accessCode,
                durum: 'aktif',
                baslatildi: false,
                olusturulmaZamani: Date.now()
            });

            if (resFormMsg) {
                resFormMsg.innerHTML = `
                    <div style="color: var(--neon-green); margin-bottom: 8px;">✓ Randevunuz başarıyla oluşturuldu!</div>
                    <div style="background: rgba(0,30,0,0.7); border: 1px solid var(--neon-green); padding: 10px; text-align: center; font-size: 1rem; color: #fff;">
                        RANDEVU KODUNUZ: <strong style="color: var(--neon-green); letter-spacing: 2px;">${accessCode}</strong>
                    </div>
                    <div style="font-size: 0.75rem; color: #ff9999; margin-top: 6px;">
                        ⚠️ Bu kodu saklayınız! Randevu saatinizde oyuna bu kod ile gireceksiniz. Randevu saati başladıktan sonra 15 dakika içinde oyunu başlatmazsanız randevunuz iptal edilecektir.
                    </div>
                `;
            }

            // Form inputlarını temizle
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
            btnSaveReservation.textContent = '💾 RANDEVUYU ONAYLA';
        }
    });
}

// 6. RANDEVU KODU DOĞRULAMA (Saha Meşgulken Kod ile Giriş İzni)
if (btnVerifyAccessCode) {
    btnVerifyAccessCode.addEventListener('click', async () => {
        const enteredCode = inputAccessCode?.value?.trim().toUpperCase();
        if (!enteredCode) {
            if (codeEntryMsg) {
                codeEntryMsg.style.color = 'var(--warning-red)';
                codeEntryMsg.textContent = 'Lütfen randevu kodunuzu yazın.';
            }
            return;
        }

        const now = new Date();
        const todayStr = getTodayString();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Rezervasyonlar içinde eşleşen kodu bul
        let foundRes = null;
        let foundKey = null;

        for (const k in reservationsCache) {
            const r = reservationsCache[k];
            if (r && r.randevuKodu && r.randevuKodu.toUpperCase() === enteredCode) {
                foundRes = r;
                foundKey = k;
                break;
            }
        }

        if (!foundRes) {
            if (codeEntryMsg) {
                codeEntryMsg.style.color = 'var(--warning-red)';
                codeEntryMsg.textContent = 'HATA: Geçersiz randevu kodu!';
            }
            return;
        }

        if (foundRes.durum === 'iptal_edildi') {
            if (codeEntryMsg) {
                codeEntryMsg.style.color = 'var(--warning-red)';
                codeEntryMsg.textContent = 'HATA: Bu randevu 15 dakika içinde başlatılmadığı için iptal edilmiş.';
            }
            return;
        }

        // Gün ve Saat Kontrolü
        if (foundRes.tarih !== todayStr) {
            if (codeEntryMsg) {
                codeEntryMsg.style.color = 'var(--warning-red)';
                codeEntryMsg.textContent = `HATA: Randevunuz bugün için değil! Tarih: ${foundRes.tarih}`;
            }
            return;
        }

        const parts = (foundRes.dersSaati || "").split('-').map(s => s.trim());
        if (parts.length === 2) {
            const [startH, startM] = parts[0].split(':').map(Number);
            const [endH, endM] = parts[1].split(':').map(Number);
            const startTotal = startH * 60 + startM;
            const endTotal = endH * 60 + endM;

            if (currentMinutes < startTotal) {
                if (codeEntryMsg) {
                    codeEntryMsg.style.color = 'var(--warning-red)';
                    codeEntryMsg.textContent = `HATA: Randevu saatiniz henüz gelmedi (${foundRes.dersSaati}).`;
                }
                return;
            }

            if (currentMinutes > endTotal) {
                if (codeEntryMsg) {
                    codeEntryMsg.style.color = 'var(--warning-red)';
                    codeEntryMsg.textContent = `HATA: Randevu saatiniz sona ermiş (${foundRes.dersSaati}).`;
                }
                return;
            }

            // 15 Dakika Aşımı Kontrolü
            const diff = currentMinutes - startTotal;
            if (diff >= 15 && !foundRes.baslatildi) {
                set(ref(db, `operasyon/randevular/${foundKey}/durum`), 'iptal_edildi');
                if (codeEntryMsg) {
                    codeEntryMsg.style.color = 'var(--warning-red)';
                    codeEntryMsg.textContent = 'HATA: Randevu başlangıcından itibaren 15 dakika geçtiği için randevunuz iptal edildi.';
                }
                return;
            }
        }

        // Kod geçerli! Randevuyu başlatıldı olarak mühürle ve erişim izni ver
        await set(ref(db, `operasyon/randevular/${foundKey}/baslatildi`), true);
        sessionStorage.setItem('bergama2050_authorized_code', enteredCode);

        if (codeEntryMsg) {
            codeEntryMsg.style.color = 'var(--neon-green)';
            codeEntryMsg.textContent = `✓ Kod doğrulandı: ${foundRes.okulAdi} (${foundRes.sinifSube}). Lütfen takımınızı seçin.`;
        }
    });
}

// 7. TAKIM SEÇİMİ VE GİRİŞ KONTROLÜ
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.team-btn');
    if (btn) {
        const teamName = btn.getAttribute('data-team');
        if (!teamName) return;

        // Saha meşgulse ve bu saat dilimi için yetkili kod girilmemişse girişi engelle
        const authorizedCode = sessionStorage.getItem('bergama2050_authorized_code');
        if (currentFieldIsBusy && !authorizedCode) {
            alert("DİKKAT: Saha şu an başka bir okul/sınıf tarafından kullanımda veya rezerve edilmiştir!\n\nEğer bu randevunun sahibi siz iseniz lütfen 'Randevu Kodu ile Giriş' alanına kodunuzu giriniz.\n\nAksi halde lütfen sahanın boşalmasını bekleyiniz veya takvimden yeni bir randevu alınız.");
            if (codeEntryBox) {
                codeEntryBox.style.display = 'block';
                inputAccessCode?.focus();
            }
            return;
        }

        console.log("Seçilen Tim:", teamName);
        const targetURL = `operasyon.html?team=${encodeURIComponent(teamName)}`;
        window.location.replace(targetURL);
    }
});