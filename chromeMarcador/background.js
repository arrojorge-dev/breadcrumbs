chrome.runtime.onInstalled.addListener(() => {
  console.log('Marcador de Texto instalado');
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
