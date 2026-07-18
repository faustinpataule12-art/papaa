const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const replacement = `
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
    ? c.map(v=>\`<div class="sb-recent" onclick="loadConv('\${v.id}');closeSidebar()">\${esc(v.title)}</div>\`).join('')
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
`;

const re = /if\(next\.cls\)document\.body\.classList\.adfunction showView\(id\)\{([\s\S]*?)function confirmExit\(\)\{/m;
content = content.replace(re, `if(next.cls)document.body.classList.add(next.cls);\n  document.getElementById('font-sub-label').textContent=next.label;\n  localStorage.setItem('nps_font',next.cls);\n}\n${replacement}\nfunction confirmExit(){`);

fs.writeFileSync('index.html', content);
