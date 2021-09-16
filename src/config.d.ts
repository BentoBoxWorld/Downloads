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
    versions?: Record<string, string>;
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
    downloads?: number;
    versions: Record<string, string>;
}

export interface ThirdParty {
    addons: Record<string, thirdPartyAddon>;
    tags: Record<string, tag>;
}

export interface thirdPartyAddon {
    Author: string;
    AuthorLink?: string;
    Releases: string;
    Github?: string;
    Issues?: string;
    Description: string;
    Tags?: string[];
}

export interface tag {
    color: string;
    description: string;
}
