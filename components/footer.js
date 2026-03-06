/* *****************************************************************************
 * footer.js - Sürüm: v1.3.0                                                   *
 * Hasbi Erdoğmuş | 17 Yıllık Tecrübe - Hibrit Eğitim Mimarı Sürümü           *
 * Operasyonel Alt Bilgi (Footer) Protokolü                                   *
 * *************************************************************************** */
function loadFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    const legacyFooter = document.querySelector('footer');

    const footerHTML = `
        <footer class="cyber-footer">
            <div class="cyber-footer-content">
                <p>© 2026 Bergama 2050 Operasyonu | Hasbi ERDOĞMUŞ</p>
            </div>
        </footer>
    `;

    if (placeholder) {
        placeholder.innerHTML = footerHTML;
        return;
    }

    if (legacyFooter) {
        legacyFooter.classList.add('cyber-footer');
        legacyFooter.innerHTML = `
            <div class="cyber-footer-content">
                <p>© 2026 Bergama 2050 Operasyonu | Hasbi ERDOĞMUŞ</p>
            </div>
        `;
    }
}
// Sayfa yüklendiğinde otomatik başlat
document.addEventListener('DOMContentLoaded', loadFooter);