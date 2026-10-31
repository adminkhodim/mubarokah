const fs = require('fs');
const files = [
  'legacy/Setup.gs',
  'legacy/00_Config_Security.gs',
  'legacy/01_Router.gs',
  'legacy/02_Auth_RBAC.gs',
  'legacy/03_PPDB.gs',
  'legacy/04_Tahfidz.gs',
  'legacy/05_CMS.gs',
  'legacy/06_MasterData.gs',
  'legacy/07_Keuangan.gs'
];

const sheetSet = new Set();

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, 'utf8');

  const constMatches = content.matchAll(/const\s+(SHEET_[A-Z0-9_]+)\s*=\s*['"]([^'"]+)['"]/g);
  for (const m of constMatches) {
    sheetSet.add(m[2]);
  }

  const getSheetMatches = content.matchAll(/getSheetByName\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of getSheetMatches) {
    sheetSet.add(m[1]);
  }

  const insertSheetMatches = content.matchAll(/insertSheet\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of insertSheetMatches) {
    sheetSet.add(m[1]);
  }
});

const list = Array.from(sheetSet).sort();
console.log('Total unique sheets detected:', list.length);
console.log(JSON.stringify(list, null, 2));

