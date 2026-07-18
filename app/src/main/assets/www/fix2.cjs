const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const re = /function confirmExit\(\)\{state :[\s\S]*?function confirmExit\(\)\{/m;
content = content.replace(re, `function confirmExit(){`);

fs.writeFileSync('index.html', content);
