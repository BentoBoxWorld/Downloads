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

export interface BlueprintStats {
    dimensions: { x: number; y: number; z: number };
    blockCount: number;
    attachedCount: number;
    entityCount: number;
    airCount: number;
    biomes: string[];
    sinking: boolean;
    topBlocks: Array<{ material: string; count: number }>;
    topEntities: Array<{ type: string; count: number }>;
}

export interface BlueprintEntry {
    id: string;
    gameMode: string;
    name: string;
    displayName: string;
    description: string[];
    icon: string;
    file: string;
    sizeBytes: number;
    stats: BlueprintStats;
    author?: string;
    authorLink?: string;
    tags?: string[];
    license?: string;
    image?: string;
}

export interface BundleEntry {
    id: string;
    gameMode: string;
    uniqueId: string;
    displayName: string;
    description: string[];
    icon: string;
    file: string;
    blueprints: Record<string, string>;
    requirePermission?: boolean;
    cost?: number;
    times?: number;
    author?: string;
    tags?: string[];
}

export interface BlueprintCatalogTag {
    color: string;
    description?: string;
}

export interface BlueprintCatalogGameMode {
    displayName?: string;
    description?: string;
    color?: string;
}

export interface BlueprintCatalog {
    blueprints: BlueprintEntry[];
    bundles: BundleEntry[];
    tags: Record<string, BlueprintCatalogTag>;
    gameModes: Record<string, BlueprintCatalogGameMode>;
    generatedAt: number;
}
