const fs = require('fs');

function inspectPaths(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const css = (content.match(/href="\/css\//g) || []).length;
  const js = (content.match(/src="\/js\//g) || []).length;
  const assets = (content.match(/src="\/assets\//g) || []).length;
  const base = (content.match(/<base href="\/"/g) || []).length;
  console.log(filename + ':');
  console.log('  base href="/":', base);
  console.log('  href="/css/":', css);
  console.log('  src="/js/":', js);
  console.log('  src="/assets/":', assets);
}

inspectPaths('index.html');
inspectPaths('app.html');
