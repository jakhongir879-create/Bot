import { tg } from './telegram.js';

const BASE = `${import.meta.env.BASE_URL.replace(/\/app\/$/, '')}/api/app`;

async function request(method, path, body) {
  const headers = {
    'X-Telegram-Init-Data': tg?.initData || '',
    'ngrok-skip-browser-warning': '1',
  };
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
    throw new Error("Server bilan aloqa yo'q. Internetni tekshiring.");
  }
  let data = {};
  try {
    data = await response.json();
  } catch {
    /* bo'sh javob */
  }
  if (!response.ok) {
    const error = new Error(data.error || 'Xatolik yuz berdi');
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request('GET', '/me'),
  onboarded: () => request('POST', '/onboarded'),
  tasks: (scope, filter) => request('GET', `/tasks?scope=${scope}&filter=${filter}`),
  task: (id) => request('GET', `/tasks/${id}`),
  createTask: (data) => request('POST', '/tasks', data),
  action: (id, data) => request('POST', `/tasks/${id}/action`, data),
  upload: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', `/tasks/${id}/files`, form);
  },
  sendFile: (fileId) => request('POST', `/files/${fileId}/send`),
  assignees: () => request('GET', '/assignees'),
  team: () => request('GET', '/team'),
  member: (id) => request('GET', `/team/${id}`),
  profile: () => request('GET', '/profile'),
};
