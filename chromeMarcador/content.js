function isTextualElement(element) {
  const textOnlyTags = ['SPAN', 'A', 'P', 'STRONG', 'EM', 'B', 'I', 'U', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
  const tagName = element.tagName;
  if (textOnlyTags.includes(tagName)) {
    return !element.querySelector('img, svg, canvas, video, audio, input, button, iframe');
  }
  return false;
}

function getTextContent(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll('script, style, img, svg, iframe, video, audio').forEach(el => el.remove());
  return clone.textContent.trim();
}

function showToast(message, type = 'success') {
  const existingToast = document.getElementById('marcador-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.id = 'marcador-toast';
  toast.className = `marcador-toast marcador-toast-${type}`;
  toast.innerHTML = `
    <span class="marcador-toast-icon">✓</span>
    <span class="marcador-toast-message">${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, CONFIG.TOAST_DURATION);
}

function generateAnchorId() {
  return 'marcador-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getSelector(element) {
  if (element.id) return '#' + element.id;
  
  let selector = element.tagName.toLowerCase();
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c && !c.includes(':'));
    if (classes.length) selector += '.' + classes[0];
  }
  
  const parent = element.parentElement;
  if (parent && parent.tagName !== 'BODY') {
    const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      selector += ':nth-child(' + index + ')';
    }
  }
  
  return selector;
}

async function handleDoubleClick(event) {
  const target = event.target;

  if (!isTextualElement(target)) {
    console.log('[Marcador] Elemento no es textual:', target.tagName);
    return;
  }

  const text = getTextContent(target);
  if (!text) {
    console.log('[Marcador] Sin texto');
    return;
  }

  const anchorId = generateAnchorId();
  target.id = anchorId;

  const bookmark = {
    text: text.substring(0, 200),
    anchorId: anchorId,
    selector: getSelector(target),
    url: window.location.href,
    pageTitle: document.title
  };

  console.log('[Marcador] Guardando:', bookmark);
  await Storage.saveBookmark(bookmark);
  showToast(`Marcador guardado: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
}

async function restoreAnchor(anchorId, selector) {
  let element = document.getElementById(anchorId);
  
  if (!element && selector) {
    element = document.querySelector(selector);
    if (element) {
      element.id = anchorId;
    }
  }
  
  if (element) {
    setTimeout(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

console.log('[Marcador] Content script cargado', CONFIG.TARGET_DOMAIN);

if (window.location.hostname.includes(CONFIG.TARGET_DOMAIN)) {
  console.log('[Marcador] Dominio correcto, activando listeners');
  document.addEventListener('dblclick', handleDoubleClick);
  
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'navigateToAnchor') {
      restoreAnchor(msg.anchorId, msg.selector);
    }
  });
  
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    let anchorId = params.get('id');
    let selector = params.get('selector') ? decodeURIComponent(params.get('selector')) : null;
    
    if (!anchorId) {
      anchorId = hash.split('&')[0];
    }
    
    if (anchorId && anchorId.startsWith('marcador-')) {
      console.log('[Marcador] Restaurando anchor:', anchorId);
      setTimeout(() => restoreAnchor(anchorId, selector), 500);
    }
  }
} else {
  console.log('[Marcador] Dominio no coincide:', window.location.hostname, '!=', CONFIG.TARGET_DOMAIN);
}
