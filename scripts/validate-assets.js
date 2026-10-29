const fs = require('fs');

function validateFileAssets(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  console.log('=== Checking assets in ' + filename + ' ===');
  
  const regex = /(?:href|src)=["']([^"']+)["']/g;
  let match;
  const localAssets = [];

  const knownRoutes = ['/', '/app', '/admin', '/administrator', '/berita', '/tentang-kami'];

  while ((match = regex.exec(content)) !== null) {
    const url = match[1];
    if (
      !url.startsWith('http') &&
      !url.startsWith('data:') &&
      !url.startsWith('#') &&
      !url.startsWith('blob:') &&
      !url.startsWith('javascript:') &&
      !url.startsWith('tel:') &&
      !url.startsWith('mailto:') &&
      !knownRoutes.includes(url) &&
      !url.startsWith('/app/') &&
      !url.startsWith('/admin/')
    ) {
      localAssets.push(url);
    }
  }

  let missing = 0;
  localAssets.forEach(asset => {
    const cleanPath = asset.split('?')[0];
    if (!fs.existsSync(cleanPath)) {
      console.log('  [MISSING]:', cleanPath);
      missing++;
    }
  });

  if (missing === 0) {
    console.log('  [OK] Semua ' + localAssets.length + ' aset lokal berhasil ditemukan dan berstatus valid!');
  } else {
    console.log('  [WARN] Total ' + missing + ' file hilang.');
  }
}

validateFileAssets('index.html');
validateFileAssets('app.html');
