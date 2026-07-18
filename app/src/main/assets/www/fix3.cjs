const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const target = `function openExitModal(){document.getElementById('exit-modal').classList.add('show')}
function closeExitModal(){document.getElementById('exit-modal').classList.remove('show')}
// Pop state : si on est déjà sur l'écran d'accueil (chat),
  closeExitModal();
  // Pont natif Android si l'app est compilée en WebView (à connecter côté Android : window.Android.exitApp())
  if(window.Android&&window.Android.exitApp){window.Android.exitApp();return;}
  if(window.navigator.app&&window.navigator.app.exitApp){window.navigator.app.exitApp();return;}
  window.close();
}`;

const replacement = `function openExitModal(){document.getElementById('exit-modal').classList.add('show')}
function closeExitModal(){document.getElementById('exit-modal').classList.remove('show')}
function confirmExit(){
  closeExitModal();
  // Pont natif Android si l'app est compilée en WebView (à connecter côté Android : window.Android.exitApp())
  if(window.Android&&window.Android.exitApp){window.Android.exitApp();return;}
  if(window.navigator.app&&window.navigator.app.exitApp){window.navigator.app.exitApp();return;}
  window.close();
}`;

content = content.replace(target, replacement);
fs.writeFileSync('index.html', content);
