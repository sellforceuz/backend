export const API_URL = "https://backend-production-49e4.up.railway.app";

export function useApi() {
  const getToken = () => localStorage.getItem("accessToken");
  const getRefresh = () => localStorage.getItem("refreshToken");

  async function request(method, path, body, retry = true) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };
    const res = await fetch(API_URL + path, opts);
    if (res.status === 401 && retry && getRefresh()) {
      const r = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: getRefresh() }),
      });
      if (r.ok) {
        const data = await r.json();
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        return request(method, path, body, false);
      }
      localStorage.clear();
      window.location.reload();
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка сервера");
    return data;
  }

  return {
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b),
    put: (p, b) => request("PUT", p, b),
    patch: (p, b) => request("PATCH", p, b),
    del: (p) => request("DELETE", p),
  };
}
