import * as fs from 'fs';
import * as path from 'path';

// ----- Catalog overlay (optional, in weblink/blueprints/catalog.json) -----

export interface CatalogOverlayEntry {
    displayName?: string;
    description?: string[];
    author?: string;
    authorLink?: string;
    tags?: string[];
    license?: string;
    image?: string;
}

export interface CatalogTag {
    color: string;
    description?: string;
}

export interface CatalogGameMode {
    displayName?: string;
    description?: string;
    color?: string;
}

export interface CatalogOverlay {
    blueprints?: Record<string, CatalogOverlayEntry>;
    bundles?: Record<string, CatalogOverlayEntry>;
    tags?: Record<string, CatalogTag>;
    gameModes?: Record<string, CatalogGameMode>;
}

// ----- Derived stats -----

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
    id: string;                // "<gameMode>/<name>"
    gameMode: string;
    name: string;              // filename stem
    displayName: string;
    description: string[];
    icon: string;
    file: string;              // relative path inside weblink/blueprints
    sizeBytes: number;
    stats: BlueprintStats;
    author?: string;
    authorLink?: string;
    tags?: string[];
    license?: string;
    image?: string;            // relative path to a PNG if overlay provided one
}

export interface BundleEntry {
    id: string;                // "<gameMode>/<uniqueId>"
    gameMode: string;
    uniqueId: string;
    displayName: string;
    description: string[];
    icon: string;
    file: string;
    blueprints: Record<string, string>;  // environment -> blueprint name
    requirePermission?: boolean;
    cost?: number;
    times?: number;
    author?: string;
    tags?: string[];
}

export interface BlueprintCatalog {
    blueprints: BlueprintEntry[];
    bundles: BundleEntry[];
    tags: Record<string, CatalogTag>;
    gameModes: Record<string, CatalogGameMode>;
    generatedAt: number;
}

// ----- ID / path safety -----

const ID_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export function parseBlueprintId(id: string): { gameMode: string; name: string } | null {
    const parts = id.split('/');
    if (parts.length !== 2) return null;
    const [gameMode, name] = parts;
    if (!ID_SEGMENT.test(gameMode) || !ID_SEGMENT.test(name)) return null;
    return { gameMode, name };
}

export function resolveBlueprintFile(blueprintsDir: string, id: string, ext: '.blueprint' | '.json'): string | null {
    const parsed = parseBlueprintId(id);
    if (!parsed) return null;
    const target = path.resolve(blueprintsDir, parsed.gameMode, parsed.name + ext);
    const root = path.resolve(blueprintsDir);
    if (!target.startsWith(root + path.sep)) return null;
    if (!fs.existsSync(target)) return null;
    return target;
}

// ----- .blueprint schema (subset) -----

type Vector = [number, number, number];
type BlueprintBlock = { blockData: string; biome?: string };
type BlueprintEntity = { type: string };
type VectorKeyedBlockMap = Array<[Vector, BlueprintBlock]>;
type VectorKeyedEntityListMap = Array<[Vector, BlueprintEntity[]]>;

interface BlueprintJson {
    name?: string;
    displayName?: string;
    icon?: string;
    description?: string[];
    xSize?: number;
    ySize?: number;
    zSize?: number;
    sink?: boolean;
    blocks?: VectorKeyedBlockMap;
    attached?: VectorKeyedBlockMap;
    entities?: VectorKeyedEntityListMap;
}

interface BundleJson {
    uniqueId?: string;
    displayName?: string;
    icon?: string;
    description?: string[];
    blueprints?: Record<string, string>;
    requirePermission?: boolean;
    slot?: number;
    times?: number;
    cost?: number;
}

function materialOf(blockData: string): string {
    const bracket = blockData.indexOf('[');
    return bracket === -1 ? blockData : blockData.substring(0, bracket);
}

function topN<T>(
    counts: Map<string, number>,
    n: number,
    factory: (key: string, count: number) => T,
): T[] {
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => factory(k, v));
}

export function computeStats(bp: BlueprintJson): BlueprintStats {
    const blocks = Array.isArray(bp.blocks) ? bp.blocks : [];
    const attached = Array.isArray(bp.attached) ? bp.attached : [];
    const entities = Array.isArray(bp.entities) ? bp.entities : [];

    const blockCounts = new Map<string, number>();
    const biomes = new Set<string>();
    let airCount = 0;

    for (const pair of blocks) {
        const block = pair[1];
        if (!block || typeof block.blockData !== 'string') continue;
        const mat = materialOf(block.blockData);
        blockCounts.set(mat, (blockCounts.get(mat) || 0) + 1);
        if (mat === 'minecraft:air' || mat === 'AIR') airCount++;
        if (block.biome) biomes.add(block.biome);
    }
    for (const pair of attached) {
        const block = pair[1];
        if (!block || typeof block.blockData !== 'string') continue;
        const mat = materialOf(block.blockData);
        blockCounts.set(mat, (blockCounts.get(mat) || 0) + 1);
        if (block.biome) biomes.add(block.biome);
    }

    const entityCounts = new Map<string, number>();
    let entityTotal = 0;
    for (const pair of entities) {
        const list = pair[1];
        if (!Array.isArray(list)) continue;
        for (const e of list) {
            if (!e || typeof e.type !== 'string') continue;
            entityCounts.set(e.type, (entityCounts.get(e.type) || 0) + 1);
            entityTotal++;
        }
    }

    return {
        dimensions: {
            x: typeof bp.xSize === 'number' ? bp.xSize : 0,
            y: typeof bp.ySize === 'number' ? bp.ySize : 0,
            z: typeof bp.zSize === 'number' ? bp.zSize : 0,
        },
        blockCount: blocks.length,
        attachedCount: attached.length,
        entityCount: entityTotal,
        airCount,
        biomes: Array.from(biomes).sort(),
        sinking: bp.sink === true,
        topBlocks: topN(blockCounts, 5, (material, count) => ({ material, count })),
        topEntities: topN(entityCounts, 5, (type, count) => ({ type, count })),
    };
}

// ----- Catalog build -----

function readOverlay(blueprintsDir: string): CatalogOverlay {
    const file = path.join(blueprintsDir, 'catalog.json');
    if (!fs.existsSync(file)) return {};
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
        console.error('[blueprints] bad catalog.json:', (err as Error).message);
        return {};
    }
}

function listGameModeDirs(blueprintsDir: string): string[] {
    if (!fs.existsSync(blueprintsDir)) return [];
    return fs
        .readdirSync(blueprintsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== 'images')
        .map((d) => d.name);
}

// Path convention: images live at blueprints/images/<gameMode>/<name>.png.
// If a sibling <name>.thumb.png exists, prefer it for catalog cards;
// otherwise use the full image. Returns the path relative to
// blueprints/images/, or undefined if no image exists for this blueprint.
function detectImage(blueprintsDir: string, gameMode: string, name: string): string | undefined {
    const imagesRoot = path.join(blueprintsDir, 'images', gameMode);
    const thumb = path.join(imagesRoot, `${name}.thumb.png`);
    if (fs.existsSync(thumb)) return path.posix.join(gameMode, `${name}.thumb.png`);
    const full = path.join(imagesRoot, `${name}.png`);
    if (fs.existsSync(full)) return path.posix.join(gameMode, `${name}.png`);
    return undefined;
}

export function buildCatalog(blueprintsDir: string): BlueprintCatalog {
    const overlay = readOverlay(blueprintsDir);
    const blueprints: BlueprintEntry[] = [];
    const bundles: BundleEntry[] = [];

    for (const gameMode of listGameModeDirs(blueprintsDir)) {
        const gmDir = path.join(blueprintsDir, gameMode);
        const files = fs.readdirSync(gmDir);
        for (const file of files) {
            const abs = path.join(gmDir, file);
            const stat = fs.statSync(abs);
            if (!stat.isFile()) continue;

            if (file.endsWith('.blueprint')) {
                try {
                    const json: BlueprintJson = JSON.parse(fs.readFileSync(abs, 'utf-8'));
                    const name = file.slice(0, -'.blueprint'.length);
                    const id = `${gameMode}/${name}`;
                    const o = overlay.blueprints?.[id] ?? {};
                    blueprints.push({
                        id,
                        gameMode,
                        name,
                        displayName: o.displayName || json.displayName || json.name || name,
                        description: o.description ?? (Array.isArray(json.description) ? json.description : []),
                        icon: json.icon || 'PAPER',
                        file: path.posix.join(gameMode, file),
                        sizeBytes: stat.size,
                        stats: computeStats(json),
                        author: o.author,
                        authorLink: o.authorLink,
                        tags: o.tags,
                        license: o.license,
                        image: o.image ?? detectImage(blueprintsDir, gameMode, name),
                    });
                } catch (err) {
                    console.error(`[blueprints] failed to parse ${abs}:`, (err as Error).message);
                }
            } else if (file.endsWith('.json') && file !== 'catalog.json') {
                try {
                    const json: BundleJson = JSON.parse(fs.readFileSync(abs, 'utf-8'));
                    if (!json.uniqueId) continue; // not a bundle
                    const uniqueId = json.uniqueId;
                    const id = `${gameMode}/${uniqueId}`;
                    const o = overlay.bundles?.[id] ?? {};
                    bundles.push({
                        id,
                        gameMode,
                        uniqueId,
                        displayName: o.displayName || json.displayName || uniqueId,
                        description: o.description ?? (Array.isArray(json.description) ? json.description : []),
                        icon: json.icon || 'PAPER',
                        file: path.posix.join(gameMode, file),
                        blueprints: json.blueprints || {},
                        requirePermission: json.requirePermission,
                        cost: json.cost,
                        times: json.times,
                        author: o.author,
                        tags: o.tags,
                    });
                } catch (err) {
                    console.error(`[blueprints] failed to parse bundle ${abs}:`, (err as Error).message);
                }
            }
        }
    }

    blueprints.sort((a, b) => a.id.localeCompare(b.id));
    bundles.sort((a, b) => a.id.localeCompare(b.id));

    return {
        blueprints,
        bundles,
        tags: overlay.tags ?? {},
        gameModes: overlay.gameModes ?? {},
        generatedAt: Date.now(),
    };
}

// ----- Submission sanitisers (Phase 2) -----
//
// These are called on user-submitted content before it is written to weblink.
// The Phase 1 read-only catalog pulls from a trusted git repo and does not
// invoke these; they exist here because the dangerous fields live in the
// schema, so the rule belongs next to the code that understands it.

const COMMAND_BLOCK_MATERIALS = new Set([
    'minecraft:command_block',
    'minecraft:chain_command_block',
    'minecraft:repeating_command_block',
    'minecraft:jigsaw',
    'minecraft:structure_block',
]);

export interface SubmissionIssue {
    field: string;
    reason: string;
}

export function sanitizeBundleSubmission(raw: unknown): { bundle: BundleJson; stripped: SubmissionIssue[] } {
    const src = (raw ?? {}) as BundleJson & { commands?: unknown };
    const stripped: SubmissionIssue[] = [];
    const bundle: BundleJson = { ...src };
    if ('commands' in bundle) {
        delete (bundle as { commands?: unknown }).commands;
        stripped.push({ field: 'commands', reason: 'Console command execution is not permitted in submissions.' });
    }
    return { bundle, stripped };
}

export function validateBlueprintSubmission(raw: unknown): { ok: boolean; issues: SubmissionIssue[] } {
    const bp = (raw ?? {}) as BlueprintJson;
    const issues: SubmissionIssue[] = [];
    const blocks = Array.isArray(bp.blocks) ? bp.blocks : [];
    const attached = Array.isArray(bp.attached) ? bp.attached : [];
    for (const list of [blocks, attached]) {
        for (const pair of list) {
            const block = pair?.[1] as BlueprintBlock & { inventory?: Record<string, unknown> } | undefined;
            if (!block) continue;
            if (typeof block.blockData === 'string') {
                const mat = materialOf(block.blockData);
                if (COMMAND_BLOCK_MATERIALS.has(mat)) {
                    issues.push({ field: 'blocks', reason: `Disallowed material: ${mat}` });
                }
            }
            // Inventories are common (chests/barrels of starter loot). Allow
            // them, but substring-scan the YAML payloads for the same
            // disallowed materials a hostile submitter might tuck inside an
            // ItemStack rather than the blockData.
            if (block.inventory && typeof block.inventory === 'object') {
                for (const slotKey of Object.keys(block.inventory)) {
                    const yaml = block.inventory[slotKey];
                    if (typeof yaml !== 'string') continue;
                    const lc = yaml.toLowerCase();
                    for (const banned of Array.from(COMMAND_BLOCK_MATERIALS)) {
                        if (lc.includes(banned)) {
                            issues.push({
                                field: `blocks.inventory[${slotKey}]`,
                                reason: `Disallowed material in stored ItemStack: ${banned}`,
                            });
                            break;
                        }
                    }
                }
            }
        }
    }
    return { ok: issues.length === 0, issues };
}
