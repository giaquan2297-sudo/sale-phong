async function request(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sale_tro_token') : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const headers = isFormData
    ? { ...authHeaders, ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...authHeaders, ...(options.headers || {}) };

  const resp = await fetch(url, {
    ...options,
    headers,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `Lỗi ${resp.status}`);
  }
  return data;
}

export const api = {
  // Auth
  login: (credentials) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/api/auth/me'),
  getUsers: () => request('/api/auth/users'),

  // Public Leads
  submitPublicLead: (payload) =>
    request('/api/public/leads', { method: 'POST', body: JSON.stringify(payload) }),

  // Health
  health: () => request('/api/health'),

  // Rooms
  getRooms: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    const qs = params.toString();
    return request(`/api/rooms${qs ? `?${qs}` : ''}`);
  },
  getRoom: (id) => request(`/api/rooms/${id}`),
  createRoom: (payload) => request('/api/rooms', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoom: (id, payload) =>
    request(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateRoomStatus: (id, status) =>
    request(`/api/rooms/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  bulkUpdateRoomStatus: (ids, status) =>
    request('/api/rooms/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status }) }),
  deleteRoom: (id) => request(`/api/rooms/${id}`, { method: 'DELETE' }),
  openRoomFolder: (id) => request(`/api/rooms/${id}/open-folder`, { method: 'POST' }),

  // Images
  uploadRoomImages: (roomId, filesWithMeta) => {
    const fd = new FormData();
    const meta = [];
    filesWithMeta.forEach(({ file, width, height }) => {
      fd.append('images', file);
      meta.push({ width, height });
    });
    fd.append('meta', JSON.stringify(meta));
    return request(`/api/rooms/${roomId}/images`, { method: 'POST', body: fd });
  },
  setCoverImage: (imageId) => request(`/api/images/${imageId}/cover`, { method: 'PATCH' }),
  deleteImage: (imageId) => request(`/api/images/${imageId}`, { method: 'DELETE' }),

  // Landlords
  getLandlords: () => request('/api/landlords'),
  createLandlord: (payload) =>
    request('/api/landlords', { method: 'POST', body: JSON.stringify(payload) }),
  updateLandlord: (id, payload) =>
    request(`/api/landlords/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLandlord: (id) => request(`/api/landlords/${id}`, { method: 'DELETE' }),

  // Google Sheets
  getSheets: () => request('/api/sheets'),
  uploadGoogleKey: (fileOrJson) => {
    if (typeof fileOrJson === 'string') {
      return request('/api/sheets/google-key', {
        method: 'POST',
        body: JSON.stringify({ json: fileOrJson }),
      });
    }
    const fd = new FormData();
    fd.append('file', fileOrJson);
    return request('/api/sheets/google-key', { method: 'POST', body: fd });
  },
  deleteGoogleKey: () => request('/api/sheets/google-key', { method: 'DELETE' }),
  createSheet: (payload) =>
    request('/api/sheets', { method: 'POST', body: JSON.stringify(payload) }),
  inspectSheet: (payload) =>
    request('/api/sheets/inspect', { method: 'POST', body: JSON.stringify(payload) }),
  quickAddSheet: (payload) =>
    request('/api/sheets/quick-add', { method: 'POST', body: JSON.stringify(payload) }),
  updateSheet: (id, payload) =>
    request(`/api/sheets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSheet: (id) => request(`/api/sheets/${id}`, { method: 'DELETE' }),
  syncSheet: (id) => request(`/api/sheets/${id}/sync`, { method: 'POST' }),
  syncAllSheets: () => request('/api/sheets/sync-all', { method: 'POST' }),

  // Customers & Sends
  getCustomers: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return request(`/api/customers${q ? `?${q}` : ''}`);
  },
  getCustomerSends: (id) => request(`/api/customers/${id}/sends`),
  createCustomer: (payload) =>
    request('/api/customers', { method: 'POST', body: JSON.stringify(payload) }),
  updateCustomer: (id, payload) =>
    request(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateCustomerStatus: (id, status) =>
    request(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  closeCustomerDeal: (id, payload) =>
    request(`/api/customers/${id}/close-deal`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteCustomer: (id) => request(`/api/customers/${id}`, { method: 'DELETE' }),
  recordSend: (payload) =>
    request('/api/sends', { method: 'POST', body: JSON.stringify(payload) }),
  getSends: () => request('/api/sends'),

  // Commissions
  getCommissions: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return request(`/api/commissions${q ? `?${q}` : ''}`);
  },
  getCommissionStats: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return request(`/api/commissions/stats${q ? `?${q}` : ''}`);
  },
  createCommission: (payload) =>
    request('/api/commissions', { method: 'POST', body: JSON.stringify(payload) }),
  updateCommissionStatus: (id, payload) =>
    request(`/api/commissions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(typeof payload === 'string' ? { status: payload } : payload),
    }),
  updateCommission: (id, payload) =>
    request(`/api/commissions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCommission: (id) => request(`/api/commissions/${id}`, { method: 'DELETE' }),

  // Shared Carts
  getCarts: () => request('/api/carts'),
  createCart: (payload) =>
    request('/api/carts', { method: 'POST', body: JSON.stringify(payload) }),
  deleteCart: (id) => request(`/api/carts/${id}`, { method: 'DELETE' }),
  getPublicCart: (slug) => request(`/api/public/carts/${slug}`),

  // Storage & Settings
  getStorage: () => request('/api/storage'),
  runCleanup: (days) =>
    request('/api/storage/cleanup', { method: 'POST', body: JSON.stringify({ days }) }),
  getSettings: () => request('/api/settings'),
  updateSettings: (payload) =>
    request('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  getNetworkInfo: () => request('/api/network-info'),
};
