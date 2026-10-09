const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

const headAndNav = lines.slice(0, 583).join('\n');
console.log('Head, Mobile/Desktop Header & Nav: ' + (Buffer.byteLength(headAndNav, 'utf8') / 1024).toFixed(1) + ' KB (' + lines.slice(0, 583).length + ' lines)');
