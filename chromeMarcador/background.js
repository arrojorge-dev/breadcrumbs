chrome.runtime.onInstalled.addListener(() => {
  console.log('Marcador de Texto instalado');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'updateNote') {
    chrome.storage.local.get('bookmarks', (result) => {
      const bookmarks = result.bookmarks || [];
      const bookmark = bookmarks.find(b => b.id === msg.id);
      if (bookmark) {
        bookmark.note = msg.note.substring(0, 128);
        chrome.storage.local.set({ bookmarks }, () => {
          sendResponse({ status: 'success' });
        });
      } else {
        sendResponse({ status: 'error', message: 'Bookmark not found' });
      }
    });
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.bookmarks && area === 'local') {
    chrome.action.setBadgeText({
      text: changes.bookmarks.newValue?.length > 0 
        ? changes.bookmarks.newValue.length.toString() 
        : ''
    });
  }
});
