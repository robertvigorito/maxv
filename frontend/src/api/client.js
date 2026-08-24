const API_BASE_URL = '';

export const api = {
  async fetchAssets(query = '', type = '', page = 1, limit = 100) {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (type) params.append('type', type);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/api/assets?${params}`);
    if (!response.ok) throw new Error('Failed to fetch assets');
    return response.json();
  },

  async fetchAsset(id) {
    const response = await fetch(`${API_BASE_URL}/api/assets/${id}`);
    if (!response.ok) throw new Error('Failed to fetch asset');
    return response.json();
  },

  getThumbnailUrl(id) {
    return `${API_BASE_URL}/api/assets/${id}/thumbnail`;
  },

  getFileUrl(id) {
    return `${API_BASE_URL}/api/assets/${id}/file`;
  },

  async triggerScan(path) {
    const response = await fetch(`${API_BASE_URL}/api/index/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) throw new Error('Failed to trigger scan');
    return response.json();
  },

  async refreshAll() {
    const response = await fetch(`${API_BASE_URL}/api/index/refresh`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to refresh media');
    return response.json();
  },

  async scanStatus() {
    const response = await fetch(`${API_BASE_URL}/api/index/status`);
    if (!response.ok) throw new Error('Failed to get scan status');
    return response.json();
  },

  async fetchTags() {
    const response = await fetch(`${API_BASE_URL}/api/assets/tags`);
    if (!response.ok) throw new Error('Failed to fetch tags');
    return response.json();
  },

  async addTags(assetIds, tags) {
    const response = await fetch(`${API_BASE_URL}/api/assets/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_ids: assetIds, tags }),
    });
    if (!response.ok) throw new Error('Failed to add tags');
    return response.json();
  },

  async removeTags(assetIds, tags) {
    const response = await fetch(`${API_BASE_URL}/api/assets/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_ids: assetIds, tags }),
    });
    if (!response.ok) throw new Error('Failed to remove tags');
    return response.json();
  },

  async clearTags(assetIds) {
    const response = await fetch(`${API_BASE_URL}/api/assets/tags/clear`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_ids: assetIds }),
    });
    if (!response.ok) throw new Error('Failed to clear tags');
    return response.json();
  },

  async deleteAssetsByPath(path) {
    const params = new URLSearchParams({ path });
    const response = await fetch(`${API_BASE_URL}/api/assets/by-path?${params}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete by path');
    return response.json();
  },

  async openFolder(path) {
    const params = new URLSearchParams({ path });
    const response = await fetch(`${API_BASE_URL}/api/index/open?${params}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to open folder');
    return response.json();
  },

  async deleteAssets(assetIds, disk = false) {
    const params = new URLSearchParams();
    if (disk) params.append('disk', 'true');
    const response = await fetch(`${API_BASE_URL}/api/assets?${params}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_ids: assetIds }),
    });
    if (!response.ok) throw new Error('Failed to delete assets');
    return response.json();
  },

  async openInExplorer(assetId) {
    const response = await fetch(`${API_BASE_URL}/api/assets/${assetId}/open`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to open in explorer');
    return response.json();
  },

  async searchAssets(query, limit = 50) {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/api/assets/search?${params}`);
    if (!response.ok) throw new Error('Failed to search assets');
    return response.json();
  },
};
