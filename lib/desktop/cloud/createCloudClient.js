export function createCloudClient({ baseUrl, cookie, fetchFn = fetch }) {
  const headers = {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
  };

  async function requestJson(path, options = {}) {
    const res = await fetchFn(`${baseUrl}${path}`, {
      credentials: 'include',
      ...options,
      headers: { ...headers, ...options.headers },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(body.error || res.statusText);
      error.code = body.code;
      error.status = res.status;
      throw error;
    }
    return body;
  }

  return {
    heartbeat: async ({ deviceId }) =>
      requestJson('/api/desktop/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      }),

    pushItems: async ({ deviceId, items }) =>
      requestJson('/api/desktop/outbox', {
        method: 'POST',
        body: JSON.stringify({ deviceId, items }),
      }),

    pullSnapshot: async ({ deviceId }) =>
      requestJson(`/api/desktop/snapshot?deviceId=${encodeURIComponent(deviceId)}`),
  };
}
