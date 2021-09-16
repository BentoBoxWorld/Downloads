import { AddonType, PresetsEntity, ThirdParty } from '../config';
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
