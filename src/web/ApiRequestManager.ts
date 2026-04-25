import { AddonType, BlueprintCatalog, PresetsEntity, ThirdParty } from '../config';
import axios from 'axios';

export async function GetPresets(): Promise<PresetsEntity[]> {
    return (await axios.get('/api/presets')).data;
}

export async function GetAddons(): Promise<AddonType[]> {
    return (await axios.get('/api/addons')).data;
}

export async function GetThirdParty(): Promise<ThirdParty> {
    return (await axios.get('/api/thirdparty')).data;
}

export async function GetBlueprints(): Promise<BlueprintCatalog> {
    return (await axios.get('/api/blueprints')).data;
}

export function BlueprintFileUrl(id: string, type: 'blueprint' | 'bundle' = 'blueprint'): string {
    return `/api/blueprints/download?id=${encodeURIComponent(id)}&type=${type}`;
}

export function BlueprintZipUrl(ids: string[]): string {
    return `/api/blueprints/zip?ids=${encodeURIComponent(JSON.stringify(ids))}`;
}

export function BlueprintGameModeZipUrl(gameMode: string): string {
    return `/api/blueprints/zip?gameMode=${encodeURIComponent(gameMode)}`;
}

export interface SessionUser {
    id: string;
    username: string;
    globalName: string | null;
    avatarUrl: string | null;
    acceptedTermsVersion: string | null;
    csrfToken: string;
    currentTermsVersion: string;
}

export async function GetMe(): Promise<SessionUser | null> {
    try {
        const r = await axios.get('/api/me');
        return r.data;
    } catch (err) {
        const e = err as { response?: { status?: number } };
        if (e.response && e.response.status === 401) return null;
        throw err;
    }
}

export interface MySubmission {
    gameMode: string;
    name: string;
    displayName: string;
    prUrl: string;
    createdAt: number;
}

export async function GetMySubmissions(): Promise<MySubmission[]> {
    return (await axios.get('/api/me/submissions')).data;
}

export async function PostLogout(csrfToken: string): Promise<void> {
    await axios.post('/api/auth/logout', null, { headers: { 'X-Csrf-Token': csrfToken } });
}

export async function PostDeleteAccount(csrfToken: string): Promise<void> {
    await axios.post('/api/me/delete', null, { headers: { 'X-Csrf-Token': csrfToken } });
}

export interface SubmitResult {
    ok: true;
    prUrl: string;
}

export interface SubmitError {
    error: string;
    reason?: string;
    issues?: string[];
}

export async function PostSubmitBlueprint(
    csrfToken: string,
    fields: { gameMode: string; name: string; displayName: string; description: string; tags: string },
    file: File,
): Promise<SubmitResult> {
    const fd = new FormData();
    fd.append('gameMode', fields.gameMode);
    fd.append('name', fields.name);
    fd.append('displayName', fields.displayName);
    fd.append('description', fields.description);
    fd.append('tags', fields.tags);
    fd.append('acceptedTerms', 'true');
    fd.append('blueprint', file);
    const r = await axios.post('/api/blueprints/submit', fd, {
        headers: { 'X-Csrf-Token': csrfToken },
    });
    return r.data;
}
