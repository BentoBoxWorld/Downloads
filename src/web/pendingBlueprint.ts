/* Hand-off slot for a blueprint file picked up on the Blueprints page
 * before navigating to /submit.
 *
 * Two paths covered:
 *   1. SPA navigation — the JS heap is preserved, so the in-memory `pending`
 *      reference is enough.
 *   2. Discord OAuth round-trip — `/api/auth/discord/login` is a full page
 *      navigation, so we mirror the file into sessionStorage as a base64
 *      data string with a 10-minute TTL. After the redirect lands back on
 *      `/submit`, we rehydrate the File from storage.
 *
 * Storage is best-effort. If sessionStorage rejects the write (quota
 * exceeded for a near-5 MB blueprint, private browsing, etc.) we
 * silently fall back to in-memory only. */

const STORAGE_KEY = 'bb-pending-blueprint';
const TTL_MS = 10 * 60 * 1000;

interface SerializedFile {
    name: string;
    type: string;
    lastModified: number;
    base64: string;
    storedAt: number;
}

let pending: File | null = null;

export function setPendingBlueprint(file: File): void {
    pending = file;
    void persistToStorage(file);
}

export function takePendingBlueprint(): File | null {
    if (pending) {
        const out = pending;
        pending = null;
        clearStorage();
        return out;
    }
    return readFromStorage();
}

async function persistToStorage(file: File): Promise<void> {
    try {
        const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
        const idx = dataUrl.indexOf('base64,');
        if (idx < 0) return;
        const ser: SerializedFile = {
            name: file.name,
            type: file.type,
            lastModified: file.lastModified,
            base64: dataUrl.slice(idx + 'base64,'.length),
            storedAt: Date.now(),
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ser));
    } catch {
        /* sessionStorage rejected — keep the in-memory copy and move on. */
    }
}

function readFromStorage(): File | null {
    let raw: string | null;
    try {
        raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;
    clearStorage();
    let parsed: SerializedFile;
    try {
        parsed = JSON.parse(raw) as SerializedFile;
    } catch {
        return null;
    }
    if (
        !parsed ||
        typeof parsed.base64 !== 'string' ||
        typeof parsed.storedAt !== 'number' ||
        Date.now() - parsed.storedAt > TTL_MS
    ) {
        return null;
    }
    try {
        const bin = atob(parsed.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], parsed.name, {
            type: parsed.type,
            lastModified: parsed.lastModified,
        });
    } catch {
        return null;
    }
}

function clearStorage(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}
