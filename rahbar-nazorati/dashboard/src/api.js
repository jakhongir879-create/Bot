const BASE = '/api/dashboard';
const TOKEN_KEY = 'rahbar_admin_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* brauzer ruxsat bermasa */
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(method, path, body, { raw = false } = {}) {
  const headers = { 'ngrok-skip-browser-warning': '1' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new Error("Server bilan aloqa yo'q. Backend ishga tushganini tekshiring.");
  }
  if (response.status === 401 && path !== '/login' && path !== '/magic') {
    setToken(null);
    onUnauthorized();
  }
  if (raw && response.ok) return response;
  let data = {};
  try {
    data = await response.json();
  } catch {
    /* bo'sh javob */
  }
  if (!response.ok) throw new Error(data.error || 'Xatolik yuz berdi');
  return data;
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

export const api = {
  login: (login, password) => request('POST', '/login', { login, password }),
  magic: (token) => request('POST', '/magic', { token }),
  me: () => request('GET', '/me'),
  assignees: () => request('GET', '/assignees'),
  createTask: (data) => request('POST', '/tasks', data),
  taskAction: (id, data) => request('POST', `/tasks/${id}/action`, data),
  overview: () => request('GET', '/overview'),
  tasks: (filters) => request('GET', `/tasks${qs(filters)}`),
  task: (id) => request('GET', `/tasks/${id}`),
  activity: (days) => request('GET', `/activity${qs({ days })}`),
  employeeActivity: (id) => request('GET', `/activity/${id}`),
  stock: () => request('GET', '/stock/checks'),
  stockCheck: (id) => request('GET', `/stock/checks/${id}`),
  deleteStockCheck: (id) => request('DELETE', `/stock/checks/${id}`),
  uploadStock: (form) => request('POST', '/stock/upload', form),
  stockTemplate: () => request('GET', '/stock/template', undefined, { raw: true }),
  finance: () => request('GET', '/finance'),
  saveEntry: (data) => request('POST', '/finance/entries', data),
  deleteEntry: (id) => request('DELETE', `/finance/entries/${id}`),
  saveGoal: (data, id) => (id ? request('PUT', `/finance/goals/${id}`, data) : request('POST', '/finance/goals', data)),
  deleteGoal: (id) => request('DELETE', `/finance/goals/${id}`),
  saveDecision: (data, id) => (id ? request('PUT', `/finance/decisions/${id}`, data) : request('POST', '/finance/decisions', data)),
  deleteDecision: (id) => request('DELETE', `/finance/decisions/${id}`),
  evaluateDecision: (id) => request('POST', `/finance/decisions/${id}/evaluate`),
  aiGenerate: (module) => request('POST', `/ai/${module}`),
  aiAsk: (question) => request('POST', '/ai/ask', { question }),
  aiLatest: (module) => request('GET', `/ai/latest/${module}`),
  aiReports: (filters) => request('GET', `/ai/reports${qs(filters)}`),
  deleteAiReport: (id) => request('DELETE', `/ai/reports/${id}`),
  employees: () => request('GET', '/employees'),
  saveEmployee: (data, id) => (id ? request('PUT', `/employees/${id}`, data) : request('POST', '/employees', data)),
  setEmployeeActive: (id, isActive) => request('PATCH', `/employees/${id}/active`, { isActive }),
  settings: () => request('GET', '/settings'),
  saveSettings: (data) => request('PUT', '/settings', data),
};
