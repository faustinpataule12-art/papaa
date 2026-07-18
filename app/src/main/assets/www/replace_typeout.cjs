const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const replacement = `
async function typeOut(bMsg,fullText){
  bMsg.thinking=false;
  const step=Math.max(1,Math.round(fullText.length/60));
  for(let i=0;i<=fullText.length;i+=step){
    bMsg.text = (bMsg.accumulatedThink ? \`<think>\\n\${bMsg.accumulatedThink}\\n</think>\\n\\n\` : '') + fullText.slice(0,i);
    bMsg.typing=true;
    updateMsgEl(bMsg);
    await sleep(12);
  }
  bMsg.text = (bMsg.accumulatedThink ? \`<think>\\n\${bMsg.accumulatedThink}\\n</think>\\n\\n\` : '') + fullText;
  bMsg.typing=false;
  updateMsgEl(bMsg);
}
`;

content = content.replace(/async function typeOut[\s\S]*?updateMsgEl\(bMsg\);\n\}/g, replacement + '\n');
fs.writeFileSync('index.html', content);
