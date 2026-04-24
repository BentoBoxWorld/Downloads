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
