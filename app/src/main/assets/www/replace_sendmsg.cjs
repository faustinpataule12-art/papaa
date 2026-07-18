const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const replacement = `
async function sendMessage(text, atts=[]){
  const inp=document.getElementById('comp-input');
  if(!text&&!atts.length)return;
  const tok=S.tok||S.oai||S.ant;
  const hasCustom=S.customModel&&S.customModel.key;
  if(!tok&&!hasCustom){toast('⚠️ Configure une clé API d\\'abord',true); showView('apikeys'); setTitle('API / GitHub'); return;}
  inp.value=''; inp.style.height='auto';
  S.attachments=[]; renderAttachRow();
  document.getElementById('send-btn').disabled=true;
  
  const uMsg={id:uid(),role:'user',text,attachments:atts,ts:new Date()};
  S.msgs.push(uMsg); appendMsgEl(uMsg);
  
  const first=S.msgs.length===1;
  let currentText = text;
  let currentAtts = atts;
  let loopCount = 0;
  
  // UI Bot Message
  const uiBMsg={id:uid(),role:'bot',thinking:true,text:'',ts:new Date(), accumulatedThink:''};
  appendMsgEl(uiBMsg);
  
  while(loopCount < 5) {
      loopCount++;
      const apiBMsg={id:uid(),role:'bot',thinking:true,text:'',ts:new Date(), hidden: true};
      S.msgs.push(apiBMsg);
      
      if(loopCount === 1 && IMG_RE.test(currentText)){
        const url=IMG_API+encodeURIComponent(currentText)+'?width=768&height=768&nologo=true&seed='+Date.now();
        uiBMsg.thinking=false; uiBMsg.image=url; uiBMsg.text='Voici ton image :';
        updateMsgEl(uiBMsg);
        apiBMsg.text='Voici ton image :';
        break;
      }
      try {
        const reply=await callAI(tok,currentText,currentAtts);
        const parsed=parseBlocks(reply);
        
        let rawThinkMatch = reply.match(/<think>([\\s\\S]*?)(<\\/think>|$)/i);
        let currentThink = rawThinkMatch ? rawThinkMatch[1].trim() : '';
        if (currentThink) uiBMsg.accumulatedThink += (uiBMsg.accumulatedThink ? '\\n' : '') + currentThink;
        
        const toolBlock = parsed.blocks.find(b => b.lang === 'json' && b.content.includes('"action"'));
        
        if (toolBlock && S.caps.code) {
           let toolData;
           try { toolData = JSON.parse(toolBlock.content); } catch(e){}
           
           if (toolData && toolData.action) {
               apiBMsg.text = reply;
               apiBMsg.codeBlocks = parsed.blocks;
               
               if (toolData.action === 'web_fetch') uiBMsg.accumulatedThink += \`\\n🧭 Navigation web en cours : \${toolData.params.url}\`;
               else if (toolData.action === 'run_code') uiBMsg.accumulatedThink += \`\\n💻 Exécution de code local\`;
               else uiBMsg.accumulatedThink += \`\\n🔧 Utilisation de l'outil \${toolData.action}\`;
               
               uiBMsg.text = \`<think>\\n\${uiBMsg.accumulatedThink}\\n</think>\`;
               updateMsgEl(uiBMsg);
               
               const resText = await executeTool(toolData);
               
               if (resText.includes('Erreur')) uiBMsg.accumulatedThink += \` ❌\`;
               else uiBMsg.accumulatedThink += \` ✓\`;
               
               uiBMsg.text = \`<think>\\n\${uiBMsg.accumulatedThink}\\n</think>\`;
               updateMsgEl(uiBMsg);
               
               S.msgs.push({
                   id: uid(), role: 'user', hidden: true,
                   text: \`Résultat de l'outil \${toolData.action}:\\n\`\`\`\\n\${resText}\\n\`\`\`\`,
                   ts: new Date()
               });
               
               currentText = "Voici le résultat de ton action. Continue ton raisonnement, utilise un autre outil si nécessaire, ou donne ta réponse finale en fonction de ce résultat :\\n" + resText;
               currentAtts = [];
               continue;
           }
        }
        
        apiBMsg.text = reply;
        apiBMsg.codeBlocks = parsed.blocks;
        
        uiBMsg.thinking = false;
        uiBMsg.codeBlocks = parsed.blocks;
        let finalText = parsed.text.replace(/<think>[\\s\\S]*?(<\\/think>|$)/gi, '').trim();
        
        await typeOut(uiBMsg, finalText);
        break;
       } catch(e){
        const isNetwork = e instanceof TypeError || /fetch|network|failed to fetch/i.test(e.message||'');
        if(isNetwork && loopCount === 1){
          S.msgs=S.msgs.filter(m=>m.id!==uMsg.id&&m.id!==apiBMsg.id);
          document.getElementById('msg-'+uMsg.id)?.remove();
          document.getElementById('msg-'+uiBMsg.id)?.remove();
          inp.value=text; growTA(inp); S.attachments=atts; renderAttachRow();
          toast('⚠️ Vérifiez votre connexion et réessayez',true);
          document.getElementById('send-btn').disabled=false;
          return;
        }
        uiBMsg.thinking=false; uiBMsg.text='❌ '+e.message;
        updateMsgEl(uiBMsg);
        break;
      }
  }
  
  // We don't push uiBMsg to S.msgs because it's purely for the UI and the API has the hidden messages
  // Wait, if it's not in S.msgs, it won't be saved to localStorage!
  // Oh! When saving to localStorage, it saves S.msgs, but clears them anyway!
  // But wait, if they switch tabs and come back, it re-renders from S.msgs!
  // If uiBMsg is NOT in S.msgs, it will DISAPPEAR when they switch tabs!
  
  // To fix this, after the loop finishes, we can push the uiBMsg and remove the intermediate apiBMsgs?
  // No, the API needs the intermediate tool results!
  // We can just add uiBMsg to S.msgs, and mark it with apiHidden: true?
  // And the apiBMsgs are marked hidden: true (for UI).
  // Yes! S.msgs will contain both!
  uiBMsg.apiHidden = true;
  S.msgs.push(uiBMsg);
  
  document.getElementById('send-btn').disabled=false;
  saveConv(first?text:'');
}
`;

content = content.replace(/async function sendMessage[\s\S]*?async function typeOut/g, replacement + '\nasync function typeOut');
fs.writeFileSync('index.html', content);
