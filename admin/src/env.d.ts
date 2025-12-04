/// <reference types="astro/client" />

interface Window {
  adminAPI: {
    baseURL: string;
    getToken(): string | null;
    setToken(token: string): void;
    clearToken(): void;
    isAuthenticated(): Promise<boolean>;
    fetch(endpoint: string, options?: RequestInit): Promise<Response>;
    logout(): Promise<void>;
  };
}
