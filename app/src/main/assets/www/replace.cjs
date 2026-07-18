const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
const replacement = fs.readFileSync('replace_msg.js', 'utf8');
content = content.replace(/function buildMsgHTML\(m\)\{[\s\S]*?\n\}\n/g, replacement + '\n');
fs.writeFileSync('index.html', content);
