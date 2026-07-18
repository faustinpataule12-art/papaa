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
