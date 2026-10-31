const API_BASE_URL = '';

export const api = {
  async fetchAssets(query = '', type = '', page = 1, limit = 100, dir = '', projectId = '') {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (type) params.append('type', type);
    if (dir) params.append('dir', dir);
    if (projectId) params.append('project_id', projectId);
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

  // Browser-displayable image URL (EXR is rendered server-side to JPEG).
  getImageUrl(asset) {
    if (/\.exr$/i.test(asset.filename || asset.path || '')) {
      return `${API_BASE_URL}/api/assets/${asset._id}/preview`;
    }
    return `${API_BASE_URL}/api/assets/${asset._id}/file`;
  },

  async triggerScan(path, projectId = '') {
    const response = await fetch(`${API_BASE_URL}/api/index/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, project_id: projectId || null }),
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

  async fetchProjects() {
    const response = await fetch(`${API_BASE_URL}/api/projects`);
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  },

  async createProject(name) {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || 'Failed to create project');
    }
    return response.json();
  },

  async addAssetsToProject(projectId, assetIds) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_ids: assetIds }),
    });
    if (!response.ok) throw new Error('Failed to add assets to project');
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

  async deleteAssetsByPathDbOnly(path) {
    const params = new URLSearchParams({ path });
    const response = await fetch(`${API_BASE_URL}/api/assets/by-path/db-only?${params}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to remove assets from database');
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

  async clearAllAssets() {
    const response = await fetch(`${API_BASE_URL}/api/assets/all`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to clear assets');
    return response.json();
  },

  async plateAssets(assetIds) {
    const response = await fetch(`${API_BASE_URL}/api/assets/plate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_ids: assetIds }),
    });
    if (!response.ok) throw new Error('Failed to plate assets');
    return response.json();
  },

  async renameItems(items) {
    const response = await fetch(`${API_BASE_URL}/api/assets/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || 'Failed to rename selected items');
    }
    return response.json();
  },

  async completePath(path = '') {
    const params = new URLSearchParams({ path });
    const response = await fetch(`${API_BASE_URL}/api/index/complete?${params}`);
    if (!response.ok) throw new Error('Failed to complete path');
    return response.json();
  },

  async getDefaultScanPath() {
    const response = await fetch(`${API_BASE_URL}/api/index/default`);
    if (!response.ok) throw new Error('Failed to get default path');
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

  async listWatches() {
    const response = await fetch(`${API_BASE_URL}/api/watches`);
    if (!response.ok) throw new Error('Failed to list watches');
    return response.json();
  },

  async addWatch(path, interval = 10) {
    const response = await fetch(`${API_BASE_URL}/api/watches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, interval }),
    });
    if (!response.ok) throw new Error('Failed to add watch');
    return response.json();
  },

  async updateWatch(path, updates) {
    const response = await fetch(`${API_BASE_URL}/api/watches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, ...updates }),
    });
    if (!response.ok) throw new Error('Failed to update watch');
    return response.json();
  },

  async removeWatch(path) {
    const params = new URLSearchParams({ path });
    const response = await fetch(`${API_BASE_URL}/api/watches?${params}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to remove watch');
    return response.json();
  },

  async scanWatch(path) {
    const params = new URLSearchParams({ path });
    const response = await fetch(`${API_BASE_URL}/api/watches/scan?${params}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to trigger watch scan');
    return response.json();
  },
};
