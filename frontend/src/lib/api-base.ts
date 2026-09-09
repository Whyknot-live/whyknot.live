/**
 * WhyKnot API Base URL Resolver
 *
 * Single source of truth for resolving the backend API origin in client scripts.
 * Prioritizes import.meta.env.PUBLIC_API_BASE_URL, with local fallback for port 10000.
 */

export function resolveApiBaseUrl(): string {
    const fromEnv = (import.meta.env.PUBLIC_API_BASE_URL ?? '').trim();
    if (fromEnv) {
        return fromEnv.replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Local backend Hono dev server default port
            return 'http://localhost:10000';
        }
        return window.location.origin;
    }

    return 'https://www.whyknot.live';
}

export const getApiBaseUrl = resolveApiBaseUrl;
