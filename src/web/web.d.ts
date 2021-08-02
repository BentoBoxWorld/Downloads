declare module '*.png';
declare module '*.jpg';
declare module '*.svg';

export interface PremadeCardType {
    name: string;
    color: string;
    addons: string[];
    description: string;
    dependencies?: string[];
    dependencyText?: string;
    subtext: string;
}

export interface DownloadModalType {
    addons: string[];
}
