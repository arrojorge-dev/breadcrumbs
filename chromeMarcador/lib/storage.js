const Storage = {
  normalizeUrl(url) {
    try {
      return new URL(url).href.split('#')[0].split('?')[0];
    } catch {
      return url.split('#')[0].split('?')[0];
    }
  },
  
  async saveBookmark(bookmark) {
    const data = await this.getAllBookmarks();
    const normalizedUrl = this.normalizeUrl(bookmark.url);
    
    data.push({
      id: Date.now().toString(),
      ...bookmark,
      note: bookmark.note || '',
      url: normalizedUrl,
      createdAt: new Date().toISOString()
    });
    await chrome.storage.local.set({ bookmarks: data });
    
    await this.saveAnchorToURL(normalizedUrl, bookmark.anchorId);
    
    return data;
  },

  async getAllBookmarks() {
    const result = await chrome.storage.local.get('bookmarks');
    return result.bookmarks || [];
  },

  async getAnchorsByURL(url) {
    const result = await chrome.storage.local.get('url-specific-bookmarks');
    const urlBookmarks = result['url-specific-bookmarks'] || {};
    return urlBookmarks[url] || [];
  },
  
  async getBookmarksByURL(url) {
    const normalizedUrl = this.normalizeUrl(url);
    const allBookmarks = await this.getAllBookmarks();
    return allBookmarks.filter(b => this.normalizeUrl(b.url) === normalizedUrl);
  },
  
  async getBookmarkByAnchorId(anchorId) {
    const allBookmarks = await this.getAllBookmarks();
    return allBookmarks.find(b => b.anchorId === anchorId) || null;
  },

  async saveAnchorToURL(url, anchorId) {
    const normalizedUrl = this.normalizeUrl(url);
    const result = await chrome.storage.local.get('url-specific-bookmarks');
    const urlBookmarks = result['url-specific-bookmarks'] || {};
    
    if (!urlBookmarks[normalizedUrl]) {
      urlBookmarks[normalizedUrl] = [];
    }
    
    if (!urlBookmarks[normalizedUrl].includes(anchorId)) {
      urlBookmarks[normalizedUrl].push(anchorId);
    }
    
    await chrome.storage.local.set({ 'url-specific-bookmarks': urlBookmarks });
  },

  async removeAnchorFromURL(url, anchorId) {
    const normalizedUrl = this.normalizeUrl(url);
    const result = await chrome.storage.local.get('url-specific-bookmarks');
    const urlBookmarks = result['url-specific-bookmarks'] || {};
    
    if (urlBookmarks[normalizedUrl]) {
      urlBookmarks[normalizedUrl] = urlBookmarks[normalizedUrl].filter(id => id !== anchorId);
      
      if (urlBookmarks[normalizedUrl].length === 0) {
        delete urlBookmarks[normalizedUrl];
      }
    }
    
    await chrome.storage.local.set({ 'url-specific-bookmarks': urlBookmarks });
  },

  async deleteBookmark(id) {
    const data = await this.getAllBookmarks();
    const bookmark = data.find(b => b.id === id);
    
    if (bookmark) {
      await this.removeAnchorFromURL(bookmark.url, bookmark.anchorId);
    }
    
    const filtered = data.filter(b => b.id !== id);
    await chrome.storage.local.set({ bookmarks: filtered });
    return filtered;
  },

  async clearAllBookmarks() {
    await chrome.storage.local.set({ bookmarks: [], 'url-specific-bookmarks': {} });
  }
};
