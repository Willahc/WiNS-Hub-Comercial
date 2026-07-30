import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ensureValidToken, forceTokenRefresh, getAccessToken } from '../auth';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const httpClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

httpClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const reviewMatch = typeof window !== 'undefined' ? window.location.pathname.match(/\/review\/([^\/]+)/) : null;
    if (reviewMatch) {
      const reviewToken = reviewMatch[1];
      let newUrl: string;
      if (config.url?.startsWith('/api/v1')) {
        newUrl = `/review-api/${reviewToken}${config.url}`;
      } else {
        const cleanUrl = config.url?.startsWith('/') ? config.url! : `/${config.url || ''}`;
        newUrl = `/review-api/${reviewToken}/api/v1${cleanUrl}`;
      }
      config.url = newUrl;
      config.baseURL = '';
      if (config.headers) {
        delete config.headers['Authorization'];
      }
      return config;
    }

    // Keycloak Proactive Authorization Token Interceptor with Mutex Refresh
    const isApiCall = !config.url?.startsWith('http://') && !config.url?.startsWith('https://') || config.url.includes('/api/');
    if (isApiCall) {
      const token = (await ensureValidToken()) || getAccessToken();
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Controlled 401 Retry & Error Mapping Interceptor
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { config, response } = error;
    
    if (!config) {
      return Promise.reject(error);
    }

    const anyConfig = config as any;

    // Handle HTTP 401 with a single forced token refresh and request retry
    if (response && response.status === 401 && !anyConfig._is401Retry) {
      anyConfig._is401Retry = true;
      console.warn('[HTTP Client] Recebido HTTP 401. Executando atualização forçada de token...');
      const newToken = await forceTokenRefresh();
      if (newToken) {
        if (config.headers) {
          config.headers['Authorization'] = `Bearer ${newToken}`;
        }
        return httpClient(config);
      }
    }

    // User-facing error message mapping according to specification
    if (response) {
      if (response.status === 401) {
        const msg = 'Sua sessão não pôde ser validada. Entre novamente.';
        (error as any).userMessage = msg;
        error.message = msg;
      } else if (response.status === 403) {
        const msg = 'Seu perfil não possui permissão para consultar este conteúdo.';
        (error as any).userMessage = msg;
        error.message = msg;
      } else if (response.status === 404) {
        const msg = 'Registro não encontrado na fonte consultada.';
        (error as any).userMessage = msg;
        error.message = msg;
      } else if (response.status >= 500) {
        const msg = 'Serviço temporariamente indisponível.';
        (error as any).userMessage = msg;
        error.message = msg;
      }
    } else {
      const msg = 'Serviço temporariamente indisponível.';
      (error as any).userMessage = msg;
      error.message = msg;
    }

    // Controlled transient error retries (5xx / network errors)
    anyConfig.retryCount = anyConfig.retryCount || 0;
    const isTransientError = !response || (response.status >= 500 && response.status <= 599);

    if (isTransientError && anyConfig.retryCount < 2) {
      anyConfig.retryCount += 1;
      const backoffDelay = anyConfig.retryCount * 1000;
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      return httpClient(config);
    }

    return Promise.reject(error);
  }
);
