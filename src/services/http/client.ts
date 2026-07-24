import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken } from '../auth';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const httpClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Keycloak Authorization Token Interceptor
httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (config.headers) {
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Controlled Retry Interceptor
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { config } = error;
    
    if (!config) {
      return Promise.reject(error);
    }

    // Custom properties to track retries on config
    const anyConfig = config as any;
    anyConfig.retryCount = anyConfig.retryCount || 0;

    // Retry only on network errors or transient 5xx errors
    const isTransientError = 
      !error.response || 
      (error.response.status >= 500 && error.response.status <= 599);

    if (isTransientError && anyConfig.retryCount < 2) {
      anyConfig.retryCount += 1;
      const backoffDelay = anyConfig.retryCount * 1000;
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      return httpClient(config);
    }

    return Promise.reject(error);
  }
);
