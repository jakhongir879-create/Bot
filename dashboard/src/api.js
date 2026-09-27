const TOKEN_KEY = 'bd_token';

export const auth = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

async function request(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/auth/login')) {
    auth.clear();
    window.dispatchEvent(new Event('logout'));
  }
  if (!res.ok) throw new Error(data.message || 'Xatolik yuz berdi');
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
};

export function periodQuery({ period, from, to }) {
  const q = new URLSearchParams({ period });
  if (period === 'custom') {
    if (from) q.set('from', from);
    if (to) q.set('to', to);
  }
  return q.toString();
}

export async function downloadExcel(p) {
  const res = await fetch(`/api/reports/export?${periodQuery(p)}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!res.ok) throw new Error('Yuklab bo\'lmadi');
  const blob = await res.blob();
  const name = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || 'hisobot.xlsx';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
