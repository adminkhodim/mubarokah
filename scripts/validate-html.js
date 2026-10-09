const fs = require('fs');

function checkHtml(file) {
  const content = fs.readFileSync(file, 'utf8');
  console.log('--- Checking ' + file + ' ---');
  console.log('Size: ' + (fs.statSync(file).size / 1024).toFixed(2) + ' KB');
  console.log('Has html, head, body, closing tags: ' + 
    (content.includes('<html') && content.includes('<head') && content.includes('<body') && content.includes('</html>')));
  console.log('Has main tag open and close: ' + (content.includes('<main') && content.includes('</main>')));
  console.log('Includes lazy loader: ' + content.includes('lazy-loader.js'));
  console.log('Has SIMTren / Portal links: ' + (content.includes('/app') || content.includes('/')));
  console.log('Has page-admin: ' + content.includes('id="page-admin"'));
  console.log('Has page-beranda: ' + content.includes('id="page-beranda"'));
}

checkHtml('index.html');
checkHtml('app.html');
