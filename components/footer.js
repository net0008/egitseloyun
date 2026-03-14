/* *****************************************************************************
 * footer.js - Sürüm: v1.3.0                                                   *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Operasyonel Alt Bilgi (Footer) Protokolü                                   *
 * *************************************************************************** */
function loadFooter() {
    const placeholder = document.getElementById('footer-placeholder');

    const footerHTML = `
        <footer class="cyber-footer">
            <div class="cyber-footer-content">
                <p>© 2026 Bergama 2050 Operasyonu | <a href="#" class="teacher-guide-link" style="color: inherit; text-decoration: none; margin: 0 10px; cursor: pointer;">Öğretmen Rehberi</a> | <a href="https://hasbierdogmus.com.tr/" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">Hasbi ERDOĞMUŞ</a></p>
            </div>
        </footer>
    `;

    const modalHTML = `
        <div id="teacher-guide-modal" class="modal">
            <div class="modal-content">
                <span class="close-btn" id="btn-close-teacher-guide">X</span>
                <iframe src="assets/pdf/cografi_becerilerin_dijital_donusumu.pdf" width="100%" height="95%" frameborder="0" style="margin-top: 25px;"></iframe>
            </div>
        </div>
    `;

    if (placeholder) {
        placeholder.innerHTML = footerHTML;
    } else {
        const legacyFooter = document.querySelector('footer');
        if (!legacyFooter) return;
        legacyFooter.classList.add('cyber-footer');
        legacyFooter.innerHTML = `
            <div class="cyber-footer-content">
                <p>© 2026 Bergama 2050 Operasyonu | <a href="#" class="teacher-guide-link" style="color: inherit; text-decoration: none; margin: 0 10px; cursor: pointer;">Öğretmen Rehberi</a> | <a href="https://hasbierdogmus.com.tr/" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">Hasbi ERDOĞMUŞ</a></p>
            </div>
        `;
    }
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Sayfa yüklendiğinde otomatik başlat
document.addEventListener('DOMContentLoaded', () => {
    loadFooter();

    // Modal'ı kontrol edecek script
    const modal = document.getElementById("teacher-guide-modal");
    const closeBtn = document.getElementById("btn-close-teacher-guide");

    // Açma (Event Delegation)
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.teacher-guide-link')) {
            e.preventDefault();
            if (modal) modal.style.display = "block";
        }
    });

    // Kapatma
    if (modal && closeBtn) {
        const closeModal = () => modal.style.display = "none";
        closeBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => {
            if (event.target == modal) closeModal();
        });
    }
});