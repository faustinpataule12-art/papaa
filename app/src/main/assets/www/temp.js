// ═══════ STATE ═══════
const S = {
  tok: localStorage.getItem('nps_gh_tok')||'',
  oai: localStorage.getItem('nps_oai_tok')||'',
  ant: localStorage.getItem('nps_ant_tok')||'',
  model: localStorage.getItem('nps_model')||'gpt-4o',
  caps: JSON.parse(localStorage.getItem('nps_caps')||'{"web":true,"art":true,"code":true,"switch":true,"mem":true}'),
  prefs: localStorage.getItem('nps_prefs')||'',
  msgs: [],
  convs: JSON.parse(localStorage.getItem('nps_convs')||'[]'),
  attachments: [],
  customModel: JSON.parse(localStorage.getItem('nps_custom_model')||'null'),
  wsName: localStorage.getItem('nps_ws_name')||'ESPACE NPS',
  globalHeaders: JSON.parse(localStorage.getItem('nps_global_headers')||'{}'),
};
const GM = 'https://models.inference.ai.azure.com/chat/completions';
const GHA = 'https://api.github.com';
const IMG_API = 'https://image.pollinations.ai/prompt/';

// ═══════ DÉTECTION AUTOMATIQUE DU FOURNISSEUR À PARTIR DE LA CLÉ ═══════
// L'utilisateur colle SEULEMENT sa clé API, peu importe où il l'a trouvée
// (Pollinations, Groq, OpenRouter, un serveur perso sur Replit, etc.).
// NPS ne "choisit" rien : il teste automatiquement la clé sur les
// fournisseurs connus et garde celui qui répond. Deux formats de clé
// ont un format d'appel différent (Anthropic, Gemini) et sont reconnus
// instantanément par leur préfixe ; tous les autres sont testés en direct.
const KNOWN_FORMATS=[
  {test:/^sk-ant-/, provider:'anthropic', endpoint:'https://api.anthropic.com/v1/messages', model:'claude-sonnet-4-6', name:'Anthropic — Claude'},
  {test:/^AIza/, provider:'gemini', endpoint:'https://generativelanguage.googleapis.com/v1beta/models/', model:'gemini-2.0-flash', name:'Google — Gemini'},
];
const PROBE_CANDIDATES=[
  {name:'Pollinations', endpoint:'https://text.pollinations.ai/openai', model:'openai-large'},
  {name:'Groq', endpoint:'https://api.groq.com/openai/v1/chat/completions', model:'llama-3.3-70b-versatile'},
  {name:'OpenRouter', endpoint:'https://openrouter.ai/api/v1/chat/completions', model:'openai/gpt-4o-mini'},
  {name:'GitHub Models', endpoint:'https://models.inference.ai.azure.com/chat/completions', model:'gpt-4o'},
  {name:'Together AI', endpoint:'https://api.together.xyz/v1/chat/completions', model:'meta-llama/Llama-3.3-70B-Instruct-Turbo'},
  {name:'DeepSeek', endpoint:'https://api.deepseek.com/chat/completions', model:'deepseek-chat'},
  {name:'Mistral', endpoint:'https://api.mistral.ai/v1/chat/completions', model:'mistral-small-latest'},
  {name:'Fireworks AI', endpoint:'https://api.fireworks.ai/inference/v1/chat/completions', model:'accounts/fireworks/models/llama-v3p3-70b-instruct'},
  {name:'Perplexity', endpoint:'https://api.perplexity.ai/chat/completions', model:'llama-3.1-sonar-small-128k-online'},
  {name:'OpenAI', endpoint:'https://api.openai.com/v1/chat/completions', model:'gpt-4o-mini'},
];
function toggleManualUrl(){
  const w=document.getElementById('cm-manual-wrap');
  w.style.display=w.style.display==='none'?'block':'none';
}
function onCmKeyInput(){
  const key=document.getElementById('cm-key').value.trim();
  const label=document.getElementById('cm-provider-label');
  if(!key){label.textContent='Colle une clé, puis appuie sur Enregistrer';label.style.color='var(--text3)';return;}
  const known=KNOWN_FORMATS.find(f=>f.test.test(key));
  label.textContent=known?('Format reconnu : '+known.name+' — appuie sur Enregistrer'):'Appuie sur "Enregistrer et connecter" pour la tester';
  label.style.color='var(--text3)';
}
async function detectAndSaveCustomModel(){
  const key=document.getElementById('cm-key').value.trim();
  const manualUrl=document.getElementById('cm-manual-url')?.value.trim();
  const label=document.getElementById('cm-provider-label');
  if(!key){toast('⚠️ Colle d\'abord ta clé API',true);return;}

  // Adresse fournie manuellement (serveur perso, ex. Replit) : pas de test, on l'utilise directement
  if(manualUrl){
    S.customModel={key,provider:'openai-compat',endpoint:manualUrl,model:document.getElementById('cm-name').value.trim()||'default',name:'Serveur personnalisé'};
    finishCustomModelSave('Serveur personnalisé');
    return;
  }

  // Format spécial reconnu instantanément (Anthropic / Gemini)
  const known=KNOWN_FORMATS.find(f=>f.test.test(key));
  if(known){
    S.customModel={key,provider:known.provider,endpoint:known.endpoint,model:known.model,name:known.name};
    finishCustomModelSave(known.name);
    return;
  }

  // Sinon : on teste la clé automatiquement sur les fournisseurs connus
  const btn=document.getElementById('cm-save-btn');
  btn.disabled=true; btn.textContent='Détection en cours…';
  label.textContent='🔎 Test de la clé sur les fournisseurs connus…';
  label.style.color='var(--text2)';
  for(const c of PROBE_CANDIDATES){
    try{
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),7000);
      const r=await fetch(c.endpoint,{
        method:'POST', signal:ctrl.signal,
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body:JSON.stringify({model:c.model,max_tokens:5,messages:[{role:'user',content:'ping'}]})
      });
      clearTimeout(timer);
      if(r.ok){
        S.customModel={key,provider:'openai-compat',endpoint:c.endpoint,model:c.model,name:c.name};
        btn.disabled=false; btn.textContent='Enregistrer et connecter';
        finishCustomModelSave(c.name);
        return;
      }
    }catch(e){ /* on passe au suivant */ }
  }
  btn.disabled=false; btn.textContent='Enregistrer et connecter';
  label.textContent='⚠️ Clé non reconnue par les fournisseurs connus. Si c\'est un serveur perso (ex. Replit), ajoute son adresse ci-dessous.';
  label.style.color='#e05555';
  document.getElementById('cm-manual-wrap').style.display='block';
}
function finishCustomModelSave(name){
  localStorage.setItem('nps_custom_model',JSON.stringify(S.customModel));
  document.getElementById('cm-sub-label').textContent=name;
  document.getElementById('cm-provider-label').textContent='✓ '+name+' détecté et connecté';
  document.getElementById('cm-provider-label').style.color='var(--green)';
  selectModel('custom',name);
  toast('Modèle connecté ✓ '+name);
}

// ═══════ UTILS ═══════
const esc = s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const uid = ()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const sleep = ms=>new Promise(r=>setTimeout(r,ms));

// ═══════ TOAST ═══════
let _tt;
function toast(msg,info=false){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='show'+(info?' info':'');
  clearTimeout(_tt); _tt=setTimeout(()=>t.className='',3000);
}

// ═══════ LIENS & PARTAGE ═══════
// Les liens s'ouvrent DANS l'application (iframe plein écran) au lieu du
// navigateur externe : l'URL réelle n'est jamais visible à l'utilisateur.
// Exception : les liens WhatsApp sont transmis directement à l'app WhatsApp
// (deep link), sans passer par un navigateur non plus.
function openLink(url,title){
  if(/whatsapp\.com|wa\.me/.test(url)){
    window.location.href=url;
    return;
  }
  openInApp(url,title);
}
function openInApp(url,title){
  document.getElementById('inapp-title').textContent=title||'NPS';
  document.getElementById('inapp-frame').src=url;
  document.getElementById('inapp-view').classList.add('show');

}
function closeInApp(){
  document.getElementById('inapp-view').classList.remove('show');
  document.getElementById('inapp-frame').src='about:blank';
}
function shareApp(){
  const shareData={
    title:'NPS — Assistant IA',
    text:'Découvre NPS, mon assistant IA 🚀',
    url:'https://nps-nelson-hub.gamer.free/'
  };
  if(navigator.share){
    navigator.share(shareData).catch(()=>{});
  } else {
    navigator.clipboard?.writeText(shareData.url).then(()=>toast('Lien copié — colle-le dans WhatsApp ✓')).catch(()=>toast('Partage non supporté sur ce navigateur',true));
  }
}

// ═══════ THÈME & POLICE ═══════
function toggleTheme(){
  const light=document.body.classList.toggle('light');
  localStorage.setItem('nps_theme',light?'light':'dark');
  document.getElementById('theme-icon').textContent=light?'☀️':'🌙';
  document.getElementById('theme-sub-label').textContent=light?'Clair':'Sombre';
}
const FONTS=[
  {cls:'',label:'Par défaut'},
  {cls:'font-round',label:'Arrondie'},
  {cls:'font-serif',label:'Serif'},
  {cls:'font-mono',label:'Monospace'},
];
function cycleFont(){
  let idx=FONTS.findIndex(f=>f.cls&&document.body.classList.contains(f.cls));
  if(idx===-1)idx=0;
  FONTS.forEach(f=>f.cls&&document.body.classList.remove(f.cls));
  const next=FONTS[(idx+1)%FONTS.length];
  if(next.cls)document.body.classList.add(next.cls);
  document.getElementById('font-sub-label').textContent=next.label;
  localStorage.setItem('nps_font',next.cls);
}

// ═══════ SIDEBAR ═══════
let sbOpen=false;
function toggleSidebar(){sbOpen?closeSidebar():openSidebar()}
function openSidebar(){
  sbOpen=true;
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sb-overlay').classList.add('show');
  renderRecents();
}
function closeSidebar(){
  sbOpen=false;
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('show');
}

function renderRecents(){
  const c=S.convs.slice(0,6);
  document.getElementById('recent-list').innerHTML = c.length
    ? c.map(v=>`<div class="sb-recent" onclick="loadConv('${v.id}');closeSidebar()">${esc(v.title)}</div>`).join('')
    : '<div style="font-size:12px;color:var(--text3);padding:4px 12px">Aucune conversation</div>';
}

// ═══════ VIEWS ═══════
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el=document.getElementById('view-'+id);
  if(el) el.classList.add('active');
  // sync header buttons
  const isChat=id==='chat';
  document.getElementById('new-chat-btn').style.display=isChat?'flex':'none';
  document.getElementById('more-btn').style.display=isChat?'flex':'none';
  if(!isChat&&id!=='settings') document.getElementById('more-btn').style.display='none';
}
function setTitle(t){document.getElementById('page-title').textContent=t}
function currentViewId(){
  const el=document.querySelector('.view.active');
  return el?el.id.replace('view-',''):'chat';
}


function openExitModal(){document.getElementById('exit-modal').classList.add('show')}
function closeExitModal(){document.getElementById('exit-modal').classList.remove('show')}
function confirmExit(){
  closeExitModal();
  // Pont natif Android si l'app est compilée en WebView (à connecter côté Android : window.Android.exitApp())
  if(window.Android&&window.Android.exitApp){window.Android.exitApp();return;}
  if(window.navigator.app&&window.navigator.app.exitApp){window.navigator.app.exitApp();return;}
  window.close();
}

// ═══════ CHAT ═══════
function newConv(){
  S.msgs=[];
  document.getElementById('feed').innerHTML='';
  document.getElementById('feed').appendChild(buildEmptyState());
  showView('chat'); setTitle('NPS');
  document.getElementById('comp-input').focus();
}

function buildEmptyState(){
  const el=document.getElementById('empty-state');
  return el||document.createElement('div');
}

function loadConv(id){
  const c=S.convs.find(x=>x.id===id);
  if(!c)return;
  S.msgs=[...c.msgs];
  const feed=document.getElementById('feed');
  feed.innerHTML='';
  S.msgs.forEach(m=>appendMsgEl(m));
  feed.scrollTop=feed.scrollHeight;
  showView('chat'); setTitle(c.title);
}

function appendMsgEl(m){
  if (m.hidden) return;
  const feed=document.getElementById('feed');
  const empty=document.getElementById('empty-state');
  if(empty) empty.style.display='none';
  const el=document.createElement('div');
  el.className='msg-group'; el.id='msg-'+m.id;
  el.innerHTML=buildMsgHTML(m);
  feed.appendChild(el);
  feed.scrollTop=feed.scrollHeight;
}

function updateMsgEl(m){
  const el=document.getElementById('msg-'+m.id);
  if(el) el.innerHTML=buildMsgHTML(m);
  document.getElementById('feed').scrollTop=99999;
}

function buildMsgHTML(m){
  const time=m.ts.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  if(m.role==='user'){
    const attHtml=m.attachments?.length?m.attachments.map(a=>a.dataUrl?`<img class="msg-img" src="${a.dataUrl}"/>`:`<div style="font-size:11px;opacity:.8;margin-top:4px">📎 ${esc(a.name)}</div>`).join(''):'';
    return `<div class="msg-row user">
      <div class="msg-av user">${esc((S.wsName||'EN').slice(0,2).toUpperCase())}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-end;">
        <div class="msg-bubble">${fmtText(m.text)}${attHtml}</div>
        <div class="msg-time" style="margin-right:4px;">${time}</div>
      </div>
    </div>`;
  }
  
  let rawText = m.text || '';
  let thinkContent = m.accumulatedThink || '';
  let isThinkClosed = true;
  
  if (!m.accumulatedThink) {
      rawText = rawText.replace(/<think>([\s\S]*?)(<\/think>|$)/gi, function(match, p1, p2) {
        thinkContent += p1 + '\n';
        if (!p2) isThinkClosed = false;
        return '';
      });
  } else {
      rawText = rawText.replace(/<think>([\s\S]*?)(<\/think>|$)/gi, '');
      isThinkClosed = !m.thinking;
  }

  const cursor=m.typing?'<span class="typing-cursor"></span>':'';
  const imgHtml=m.image?`<img class="msg-img" src="${m.image}" onerror="this.outerHTML='⚠️ Image indisponible, réessaie.'"/>`:'';
  
  let thinkHtml = '';
  if (thinkContent.trim() || m.thinking) {
     const steps = Math.max(1, thinkContent.split('\n').filter(l=>l.trim().length>0).length);
     const title = isThinkClosed ? `Processus de réflexion — ${steps} étapes ✓` : "Processus de réflexion en cours...";
     const statusClass = isThinkClosed ? "done" : "loading";
     const statusContent = isThinkClosed ? `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>` : '';
     
     thinkHtml = `
     <details class="nps-step" style="width:100%; margin-bottom: 8px; border:none; background:transparent; border-bottom: 1px solid var(--border); border-radius: 0; padding-bottom: 4px;" ${isThinkClosed ? '' : 'open'}>
       <summary class="nps-step-header" style="background:transparent; padding: 4px 0; border: none; font-size: 13px; color: var(--text2);">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:6px"><polyline points="9 18 15 12 9 6"></polyline></svg>
         <span class="nps-step-title">${title}</span>
         <div class="nps-step-status ${statusClass}" style="margin-left:auto">${statusContent}</div>
       </summary>
       <div class="nps-step-content" style="padding: 8px 0 12px 20px; border-left: 2px solid var(--border); margin-left: 6px; font-size: 13px; color: var(--text2);">
         ${renderThinkLines(thinkContent)}
       </div>
     </details>`;
  }

  const finalResponseText = rawText.trim();
  let finalBubbleHtml = '';
  if (finalResponseText || cursor || imgHtml) {
    finalBubbleHtml = `<div class="msg-content-final" style="width:100%; color:var(--text); line-height:1.6;">${fmtText(finalResponseText)}${cursor}${imgHtml}</div>`;
  }

  return `<div class="msg-row bot">
    <div class="msg-av bot">${logoMiniSVG()}</div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;width:100%;">
      ${thinkHtml}
      ${finalBubbleHtml}
      ${m.codeBlocks?.length ? m.codeBlocks.map((b,i)=>buildCode(b,m.id,i)).join('') : ''}
      <div class="msg-time">NPS · ${time}</div>
    </div>
  </div>`;
}


function buildCode(b,mid,i){
  const id='code-'+mid+'-'+i;
  if(b.lang === 'json' && b.content.includes('"action"')){
    let actionName = "Inconnu";
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    try { 
      const parsed = JSON.parse(b.content);
      actionName = parsed.action; 
      if (actionName === 'web_fetch') svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`;
      else if (actionName === 'run_code') svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`;
      else if (actionName === 'api_call') svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path><path d="M12 12V8"></path></svg>`;
    } catch(e){}
    
    return `<details class="nps-step">
      <summary class="nps-step-header">
        ${svg}
        <span class="nps-step-title">Action : ${actionName}</span>
        <div class="nps-step-status done"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </summary>
      <div id="${id}" class="nps-step-content">${esc(b.content)}</div>
    </details>`;
  }
  return `<div style="margin-top:8px;border-radius:10px;background:#020305;border:1px solid var(--border);overflow:hidden">
    <div style="padding:5px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--bg3)">
      <span style="font-size:9px;color:var(--text3);text-transform:uppercase;font-weight:700">${esc(b.lang||'code')}</span>
      <button onclick="copyCode('${id}')" style="background:none;border:none;color:var(--text2);font-size:10px;cursor:pointer">📋 Copier</button>
    </div>
    <div id="${id}" style="padding:10px;font-family:monospace;font-size:10px;color:#a8b3cf;overflow-x:auto;white-space:pre;line-height:1.6;max-height:200px;overflow-y:auto">${esc(b.content)}</div>
  </div>`;
}

function logoMiniSVG(){
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:26px;height:26px">
    <circle cx="100" cy="100" r="58" style="stroke:#E87A5D;fill:none;stroke-width:5;stroke-dasharray:8 12"/>
    <circle cx="100" cy="100" r="46" style="fill:#1a1b20"/>
    <text x="100" y="103" style="font-family:sans-serif;font-size:38px;font-weight:900;fill:#E87A5D;text-anchor:middle;dominant-baseline:central">N</text>
  </svg>`;
}

function renderThinkLines(content) {
  if (!content) return '';
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  return lines.map(line => {
     let icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 16 16 12 12 8"></polyline><line x1="8" y1="12" x2="16" y2="12"></line></svg>`; // default
     const lower = line.toLowerCase();
     if (lower.includes('analys')) icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
     else if (lower.includes('corrig') || lower.includes('modifi') || lower.includes('édit') || lower.includes('réécri')) icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
     else if (lower.includes('réessay') || lower.includes('tentativ')) icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`;
     else if (lower.includes('fichier') || lower.includes('li') || lower.includes('code') || lower.includes('génér')) icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
     else if (lower.includes('explor') || lower.includes('navigu') || lower.includes('lien') || lower.includes('web') || lower.includes('recherch')) icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
     else if (lower.includes('configur') || lower.includes('outil') || lower.includes('param')) icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
     else if (lower.includes('réuss') || lower.includes('succès') || lower.includes('termin')) icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
     else if (lower.includes('échou') || lower.includes('erreur') || lower.includes('fail')) icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

     return `<div class="nps-think-line">
       <div class="nps-think-line-icon">${icon}</div>
       <div class="nps-think-line-text">${esc(line)}</div>
       <div class="nps-think-line-status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
     </div>`;
  }).join('');
}

function fmtText(txt){
  if(!txt)return'';
  
  // Escape html tags first
  let safeTxt = esc(txt);

  return safeTxt
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`([^`\n]+)`/g,'<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-size:11px;font-family:monospace">$1</code>')
    .replace(/\n/g,'<br>');
}

function copyCode(id){
  const el=document.getElementById(id);
  if(!el)return;
  navigator.clipboard.writeText(el.textContent).then(()=>toast('Copié ✓')).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=el.textContent; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); toast('Copié ✓');
  });
}

function sendQuick(txt){
  document.getElementById('comp-input').value=txt;
  sendMsg();
}

const IMG_RE=/(g[ée]n[èe]re|cr[ée]e|dessine|fabrique)\s+(une|des|l')?\s*(image|icone|icône|illustration|logo|photo)/i;

async function executeTool(toolData) {
  if (toolData.action === 'api_call') {
    try {
      const headers = { ...S.globalHeaders, ...(toolData.params.headers || {}) };
      const res = await fetch(toolData.params.url, {
        method: toolData.params.method || 'GET',
        headers: headers,
        body: toolData.params.body ? (typeof toolData.params.body === 'string' ? toolData.params.body : JSON.stringify(toolData.params.body)) : undefined
      });
      let text = await res.text();
      if (text.length > 5000) text = text.slice(0, 5000) + '... (tronqué pour le contexte)';
      return `Status: ${res.status}\n\n${text}`;
    } catch (e) {
      return "Erreur d'exécution: " + e.message;
    }
  }
  if (toolData.action === 'web_fetch') {
    try {
      const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(toolData.params.url);
      const res = await fetch(proxyUrl);
      const data = await res.json();
      if (!data.contents) throw new Error("Aucun contenu retourné");
      const doc = new DOMParser().parseFromString(data.contents, 'text/html');
      // Extraire le texte de manière basique
      let text = doc.body.innerText.replace(/\s+/g, ' ').trim();
      if (text.length > 5000) text = text.slice(0, 5000) + '... (tronqué)';
      return `Contenu extrait de ${toolData.params.url} :\n\n${text}`;
    } catch (e) {
      return "Erreur d'accès au site: " + e.message;
    }
  }
  if (toolData.action === 'run_code') {
    try {
      const result = new Function(toolData.params.code)();
      return "Résultat de l'exécution JS :\n" + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
    } catch(e) {
      return "Erreur d'exécution JS :\n" + e.message;
    }
  }
  return "Action inconnue ou bloquée.";
}

async function sendMsg(){
  const inp=document.getElementById('comp-input');
  const text=inp.value.trim();
  const atts=[...S.attachments];
  if(!text&&!atts.length)return;

  const tok=S.tok||S.oai||S.ant;
  const hasCustom=S.customModel&&S.customModel.key;
  if(!tok&&!hasCustom){toast('⚠️ Configure une clé API d\'abord',true); showView('apikeys'); setTitle('API / GitHub'); return;}

  inp.value=''; inp.style.height='auto';
  S.attachments=[]; renderAttachRow();
  document.getElementById('send-btn').disabled=true;

  const uMsg={id:uid(),role:'user',text,attachments:atts,ts:new Date()};
  S.msgs.push(uMsg); appendMsgEl(uMsg);
  const first=S.msgs.length===1;

  let currentText = text;
  let currentAtts = atts;
  let loopCount = 0;

  while(loopCount < 5) {
      loopCount++;
      const bMsg={id:uid(),role:'bot',thinking:true,text:'',ts:new Date()};
      S.msgs.push(bMsg); appendMsgEl(bMsg);

      if(loopCount === 1 && IMG_RE.test(currentText)){
        const url=IMG_API+encodeURIComponent(currentText)+'?width=768&height=768&nologo=true&seed='+Date.now();
        bMsg.thinking=false; bMsg.image=url; bMsg.text='Voici ton image :';
        updateMsgEl(bMsg);
        break;
      }

      try {
        const reply=await callAI(tok,currentText,currentAtts);
        const parsed=parseBlocks(reply);
        bMsg.thinking=false; bMsg.codeBlocks=parsed.blocks;
        await typeOut(bMsg,parsed.text);

        const toolBlock = parsed.blocks.find(b => b.lang === 'json' && b.content.includes('"action"'));
        if (toolBlock && S.caps.code) { 
           let toolData;
           try { toolData = JSON.parse(toolBlock.content); } catch(e){}
           if (toolData && toolData.action) {
               bMsg.executingTool = toolData.action;
               updateMsgEl(bMsg);

               const resText = await executeTool(toolData);
               
               bMsg.executingTool = null;
               updateMsgEl(bMsg);

               S.msgs.push({
                   id: uid(), role: 'user', hidden: true,
                   text: `Résultat de l'outil ${toolData.action}:\n\`\`\`\n${resText}\n\`\`\``,
                   ts: new Date()
               });
               
               currentText = "Voici le résultat de ton action. Continue ton raisonnement, utilise un autre outil si nécessaire, ou donne ta réponse finale en fonction de ce résultat :\n" + resText;
               currentAtts = [];
               continue;
           }
        }
        break; 
      } catch(e){
        const isNetwork = e instanceof TypeError || /fetch|network|failed to fetch/i.test(e.message||'');
        if(isNetwork && loopCount === 1){
          S.msgs=S.msgs.filter(m=>m.id!==uMsg.id&&m.id!==bMsg.id);
          document.getElementById('msg-'+uMsg.id)?.remove();
          document.getElementById('msg-'+bMsg.id)?.remove();
          inp.value=text; growTA(inp); S.attachments=atts; renderAttachRow();
          toast('⚠️ Vérifiez votre connexion et réessayez',true);
          document.getElementById('send-btn').disabled=false;
          return;
        }
        bMsg.thinking=false; bMsg.text='❌ '+e.message;
        updateMsgEl(bMsg);
        break;
      }
  }

  document.getElementById('send-btn').disabled=false;
  saveConv(first?text:'');
}

// Effet "machine à écrire" : le texte s'affiche progressivement au lieu
// d'apparaître d'un coup.

async function typeOut(bMsg,fullText){
  bMsg.thinking=false;
  const step=Math.max(1,Math.round(fullText.length/60));
  for(let i=0;i<=fullText.length;i+=step){
    bMsg.text = (bMsg.accumulatedThink ? `<think>\n${bMsg.accumulatedThink}\n</think>\n\n` : '') + fullText.slice(0,i);
    bMsg.typing=true;
    updateMsgEl(bMsg);
    await sleep(12);
  }
  bMsg.text = (bMsg.accumulatedThink ? `<think>\n${bMsg.accumulatedThink}\n</think>\n\n` : '') + fullText;
  bMsg.typing=false;
  updateMsgEl(bMsg);
}



function parseBlocks(raw){
  const blocks=[]; let text=raw;
  const re=/```(\w*)\n?([\s\S]*?)```/g; let m;
  while((m=re.exec(raw))!==null){
    blocks.push({lang:m[1]||'text',content:m[2].trim()});
    text=text.replace(m[0],'[code]');
  }
  return{text:text.replace(/\[code\]/g,'').trim(),blocks};
}

function saveConv(title=''){
  const id='conv-'+uid();
  const t=title.slice(0,40)||'Conversation';
  const existing=S.convs.find(c=>c.id===S.currentConv);
  if(existing){existing.msgs=[...S.msgs];existing.title=existing.title||t;}
  else{
    S.currentConv=id;
    S.convs.unshift({id,title:t,msgs:[...S.msgs],ts:Date.now()});
    if(S.convs.length>20)S.convs=S.convs.slice(0,20);
  }
  localStorage.setItem('nps_convs',JSON.stringify(S.convs.map(c=>({...c,msgs:[]}))));
}

// ═══════ AI CALL ═══════
async function callAI(tok, text, attachments){
  const sys=`Tu es "NPS", un agent IA autonome de haut niveau (similaire à Manus, Devin, Claude 3.7). Tu es conçu pour agir en toute autonomie et produire des résultats réels et livrables.

RÈGLE ABSOLUE N°1 : RÉFLEXION PROFONDE OBLIGATOIRE (<think>)
Tu ne dois JAMAIS agir ou donner ta réponse finale sans avoir d'abord réfléchi.
Toutes tes réponses DOIVENT obligatoirement commencer par une balise <think> et se terminer par </think>.
Dans ce bloc <think>, tu dois raisonner étape par étape :
1. Analyser la demande de l'utilisateur.
2. Élaborer un plan d'action logique.
3. Décider de l'outil à utiliser si nécessaire.
Chaque étape de ta réflexion doit être décrite brièvement sur une nouvelle ligne (le système ajoutera automatiquement une icône appropriée). 
Exemples de mots-clés utiles par ligne : Analyser, Corriger, Réessayer, Fichier, Explorer, Configurer, Terminer, Échec.
Le contenu de <think> est affiché à l'utilisateur sous forme de "Processus de réflexion" séparé et repliable.

RÈGLE N°2 : AUTONOMIE ET RÉSULTATS CONCRETS (Livrables)
Tu n'es pas un simple chatbot qui explique, tu es un agent qui PRODUIT.
Tu dois générer des résultats concrets et livrables à chaque tâche (fichiers, code, documents) plutôt que de simples descriptions textuelles.
Ne dis pas "Je pourrais faire X", FAIS X directement.
Ne demande pas de confirmation à chaque étape intermédiaire. Choisis toi-même la meilleure méthode technique, sauf si une décision majeure bloque complètement.

RÈGLE N°3 : OUTILS ET ACTIONS (Tools)
Si tu dois utiliser un outil, renvoie OBLIGATOIREMENT un bloc de code JSON (en plus de ta réflexion <think>) contenant l'action et ses paramètres.
Actions possibles :
1. "api_call" (Appeler une API REST - les clés globales sont automatiquement injectées)
\`\`\`json
{ "action": "api_call", "params": { "url": "...", "method": "GET" } }
\`\`\`
2. "web_fetch" (Naviguer sur un site web et lire le contenu textuel)
\`\`\`json
{ "action": "web_fetch", "params": { "url": "https://..." } }
\`\`\`
3. "run_code" (Exécuter du JavaScript pur localement)
\`\`\`json
{ "action": "run_code", "params": { "code": "return 2 + 2;" } }
\`\`\`

RÈGLE N°4 : GESTION DE L'ÉCHEC
En cas d'échec d'une action, ne t'arrête pas simplement : analyse la cause de l'échec dans un nouveau bloc <think>, ajuste ton approche, et réessaie automatiquement.

RÈGLE N°5 : SILENCE DURANT L'ACTION
Quand tu utilises un outil, NE METS RIEN D'AUTRE que la balise <think> et le bloc JSON de l'outil. N'ajoute pas de texte normal (en dehors du think) comme "Je vais utiliser cet outil" pour éviter de polluer le chat. Une fois l'action terminée et que tu as le résultat, donne ta conclusion propre en pleine largeur.

${S.prefs?'Instructions de l\'utilisateur: '+S.prefs:''}`;

  const history=S.msgs.slice(-15).filter(m=>!m.thinking && !m.apiHidden).map(m=>({
    role:m.role==='user'?'user':'assistant',
    content:m.text||(m.codeBlocks?.length?m.codeBlocks.map(b=>'```'+b.lang+'\n'+b.content+'```').join('\n'):'...')
  }));

  // Contenu utilisateur : texte + images jointes (vision) si présentes
  const imgs=(attachments||[]).filter(a=>a.dataUrl);
  const userContent=imgs.length
    ? [{type:'text',text:text||'Analyse cette image.'},...imgs.map(a=>({type:'image_url',image_url:{url:a.dataUrl}}))]
    : text;

  // ── Modèle personnalisé : la clé seule détermine le fournisseur ──
  if(S.model==='custom'&&S.customModel&&S.customModel.key){
    const cm=S.customModel;

    if(cm.provider==='anthropic'){
      const r=await fetch(cm.endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':cm.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:cm.model,max_tokens:4000,system:sys,messages:[...history,{role:'user',content:userContent}]})
      });
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||'Erreur API Anthropic '+r.status);}
      const d=await r.json();
      return d.content?.map(c=>c.text||'').join('')||'';
    }

    if(cm.provider==='gemini'){
      const r=await fetch(cm.endpoint+cm.model+':generateContent?key='+cm.key,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:sys+'\n\n'+text}]}]})
      });
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||'Erreur API Gemini '+r.status);}
      const d=await r.json();
      return d.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'';
    }

    // Fournisseurs compatibles OpenAI (GitHub Models, Groq, OpenRouter, HF, OpenAI…)
    const r=await fetch(cm.endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cm.key},
      body:JSON.stringify({model:cm.model,max_tokens:4000,messages:[{role:'system',content:sys},...history,{role:'user',content:userContent}]})
    });
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||'Erreur API '+r.status);}
    const d=await r.json();
    return d.choices?.[0]?.message?.content||'';
  }

  // Use GitHub Models if GH token, else try OpenAI
  const useGM=S.tok&&!S.oai&&!S.ant;
  const endpoint=useGM?GM:'https://api.openai.com/v1/chat/completions';
  const authTok=S.tok||S.oai;

  if(!authTok&&S.ant){
    // Anthropic path (needs proxy due to CORS — note for user)
    throw new Error('Clé Anthropic configurée mais nécessite un proxy CORS. Utilise un token GitHub à la place.');
  }

  const r=await fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+authTok},
    body:JSON.stringify({model:S.model,max_tokens:4000,messages:[{role:'system',content:sys},...history,{role:'user',content:userContent}]})
  });
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||'Erreur API '+r.status);}
  return(await r.json()).choices?.[0]?.message?.content||'';
}

// ═══════ SETTINGS LOGIC ═══════
function growTA(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}
function compKey(e){
  if(window.innerWidth <= 768) return; // Laisse l'Entrée faire un retour à la ligne sur mobile
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}
}

// ═══════ TEXTE VOCAL ═══════
let recog=null, isRecording=false;
function toggleMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('Reconnaissance vocale non supportée par ce navigateur',true);return;}
  const btn=document.getElementById('mic-btn');
  if(isRecording){
    recog&&recog.stop();
    return;
  }
  recog=new SR();
  recog.lang='fr-FR';
  recog.interimResults=true;
  recog.continuous=false;
  const inp=document.getElementById('comp-input');
  const base=inp.value?inp.value+' ':'';
  recog.onstart=()=>{isRecording=true;btn.classList.add('recording');toast('🎤 Parlez maintenant…','info');};
  recog.onresult=(ev)=>{
    let transcript='';
    for(let i=0;i<ev.results.length;i++) transcript+=ev.results[i][0].transcript;
    inp.value=base+transcript;
    growTA(inp);
  };
  recog.onerror=()=>{toast('Micro : échec de la reconnaissance',true);};
  recog.onend=()=>{isRecording=false;btn.classList.remove('recording');};
  recog.start();
}

function toggleApi(inputId,eyeId){
  const i=document.getElementById(inputId);
  i.type=i.type==='password'?'text':'password';
}
function saveApi(inputId,key){
  const v=document.getElementById(inputId).value.trim();
  if(!v)return;
  if(key==='gh'){S.tok=v;localStorage.setItem('nps_gh_tok',v);document.getElementById('gh-status').textContent='✅ Configuré';document.getElementById('gh-status').className='api-status ok';document.getElementById('api-status-row').textContent='Configuré';}
  else if(key==='oai'){S.oai=v;localStorage.setItem('nps_oai_tok',v);document.getElementById('oai-status').textContent='✅ Configuré';document.getElementById('oai-status').className='api-status ok';document.getElementById('api-status-row').textContent='Configuré';}
  else if(key==='ant'){S.ant=v;localStorage.setItem('nps_ant_tok',v);document.getElementById('ant-status').textContent='✅ Configuré';document.getElementById('ant-status').className='api-status ok';}
  toast('Clé sauvegardée ✓');
}

function saveGlobalKey() {
    const val = document.getElementById('global-key').value.trim();
    if (val) {
        const headers = { "Authorization": "Bearer " + val };
        S.globalHeaders = headers;
        localStorage.setItem('nps_global_headers', JSON.stringify(headers));
        localStorage.setItem('nps_global_key', val);
        toast('Clé universelle sauvegardée ✓');
        document.getElementById('global-status').textContent = '✅ Configuré';
        document.getElementById('global-status').className = 'api-status ok';
    } else {
        S.globalHeaders = {};
        localStorage.removeItem('nps_global_headers');
        localStorage.removeItem('nps_global_key');
        toast('Clé universelle effacée');
        document.getElementById('global-status').textContent = 'Non configuré';
        document.getElementById('global-status').className = 'api-status';
    }
}

function toggleCap(el,key){
  el.classList.toggle('on');
  S.caps[key]=el.classList.contains('on');
  localStorage.setItem('nps_caps',JSON.stringify(S.caps));
  const count=Object.values(S.caps).filter(Boolean).length;
  document.getElementById('cap-count-row').textContent=count+' activée'+(count>1?'s':'');
}

function selectModel(model,label){
  S.model=model; localStorage.setItem('nps_model',model);
  document.querySelectorAll('.model-check').forEach(el=>el.style.opacity='0');
  const el=document.getElementById('m-'+model.replace(/[^a-z0-9]/gi,''));
  if(el)el.style.opacity='1';
  document.getElementById('model-label-row').textContent=label;
  toast('Modèle: '+label);
}

function savePrefs(){
  S.prefs=document.getElementById('pf-prefs').value;
  localStorage.setItem('nps_prefs',S.prefs);
  toast('Préférences enregistrées ✓');
}

function onFileAttach(e){
  const files=Array.from(e.target.files||[]);
  if(!files.length)return;
  files.forEach(f=>{
    const item={id:uid(),name:f.name,type:f.type,size:f.size,dataUrl:null};
    S.attachments.push(item);
    if(f.type.startsWith('image/')){
      const reader=new FileReader();
      reader.onload=ev=>{item.dataUrl=ev.target.result; renderAttachRow();};
      reader.readAsDataURL(f);
    }
  });
  renderAttachRow();
  toast(files.length>1?files.length+' fichiers joints':'📎 '+files[0].name+' joint');
  e.target.value='';
}
function renderAttachRow(){
  const row=document.getElementById('attach-row');
  if(!S.attachments.length){row.style.display='none';row.innerHTML='';return;}
  row.style.display='flex';
  row.innerHTML=S.attachments.map(a=>`
    <div class="attach-chip">
      ${a.dataUrl?`<img src="${a.dataUrl}"/>`:'📄'}
      <span>${esc(a.name)}</span>
      <button class="attach-x" onclick="removeAttachment('${a.id}')">✕</button>
    </div>`).join('');
}
function removeAttachment(id){
  S.attachments=S.attachments.filter(a=>a.id!==id);
  renderAttachRow();
}

// ═══════ INIT ═══════
function init(){
  // Thème & police sauvegardés
  if(localStorage.getItem('nps_theme')==='light'){
    document.body.classList.add('light');
    document.getElementById('theme-icon').textContent='☀️';
    document.getElementById('theme-sub-label').textContent='Clair';
  }
  const savedFont=localStorage.getItem('nps_font');
  if(savedFont){
    document.body.classList.add(savedFont);
    const f=FONTS.find(x=>x.cls===savedFont);
    if(f)document.getElementById('font-sub-label').textContent=f.label;
  }
  // Restore API statuses
  if(S.tok){document.getElementById('gh-status').textContent='✅ Configuré';document.getElementById('gh-status').className='api-status ok';document.getElementById('api-status-row').textContent='Configuré';document.getElementById('ghtoken').value=S.tok;}
  if(S.oai){document.getElementById('oai-status').textContent='✅ Configuré';document.getElementById('oai-status').className='api-status ok';document.getElementById('oaitoken').value=S.oai;}
  if(S.ant){document.getElementById('ant-status').textContent='✅ Configuré';document.getElementById('ant-status').className='api-status ok';document.getElementById('anttoken').value=S.ant;}
  if(S.prefs)document.getElementById('pf-prefs').value=S.prefs;
  
  const rawKey = localStorage.getItem('nps_global_key');
  if (rawKey) {
      document.getElementById('global-status').textContent = '✅ Configuré';
      document.getElementById('global-status').className = 'api-status ok';
      document.getElementById('global-key').value = rawKey;
  }
  
  // Cap toggles
  Object.entries(S.caps).forEach(([k,v])=>{
    const el=document.getElementById('cap-'+k);
    if(el){if(v)el.classList.add('on');else el.classList.remove('on');}
  });
  const count=Object.values(S.caps).filter(Boolean).length;
  document.getElementById('cap-count-row').textContent=count+' activée'+(count>1?'s':'');
  // Model
  const mEl=document.getElementById('m-'+S.model.replace(/[^a-z0-9]/gi,''));
  if(mEl){document.querySelectorAll('.model-check').forEach(e=>e.style.opacity='0');mEl.style.opacity='1';}
  document.getElementById('model-label-row').textContent=S.model==='custom'?(S.customModel?.name||'Personnalisé'):S.model;
  // Modèle personnalisé
  if(S.customModel){
    document.getElementById('cm-key').value=S.customModel.key||'';
    document.getElementById('cm-sub-label').textContent=S.customModel.name||'';
    document.getElementById('cm-provider-label').textContent='✓ '+(S.customModel.name||'Modèle')+' connecté';
    document.getElementById('cm-provider-label').style.color='var(--green)';
    if(S.customModel.name==='Serveur personnalisé'){
      document.getElementById('cm-manual-wrap').style.display='block';
      document.getElementById('cm-manual-url').value=S.customModel.endpoint||'';
      document.getElementById('cm-name').value=S.customModel.model||'';
    }
  }
  // Nom d'espace personnalisable (ESPACE NPS -> nom choisi par l'utilisateur)
  document.getElementById('pf-name').value=S.wsName;
  document.getElementById('pf-nick').value=S.wsName;
  applyWorkspaceName();
  // Popup unique d'autorisations groupées au tout premier lancement
  if(!localStorage.getItem('nps_perm_asked')){
    setTimeout(()=>document.getElementById('perm-modal').classList.add('show'),600);
  }
}
function applyWorkspaceName(){
  document.querySelectorAll('.sb-uname').forEach(el=>el.textContent=S.wsName);
  const av=(S.wsName||'NPS').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avEl=document.getElementById('sb-av-txt'); if(avEl)avEl.textContent=av;
}
function saveWorkspaceName(){
  const name=document.getElementById('pf-name').value.trim()||'ESPACE NPS';
  S.wsName=name; localStorage.setItem('nps_ws_name',name);
  applyWorkspaceName();
  toast('Profil mis à jour ✓');
}

// ═══════ AUTORISATIONS GROUPÉES ═══════
// Regroupe les demandes d'autorisation navigateur disponibles (micro, caméra,
// notifications, position). Les autorisations système complètes (accès à
// tous les fichiers, calendrier) doivent être accordées depuis les
// Paramètres Android car un navigateur/WebView ne peut pas les déclencher
// directement — le bouton "Paramètres" de l'écran Autorisations y renvoie.
function closePermModal(){
  document.getElementById('perm-modal').classList.remove('show');
  localStorage.setItem('nps_perm_asked','1');
}
async function requestAllPermissions(){
  closePermModal();
  toast('Demande des autorisations…','info');
  try{ if(navigator.geolocation) navigator.geolocation.getCurrentPosition(()=>{},()=>{}); }catch(e){}
  try{ if(navigator.mediaDevices?.getUserMedia){ const s=await navigator.mediaDevices.getUserMedia({audio:true}); s.getTracks().forEach(t=>t.stop()); } }catch(e){}
  try{ if(navigator.mediaDevices?.getUserMedia){ const s=await navigator.mediaDevices.getUserMedia({video:true}); s.getTracks().forEach(t=>t.stop()); } }catch(e){}
  try{ if(window.Notification&&Notification.requestPermission) await Notification.requestPermission(); }catch(e){}
  toast('Autorisations demandées ✓ — pour l\'accès complet au téléphone, va dans Autorisations > Paramètres');
}
init();
