import { AddonsEntity, AddonType, BlueprintCatalog, PresetsEntity, ThirdParty } from '../config';
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
    isAdmin: boolean;
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

export interface AdminUser {
    id: string;
    username: string;
    globalName: string | null;
    avatarUrl: string | null;
    createdAt: number;
    lastLoginAt: number;
}

export async function GetAdminUsers(): Promise<AdminUser[]> {
    return (await axios.get('/api/admin/users')).data;
}

export async function PostSetAdmin(
    csrfToken: string,
    discordId: string,
    isAdmin: boolean,
): Promise<void> {
    await axios.post(
        '/api/admin/users',
        { discordId, isAdmin },
        { headers: { 'X-Csrf-Token': csrfToken } },
    );
}

export async function GetAdminPresets(): Promise<PresetsEntity[]> {
    return (await axios.get('/api/admin/presets')).data;
}

export async function PutAdminPresets(
    csrfToken: string,
    presets: PresetsEntity[],
): Promise<void> {
    await axios.put('/api/admin/presets', presets, {
        headers: { 'X-Csrf-Token': csrfToken },
    });
}

export async function GetAdminAddons(): Promise<AddonsEntity[]> {
    return (await axios.get('/api/admin/addons')).data;
}

export async function PostAdminAddon(
    csrfToken: string,
    addon: AddonsEntity,
): Promise<void> {
    await axios.post('/api/admin/addons', addon, {
        headers: { 'X-Csrf-Token': csrfToken },
    });
}

export async function PutAdminAddon(
    csrfToken: string,
    name: string,
    addon: AddonsEntity,
): Promise<void> {
    await axios.put(`/api/admin/addons/${encodeURIComponent(name)}`, addon, {
        headers: { 'X-Csrf-Token': csrfToken },
    });
}

export async function DeleteAdminAddon(csrfToken: string, name: string): Promise<void> {
    await axios.delete(`/api/admin/addons/${encodeURIComponent(name)}`, {
        headers: { 'X-Csrf-Token': csrfToken },
    });
}

export type AdminScope = 'addons' | 'presets';

export interface AdminOverride {
    scope: AdminScope;
    updatedBy: string;
    updatedByName: string | null;
    updatedAt: number;
}

export interface AdminAudit {
    id: number;
    scope: string;
    userId: string;
    username: string | null;
    at: number;
    summary: string;
}

export async function GetAdminOverrides(): Promise<AdminOverride[]> {
    return (await axios.get('/api/admin/overrides')).data;
}

export async function GetAdminAudits(): Promise<AdminAudit[]> {
    return (await axios.get('/api/admin/audits')).data;
}

export async function DeleteAdminOverride(
    csrfToken: string,
    scope: AdminScope,
): Promise<void> {
    await axios.delete(`/api/admin/overrides/${encodeURIComponent(scope)}`, {
        headers: { 'X-Csrf-Token': csrfToken },
    });
}

export async function PostAdminPr(csrfToken: string): Promise<{ ok: true; prUrl: string }> {
    const r = await axios.post('/api/admin/pr', null, {
        headers: { 'X-Csrf-Token': csrfToken },
    });
    return r.data;
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
