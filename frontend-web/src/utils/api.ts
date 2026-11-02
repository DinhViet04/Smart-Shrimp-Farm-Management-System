const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
let refreshRequest: Promise<string | null> | null = null;

const refreshAccessToken = () => {
  if (!refreshRequest) {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    const headers: Record<string, string> = {
      'X-SSFM-CSRF': '1',
    };
    if (storedRefreshToken) {
      headers['Content-Type'] = 'application/json';
    }

    refreshRequest = fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: storedRefreshToken ? JSON.stringify({ refreshToken: storedRefreshToken }) : undefined,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return data.accessToken as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
};

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('accessToken');
  
  // Create Headers object to manipulate headers easily
  const headers = new Headers(options.headers || {});
  
  // Set default Content-Type to application/json if not set and body is string
  if (!headers.has('Content-Type') && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fullUrl = url.startsWith('http') ? url : `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  let response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    const nextAccessToken = await refreshAccessToken();
    if (nextAccessToken) {
      headers.set('Authorization', `Bearer ${nextAccessToken}`);
      response = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      handleAuthFailure();
    }
  }

  return response;
};

const handleAuthFailure = () => {
  void fetch(`${apiUrl}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-SSFM-CSRF': '1' },
    keepalive: true,
  });
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/';
};

export const logoutSession = async () => {
  try {
    await fetch(`${apiUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-SSFM-CSRF': '1' },
    });
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }
};
