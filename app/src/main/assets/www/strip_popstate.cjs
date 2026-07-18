const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const regex = /\/\/ Pop state :[\s\S]*?\}\);/g;
content = content.replace(regex, '');

fs.writeFileSync('index.html', content);
