const http = require('http');

http.get('http://localhost:3000/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('HTML Length:', data.length);
    console.log('Contains css/styles.min.css:', data.includes('css/styles.min.css'));
    console.log('Contains beranda-mobile-app (Gambar 3):', data.includes('id="beranda-mobile-app"'));
    console.log('Contains beranda-portal-content (Gambar 1 & 2):', data.includes('id="beranda-portal-content"'));
    console.log('Contains pwa-smart-install-banner:', data.includes('id="pwa-smart-install-banner"'));
    console.log('Contains Pasang Aplikasi Mubarokah:', data.includes('Pasang Aplikasi Mubarokah'));
    console.log('Contains Untuk Akses Santri & Wali:', data.includes('Untuk Akses Santri & Wali'));
    console.log('Contains standalone CSS rules:', data.includes('display-mode: standalone'));
  });
}).on('error', err => {
  console.error('Error connecting to dev server:', err.message);
});
