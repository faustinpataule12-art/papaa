// Pop state : si on est déjà sur l'écran d'accueil (chat),
// on affiche une confirmation avant de fermer ; sinon on revient en arrière.
history.replaceState({npsView:'chat'},'','#chat');
window.addEventListener('popstate',function(e){
  if(document.getElementById('inapp-view').classList.contains('show')){ closeInApp(); return; }
  if(typeof sbOpen !== 'undefined' && sbOpen){ closeSidebar(); history.pushState({npsView:currentViewId()},'','#'+currentViewId()); return; }
  if(document.getElementById('exit-modal').classList.contains('show')){ closeExitModal(); return; }
  const st=e.state&&e.state.npsView;
  if(st&&st!=='chat'){
    showView(st,true);
  } else if(currentViewId()!=='chat'){
    showView('chat',true); setTitle('NPS');
    history.pushState({npsView:'chat'},'','#chat');
  } else {
    openExitModal();
    history.pushState({npsView:'chat'},'','#chat');
  }
});
