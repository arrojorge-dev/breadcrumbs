let bookmarkedSelectors = new Map();
let pendingRestores = [];
let observer = null;
let restoreAttempts = {};

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

function normalizeText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
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
  if (element.id) {
    const safeId = element.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `[id="${safeId}"]`;
  }
  
  let selector = element.tagName.toLowerCase();
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c && !c.includes(':'));
    if (classes.length) selector += `.${classes[0].replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }
  
  const parent = element.parentElement;
  if (parent && parent.tagName !== 'BODY') {
    const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      selector += `:nth-child(${index})`;
    }
  }
  
  return selector;
}

function findElementByText(text, tagName) {
  if (!text) return null;
  
  const normalizedSearch = normalizeText(text);
  const textualTags = ['SPAN', 'A', 'P', 'STRONG', 'EM', 'B', 'I', 'U', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
  
  if (tagName) {
    const elements = document.querySelectorAll(tagName.toLowerCase());
    for (const el of elements) {
      if (!el.querySelector('img, svg, canvas, video, audio, input, button, iframe')) {
        const elText = getTextContent(el);
        if (normalizeText(elText) === normalizedSearch) {
          return el;
        }
      }
    }
  }
  
  for (const tag of textualTags) {
    const elements = document.querySelectorAll(tag.toLowerCase());
    for (const el of elements) {
      if (el.closest('[id^="marcador-"]')) continue;
      if (!el.querySelector('img, svg, canvas, video, audio, input, button, iframe')) {
        const elText = getTextContent(el);
        if (normalizeText(elText) === normalizedSearch) {
          return el;
        }
      }
    }
  }
  
  return null;
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
    text: text.substring(0, 500),
    textNormalized: normalizeText(text),
    anchorId: anchorId,
    selector: getSelector(target),
    tagName: target.tagName,
    note: '',
    url: window.location.href,
    pageTitle: document.title
  };

  console.log('[Marcador] Guardando:', bookmark);
  await Storage.saveBookmark(bookmark);
  bookmarkedSelectors.set(anchorId, { selector: bookmark.selector, text: text, tagName: target.tagName });
  showToast(`Marcador guardado: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
}

async function restoreAnchor(anchorId, selector, text, tagName, isHighPriority = false) {
  console.log('[Marcador] restoreAnchor:', { anchorId, selector: selector?.substring(0, 50), hasText: !!text, isHighPriority });
  
  let element = document.getElementById(anchorId);
  if (element) {
    console.log('[Marcador] Encontrado por ID directo');
    bookmarkedSelectors.set(anchorId, { selector, text, tagName });
    scrollToElement(element);
    return true;
  }
  
  if (selector) {
    try {
      element = document.querySelector(selector);
      if (element) {
        console.log('[Marcador] Encontrado por selector CSS');
        element.id = anchorId;
        bookmarkedSelectors.set(anchorId, { selector, text, tagName });
        scrollToElement(element);
        return true;
      }
    } catch (e) {
      console.warn('[Marcador] Selector inválido:', selector, e);
    }
  }
  
  if (text) {
    console.log('[Marcador] Buscando por texto...');
    element = findElementByText(text, tagName);
    if (element) {
      console.log('[Marcador] Encontrado por texto!');
      element.id = anchorId;
      bookmarkedSelectors.set(anchorId, { selector, text, tagName });
      scrollToElement(element);
      return true;
    }
  }
  
  console.log('[Marcador] No se encontró el elemento');
  return false;
}

function scrollToElement(element) {
  setTimeout(() => {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.style.outline = '2px solid #3b82f6';
    element.style.outlineOffset = '2px';
    setTimeout(() => {
      element.style.outline = '';
      element.style.outlineOffset = '';
    }, 2000);
  }, 100);
}

function initObserver() {
  if (observer) return;
  
  observer = new MutationObserver((mutations) => {
    for (const [anchorId, data] of bookmarkedSelectors) {
      if (!document.getElementById(anchorId) && data.selector) {
        try {
          const match = document.querySelector(data.selector);
          if (match && !match.id) {
            match.id = anchorId;
            scrollToElement(match);
            console.log('[Marcador] Reinyectado por MutationObserver');
          }
        } catch (e) {}
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

async function retryRestore(anchorId, selector, text, tagName, maxAttempts = 10, delay = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`[Marcador] Intento ${i + 1}/${maxAttempts} de restaurar ${anchorId}`);
    const found = await restoreAnchor(anchorId, selector, text, tagName, i === maxAttempts - 1);
    if (found) return true;
    await new Promise(r => setTimeout(r, delay));
  }
  console.log(`[Marcador] No se pudo restaurar ${anchorId} después de ${maxAttempts} intentos`);
  return false;
}

let retryRestoreInterval = null;

async function restoreAllAnchorsForCurrentURL() {
  const currentURL = Storage.normalizeUrl(window.location.href);
  console.log('[Marcador] URL actual normalizada:', currentURL);
  
  const bookmarks = await Storage.getBookmarksByURL(currentURL);
  console.log('[Marcador] Marcadores encontrados para esta URL:', bookmarks.length);
  
  if (bookmarks.length === 0) {
    console.log('[Marcador] No hay marcadores para esta URL');
    return;
  }
  
  let restoredCount = 0;
  for (const bookmark of bookmarks) {
    console.log('[Marcador] Procesando marcador:', bookmark.anchorId);
    const found = await restoreAnchor(bookmark.anchorId, bookmark.selector, bookmark.text, bookmark.tagName);
    if (found) restoredCount++;
    initObserver();
  }
  
  if (restoredCount < bookmarks.length) {
    console.log(`[Marcador] ${bookmarks.length - restoredCount} marcadores pendientes, iniciando reintentos...`);
    
    if (retryRestoreInterval) clearInterval(retryRestoreInterval);
    let attempts = 0;
    const maxAttempts = 20;
    
    retryRestoreInterval = setInterval(async () => {
      attempts++;
      console.log(`[Marcador] Reintento ${attempts}/${maxAttempts}`);
      
      for (const bookmark of bookmarks) {
        if (!document.getElementById(bookmark.anchorId)) {
          await restoreAnchor(bookmark.anchorId, bookmark.selector, bookmark.text, bookmark.tagName);
        }
      }
      
      const stillPending = bookmarks.filter(b => !document.getElementById(b.anchorId)).length;
      console.log(`[Marcador] Marcadores pendientes: ${stillPending}`);
      
      if (stillPending === 0 || attempts >= maxAttempts) {
        clearInterval(retryRestoreInterval);
        retryRestoreInterval = null;
        console.log('[Marcador] Finalizados reintentos');
      }
    }, 1000);
  }
}

async function init() {
  console.log('[Marcador] Content script cargado', CONFIG.TARGET_DOMAIN);

  if (window.location.hostname.includes(CONFIG.TARGET_DOMAIN)) {
    console.log('[Marcador] Dominio correcto, activando listeners');
    document.addEventListener('dblclick', handleDoubleClick);
    
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'navigateToAnchor') {
        console.log('[Marcador] Mensaje recibido:', msg);
        restoreAnchor(msg.anchorId, msg.selector, msg.text, msg.tagName);
      }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    await restoreAllAnchorsForCurrentURL();
    
    if (window.location.hash && window.location.hash.startsWith('#marcador-')) {
      const anchorId = window.location.hash.substring(1);
      console.log('[Marcador] Hash detectado:', anchorId);
      
      if (anchorId.startsWith('marcador-')) {
        const url = new URL(window.location.href);
        const selectorParam = url.searchParams.get('s');
        const textParam = url.searchParams.get('t');
        const tagNameParam = url.searchParams.get('g');
        
        const selector = selectorParam ? decodeURIComponent(selectorParam) : null;
        const text = textParam ? decodeURIComponent(textParam) : null;
        
        console.log('[Marcador] Params del hash:', { selector, hasText: !!text, tagName: tagNameParam });
        
        setTimeout(async () => {
          let found = await restoreAnchor(anchorId, selector, text, tagNameParam);
          if (!found) {
            const bookmark = await Storage.getBookmarkByAnchorId(anchorId);
            if (bookmark) {
              console.log('[Marcador] Buscando en storage local...');
              await restoreAnchor(anchorId, bookmark.selector, bookmark.text, bookmark.tagName);
            } else {
              console.log('[Marcador] Marcador no encontrado en storage');
            }
          }
        }, 500);
      }
    }
  } else {
    console.log('[Marcador] Dominio no coincide:', window.location.hostname, '!=', CONFIG.TARGET_DOMAIN);
  }
}

init();
