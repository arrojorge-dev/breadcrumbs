const Storage = {
  async saveBookmark(bookmark) {
    const data = await this.getAllBookmarks();
    data.push({
      id: Date.now().toString(),
      ...bookmark,
      createdAt: new Date().toISOString()
    });
    await chrome.storage.local.set({ bookmarks: data });
    return data;
  },

  async getAllBookmarks() {
    const result = await chrome.storage.local.get('bookmarks');
    return result.bookmarks || [];
  },

  async deleteBookmark(id) {
    const data = await this.getAllBookmarks();
    const filtered = data.filter(b => b.id !== id);
    await chrome.storage.local.set({ bookmarks: filtered });
    return filtered;
  },

  async clearAllBookmarks() {
    await chrome.storage.local.set({ bookmarks: [] });
  }
};
