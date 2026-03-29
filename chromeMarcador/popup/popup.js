async function loadBookmarks() {
  const list = document.getElementById('bookmarksList');
  const bookmarks = await Storage.getAllBookmarks();

  if (bookmarks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span>📌</span>
        <p>No hay marcadores guardados</p>
        <p style="font-size:12px;margin-top:8px;">Doble clic en texto de ${CONFIG.TARGET_DOMAIN} para guardar</p>
      </div>
    `;
    return;
  }

  list.innerHTML = bookmarks.map(b => `
    <div class="bookmark-item" data-url="${b.url}" data-anchor="${b.anchorId}">
      <button class="delete-btn" data-id="${b.id}">×</button>
      <div class="bookmark-content">
        <div class="bookmark-text">${escapeHtml(b.text)}</div>
        <div class="bookmark-meta">
          <span>${getDomain(b.url)}</span>
          <span>${formatDate(b.createdAt)}</span>
        </div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      const id = item.querySelector('.delete-btn').dataset.id;
      const bookmarks = await Storage.getAllBookmarks();
      const bookmark = bookmarks.find(b => b.id === id);
      if (!bookmark) return;
      
      const encodedSelector = bookmark.selector ? encodeURIComponent(bookmark.selector) : '';
      const hashWithSelector = `#id=${bookmark.anchorId}&selector=${encodedSelector}`;
      const url = bookmark.url + hashWithSelector;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const baseUrl = bookmark.url.split('?')[0];
        const currentBaseUrl = currentTab.url.split('?')[0];
        const isSamePage = currentBaseUrl === baseUrl;

        if (isSamePage) {
          chrome.tabs.sendMessage(currentTab.id, {
            action: 'navigateToAnchor',
            anchorId: bookmark.anchorId,
            selector: bookmark.selector
          });
        } else {
          chrome.tabs.update({ url: url });
        }
        window.close();
      });
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBookmark(e.target.dataset.id);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

async function deleteBookmark(id) {
  await Storage.deleteBookmark(id);
  loadBookmarks();
}

document.getElementById('clearAll').addEventListener('click', async () => {
  if (confirm('¿Eliminar todos los marcadores?')) {
    await Storage.clearAllBookmarks();
    loadBookmarks();
  }
});

loadBookmarks();
