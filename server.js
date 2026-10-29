const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);

  // Routing rules matching vercel.json
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (
    reqPath === '/app' ||
    reqPath.startsWith('/app/') ||
    reqPath === '/admin' ||
    reqPath.startsWith('/admin/') ||
    reqPath === '/administrator' ||
    reqPath.startsWith('/administrator/')
  ) {
    reqPath = '/app.html';
  }

  let filePath = path.join(ROOT, reqPath);

  // If path doesn't have extension and file doesn't exist, try index.html for SPA fallback
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, 'index.html');
  } else if (fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n====================================================`);
  console.log(`🚀 Mubarokah App Dev Server berjalan di:`);
  console.log(`   - Portal Publik: http://localhost:${PORT}/`);
  console.log(`   - SIMTren App:   http://localhost:${PORT}/app`);
  console.log(`   - Portal Admin:  http://localhost:${PORT}/admin`);
  console.log(`====================================================\n`);
});
