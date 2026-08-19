const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  let response = await fetch(fullUrl, { ...options, headers });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${apiUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          // Save new tokens
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
          
          // Retry the original request with new token
          headers.set('Authorization', `Bearer ${data.accessToken}`);
          response = await fetch(url, { ...options, headers });
        } else {
          // Refresh failed (token expired or invalid)
          handleAuthFailure();
        }
      } catch {
        // Network error during refresh
        handleAuthFailure();
      }
    } else {
      // No refresh token available
      handleAuthFailure();
    }
  }

  return response;
};

const handleAuthFailure = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/';
};
