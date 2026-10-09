const fs = require('fs');

function makePathsUniversal(filename) {
  let content = fs.readFileSync(filename, 'utf8');

  // 1. Remove rigid <base href="/">
  content = content.replace(/\s*<base href="\/">\r?\n?/g, '\n');

  // 2. Convert root-relative asset URLs to relative paths
  content = content.replace(/href="\/css\//g, 'href="css/');
  content = content.replace(/src="\/js\//g, 'src="js/');
  content = content.replace(/src="\/assets\//g, 'src="assets/');
  content = content.replace(/href="\/assets\//g, 'href="assets/');
  content = content.replace(/src="\/data-/g, 'src="data-');
  content = content.replace(/href="\/manifest\.json"/g, 'href="manifest.json"');

  fs.writeFileSync(filename, content, 'utf8');
  console.log('Updated ' + filename + ' to universal relative asset paths.');
}

makePathsUniversal('index.html');
makePathsUniversal('app.html');
