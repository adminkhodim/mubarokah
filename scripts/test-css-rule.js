const http = require('http');

http.get('http://localhost:3000/css/styles.min.css', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('CSS HTTP Status:', res.statusCode);
    console.log('CSS Length:', data.length, 'bytes');
    console.log('Has .hidden rule:', data.includes('.hidden{display:none}') || data.includes('.hidden { display: none') || data.includes('display:none'));
    console.log('Sample snippet:', data.substring(0, 150));
  });
}).on('error', err => {
  console.error('Error fetching CSS:', err.message);
});
