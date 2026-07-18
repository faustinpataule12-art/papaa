const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const replacement = `
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
      return \`Status: \${res.status}\\n\\n\${text}\`;
    } catch (e) {
      return "Erreur d'exécution: " + e.message;
    }
  }
  if (toolData.action === 'web_fetch') {
    try {
      const res = await fetch('https://r.jina.ai/' + toolData.params.url, {
          headers: {
              'X-Return-Format': 'markdown'
          }
      });
      if (!res.ok) throw new Error("Erreur HTTP " + res.status);
      let text = await res.text();
      if (text.length > 8000) text = text.slice(0, 8000) + '\\n\\n... (tronqué)';
      return \`Contenu extrait de \${toolData.params.url} :\\n\\n\${text}\`;
    } catch (e) {
      try {
        const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(toolData.params.url);
        const res = await fetch(proxyUrl);
        const data = await res.json();
        if (!data.contents) throw new Error("Aucun contenu retourné");
        const doc = new DOMParser().parseFromString(data.contents, 'text/html');
        let text = doc.body.innerText.replace(/\\s+/g, ' ').trim();
        if (text.length > 5000) text = text.slice(0, 5000) + '... (tronqué)';
        return \`Contenu brut extrait de \${toolData.params.url} (mode fallback) :\\n\\n\${text}\`;
      } catch(e2) {
        return "Erreur d'accès au site avec toutes les méthodes: " + e2.message;
      }
    }
  }
  if (toolData.action === 'run_code') {
    try {
      const result = new Function(toolData.params.code)();
      return "Résultat de l'exécution JS :\\n" + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
    } catch(e) {
      return "Erreur d'exécution JS :\\n" + e.message;
    }
  }
  return "Action inconnue ou bloquée.";
}
`;

content = content.replace(/async function executeTool[\s\S]*?Action inconnue ou bloquée."\n\}/g, replacement.trim());
fs.writeFileSync('index.html', content);
