const fs = require('fs');
const path = require('path');

function searchInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('function switchTab') || line.includes('switchTab =') || line.includes('window.switchTab')) {
            console.log(`${filePath}:${idx + 1}: ${line.trim().substring(0, 80)}`);
        }
    });
}

['index.html', 'app.html'].forEach(searchInFile);
fs.readdirSync('js').forEach(f => searchInFile(path.join('js', f)));
