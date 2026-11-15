import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname.startsWith("/admin")) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      if (window.location.pathname !== "/admin/login") {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  }
);

export const getPublicBackendUrl = () => {
  const configured = (import.meta.env.VITE_PUBLIC_BACKEND_URL || "")
    .trim()
    .replace(/\/$/, "");
  return /^https?:\/\/.+/i.test(configured) ? configured : "";
};

export default axiosClient;