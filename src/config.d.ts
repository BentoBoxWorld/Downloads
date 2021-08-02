export interface ConfigObject {
    addons: AddonsEntity[];
    presets: PresetsEntity[];
}

export interface AddonsEntity {
    name: string;
    github: github;
    ci: string;
    description: string;
    gamemode: boolean;
}

export interface PresetsEntity {
    name: string;
    description: string;
    subtext: string;
    addons: string[];
    dependencies?: string[];
    dependencyText?: string;
    color: string;
}

type github = `${string}/${string}`;

export interface AddonType {
    name: string;
    description: string;
    gamemode: boolean;
    github: github;
    version: string;
    downloads?: number;
}
