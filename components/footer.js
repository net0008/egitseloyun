document.addEventListener("DOMContentLoaded", function() {
    const footerHTML = `
        <footer class="cyber-footer">
            <div class="footer-content">
                <p>&copy; 2026 Bergama 2050 Operasyonu | Maarif Modeli Milli Teknoloji Projesi</p>
                <div class="footer-links">
                    <a href="kilavuz.html">SAHA KILAVUZU</a>
                    <a href="index.html">ANA TERMİNAL</a>
                </div>
            </div>
        </footer>
    `;
    const footerElement = document.getElementById('footer-placeholder');
    if (footerElement) footerElement.innerHTML = footerHTML;
});