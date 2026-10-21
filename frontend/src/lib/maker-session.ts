/**
 * Maker session storage.
 *
 * When a listing is submitted the backend hands back one edit token, scoped to
 * that listing. It is the only credential that can edit the listing, so the
 * browser keeps it and sends it back as a bearer token on PATCH. It stays in
 * this browser and travels nowhere else.
 */

export const MAKER_SESSION_KEY_PREFIX = 'whyknot:maker-session:';

/** The slice of the Web Storage API this module needs. */
export type SessionStorage = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
};

export function makerSessionKey(slug: string): string {
    return `${MAKER_SESSION_KEY_PREFIX}${slug}`;
}

function browserStorage(): SessionStorage | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
}

export function saveMakerSession(
    slug: string,
    token: string,
    storage: SessionStorage | null = browserStorage()
): void {
    if (!storage) return;
    try {
        storage.setItem(makerSessionKey(slug), token);
    } catch {
        // Private mode or a full quota: the listing still works, editing does not.
    }
}

export function readMakerSession(
    slug: string,
    storage: SessionStorage | null = browserStorage()
): string | null {
    if (!storage) return null;
    try {
        return storage.getItem(makerSessionKey(slug));
    } catch {
        return null;
    }
}
