import React, { useMemo } from 'react';

/* ── Isometric voxel preview ──────────────────────────────────────
 * Two render modes share the same iso projection and colour palette:
 *
 *   <VoxelStack topBlocks=… />          synthetic 3-cube island/tower/pad
 *                                       (used by the gallery cards on
 *                                       /blueprints when there's no
 *                                       per-position data).
 *
 *   <BlueprintVoxels voxels=… />        real voxels parsed from a
 *                                       blueprint file (used by the
 *                                       live preview on /submit).
 *
 * The iso camera sits at +X +Y −Z and looks toward origin, so every
 * cube exposes three faces: +X (right), +Y (top), −Z (front-left).
 * Anything fully behind those three neighbours is invisible from
 * this camera and gets culled.
 * ──────────────────────────────────────────────────────────────── */

export type BlockColor = { top: string; side: string; edge: string } | null;
export type Variant = 'tower' | 'pad' | 'island';

export interface TopBlock {
    material: string;
    count: number;
}

/* ── Material → colour table ──────────────────────────────────────
 * Hand-curated for the materials most likely to show up in a starter
 * island. Anything unmapped falls through to a hash-derived HSL so
 * unknown blocks at least get a stable, distinguishable colour. */

const BLOCK_COLORS: Record<string, BlockColor> = {
    /* Air variants — render nothing. */
    air: null,
    cave_air: null,
    void_air: null,

    /* Stone family */
    stone: { top: '#9a9a9a', side: '#727272', edge: '#3a3a3a' },
    cobblestone: { top: '#878787', side: '#666', edge: '#2f2f2f' },
    mossy_cobblestone: { top: '#7c8e6e', side: '#5d6c52', edge: '#2c3528' },
    smooth_stone: { top: '#a0a0a0', side: '#7a7a7a', edge: '#3e3e3e' },
    stone_bricks: { top: '#92928f', side: '#6f6f6c', edge: '#3a3a38' },
    mossy_stone_bricks: { top: '#7e8a72', side: '#5e6856', edge: '#2e3329' },
    cracked_stone_bricks: { top: '#88887d', side: '#65655d', edge: '#33332e' },
    chiseled_stone_bricks: { top: '#888884', side: '#646461', edge: '#33312f' },
    andesite: { top: '#7e7e7e', side: '#5d5d5d', edge: '#2e2e2e' },
    polished_andesite: { top: '#878787', side: '#666666', edge: '#333333' },
    granite: { top: '#9b6b54', side: '#73503e', edge: '#3a281f' },
    polished_granite: { top: '#a87662', side: '#7d5747', edge: '#3e2c23' },
    diorite: { top: '#cdcdce', side: '#a4a4a5', edge: '#525252' },
    polished_diorite: { top: '#dadadc', side: '#b1b1b3', edge: '#585859' },
    deepslate: { top: '#494a4d', side: '#37383b', edge: '#1a1b1d' },
    cobbled_deepslate: { top: '#535355', side: '#3d3e40', edge: '#1d1d1f' },
    polished_deepslate: { top: '#3f4042', side: '#2e2f31', edge: '#161617' },
    deepslate_bricks: { top: '#46484b', side: '#34363a', edge: '#1a1b1d' },
    deepslate_tiles: { top: '#3d3f43', side: '#2c2e32', edge: '#15161a' },
    chiseled_deepslate: { top: '#3a3c3f', side: '#2a2b2e', edge: '#141517' },
    tuff: { top: '#6f6d65', side: '#4f4d47', edge: '#1f1e1a' },
    tuff_bricks: { top: '#7e7c74', side: '#5d5b54', edge: '#26241f' },
    calcite: { top: '#dcdcd5', side: '#b3b3ad', edge: '#595956' },
    dripstone_block: { top: '#876e58', side: '#65523f', edge: '#322a20' },
    bedrock: { top: '#535353', side: '#3d3d3d', edge: '#1d1d1d' },
    obsidian: { top: '#1f1733', side: '#150d24', edge: '#06030d' },
    crying_obsidian: { top: '#22134b', side: '#170c33', edge: '#08041a' },

    /* Dirt family */
    dirt: { top: '#8a6a3d', side: '#6b4f2a', edge: '#332210' },
    coarse_dirt: { top: '#6f5028', side: '#523a1c', edge: '#27170a' },
    rooted_dirt: { top: '#8d6e4a', side: '#6c5234', edge: '#36281a' },
    podzol: { top: '#574019', side: '#3e2c10', edge: '#1c1308' },
    mycelium: { top: '#6f5b67', side: '#534350', edge: '#262026' },
    grass_block: { top: '#7bbf5b', side: '#8a6a3d', edge: '#3a2c19' },
    grass_path: { top: '#a08c50', side: '#6c5827', edge: '#34281a' },
    dirt_path: { top: '#a08c50', side: '#6c5827', edge: '#34281a' },
    farmland: { top: '#5a3d20', side: '#3f2913', edge: '#1c130a' },
    moss_block: { top: '#5e7a35', side: '#465b27', edge: '#212d12' },
    mud: { top: '#3a302b', side: '#2a221e', edge: '#13100e' },
    mud_bricks: { top: '#7e6649', side: '#5f4d36', edge: '#2d2419' },
    packed_mud: { top: '#876d52', side: '#67533f', edge: '#332620' },

    /* Sand / sandstone */
    sand: { top: '#e8d49e', side: '#c9b074', edge: '#7a6a40' },
    red_sand: { top: '#c97a3e', side: '#9c5a2a', edge: '#542d12' },
    sandstone: { top: '#dfd1a0', side: '#beae84', edge: '#5e5640' },
    smooth_sandstone: { top: '#e6d8a8', side: '#c5b78c', edge: '#605841' },
    chiseled_sandstone: { top: '#d9c997', side: '#b8a87f', edge: '#5b533f' },
    red_sandstone: { top: '#b65d2a', side: '#8d4520', edge: '#46220f' },
    smooth_red_sandstone: { top: '#bf6531', side: '#964c25', edge: '#4a2412' },
    terracotta: { top: '#9b4d31', side: '#763a25', edge: '#391c12' },

    /* Wood — logs / planks / leaves per species */
    oak_log: { top: '#6b5230', side: '#b18a4f', edge: '#3a2a17' },
    oak_planks: { top: '#caa26b', side: '#a07f4f', edge: '#5a4422' },
    oak_leaves: { top: '#5e8d3c', side: '#446c2a', edge: '#1f3414' },
    birch_log: { top: '#dad2bf', side: '#a59b87', edge: '#525047' },
    birch_planks: { top: '#d6c79a', side: '#a99c75', edge: '#54513a' },
    birch_leaves: { top: '#a8c47b', side: '#7a9858', edge: '#3a4a25' },
    spruce_log: { top: '#3a2615', side: '#675138', edge: '#1a1208' },
    spruce_planks: { top: '#7a5a39', side: '#5b4429', edge: '#2c2014' },
    spruce_leaves: { top: '#3e6a3a', side: '#2a4f2a', edge: '#13241a' },
    jungle_log: { top: '#553e1f', side: '#a37840', edge: '#2c1f10' },
    jungle_planks: { top: '#b08458', side: '#83613f', edge: '#3f2e1c' },
    jungle_leaves: { top: '#5a9a3a', side: '#3e6e25', edge: '#1a3010' },
    dark_oak_log: { top: '#3b2916', side: '#5b3e21', edge: '#1a110a' },
    dark_oak_planks: { top: '#503423', side: '#3b271a', edge: '#1c120c' },
    dark_oak_leaves: { top: '#36573a', side: '#284128', edge: '#121d12' },
    acacia_log: { top: '#6e6155', side: '#b56b3a', edge: '#2f261d' },
    acacia_planks: { top: '#a55a2b', side: '#7d4321', edge: '#3a1f10' },
    acacia_leaves: { top: '#7fa15a', side: '#a08e3d', edge: '#3a3416' },
    cherry_log: { top: '#7a3a4f', side: '#a25668', edge: '#3a1822' },
    cherry_planks: { top: '#e8b3aa', side: '#bb8983', edge: '#5b403d' },
    cherry_leaves: { top: '#f4b6c8', side: '#d98aa3', edge: '#7a3a4f' },
    mangrove_log: { top: '#5a3324', side: '#783f24', edge: '#2c1a10' },
    mangrove_planks: { top: '#80322a', side: '#5e2520', edge: '#2d1310' },
    mangrove_leaves: { top: '#5b8c34', side: '#406527', edge: '#1d2e11' },
    azalea_leaves: { top: '#6f9a4a', side: '#4f7335', edge: '#243617' },
    flowering_azalea_leaves: { top: '#bd6f8a', side: '#85546a', edge: '#3e2731' },
    bamboo: { top: '#7d973a', side: '#5d722b', edge: '#2a3614' },
    bamboo_block: { top: '#aab43e', side: '#828a30', edge: '#3a3e16' },
    bamboo_planks: { top: '#c0b66f', side: '#928a52', edge: '#403d24' },

    /* Water + ice */
    water: { top: '#3b6fb0', side: '#284a78', edge: '#0f2342' },
    blue_ice: { top: '#a8d6ee', side: '#7ab0d4', edge: '#2c5775' },
    ice: { top: '#c8e3f4', side: '#90b5cf', edge: '#3d6280' },
    packed_ice: { top: '#9bbed8', side: '#7295ad', edge: '#2c485b' },
    snow: { top: '#f3f7fa', side: '#cfd8dc', edge: '#5a6470' },
    snow_block: { top: '#f3f7fa', side: '#cfd8dc', edge: '#5a6470' },
    powder_snow: { top: '#f7fafc', side: '#dde2e5', edge: '#7c878d' },

    /* Lava / nether */
    lava: { top: '#ff8a2a', side: '#cf5d10', edge: '#5a2407' },
    netherrack: { top: '#7a2c2c', side: '#561c1c', edge: '#220707' },
    soul_sand: { top: '#5a4530', side: '#43331f', edge: '#1f1810' },
    soul_soil: { top: '#5b4233', side: '#403028', edge: '#1d1610' },
    basalt: { top: '#4d4a52', side: '#373640', edge: '#1a1920' },
    smooth_basalt: { top: '#46434b', side: '#312f37', edge: '#16151a' },
    blackstone: { top: '#2c272c', side: '#1f1c20', edge: '#0d0c0e' },
    polished_blackstone: { top: '#33303a', side: '#23212a', edge: '#0f0e12' },
    magma_block: { top: '#a04a1f', side: '#7a371a', edge: '#3a190b' },
    glowstone: { top: '#f4c167', side: '#c89745', edge: '#5e4421' },
    shroomlight: { top: '#fab564', side: '#c98748', edge: '#5e3e1f' },
    nether_brick: { top: '#2e1622', side: '#220f1a', edge: '#0e060c' },
    red_nether_brick: { top: '#421217', side: '#2e0c10', edge: '#150508' },
    nether_wart_block: { top: '#76090c', side: '#570708', edge: '#270304' },
    crimson_log: { top: '#5d2148', side: '#7a3a47', edge: '#2a1322' },
    crimson_planks: { top: '#6b2a3d', side: '#4f1f2c', edge: '#260e15' },
    warped_log: { top: '#3a4d4a', side: '#286863', edge: '#11231f' },
    warped_planks: { top: '#356765', side: '#264a48', edge: '#10211f' },

    /* End */
    end_stone: { top: '#e3df9a', side: '#bdb87b', edge: '#6e6a3e' },
    end_stone_bricks: { top: '#cdc983', side: '#a09c5d', edge: '#52502a' },
    purpur_block: { top: '#a07ca0', side: '#7d5e7d', edge: '#3a2c3a' },
    purpur_pillar: { top: '#aa86aa', side: '#856585', edge: '#3e303e' },
    chorus_plant: { top: '#6a3a7a', side: '#46224f', edge: '#1a0a25' },
    chorus_flower: { top: '#a37cb6', side: '#6a3a7a', edge: '#2c0f3d' },

    /* Prismarine / sea */
    prismarine: { top: '#5fa193', side: '#3e7468', edge: '#143830' },
    prismarine_bricks: { top: '#5fb09e', side: '#418273', edge: '#1c3e34' },
    dark_prismarine: { top: '#284f43', side: '#1d3a31', edge: '#0a1814' },
    sea_lantern: { top: '#dbeae0', side: '#a8c4b6', edge: '#4f6a60' },

    /* Crystals */
    amethyst_block: { top: '#9f7fd6', side: '#7a5fa7', edge: '#382a4e' },
    budding_amethyst: { top: '#a987d8', side: '#7e64ab', edge: '#3a2b51' },

    /* Ores */
    coal_ore: { top: '#666666', side: '#3e3e3e', edge: '#171717' },
    iron_ore: { top: '#9d8773', side: '#736357', edge: '#352d27' },
    copper_ore: { top: '#a06b51', side: '#7c5039', edge: '#39241a' },
    gold_ore: { top: '#a48a37', side: '#7d6a2c', edge: '#3a3015' },
    redstone_ore: { top: '#9d4f4f', side: '#7d3838', edge: '#371717' },
    lapis_ore: { top: '#5e6e8c', side: '#414e6a', edge: '#1c2230' },
    diamond_ore: { top: '#7aa9b3', side: '#587b85', edge: '#28383d' },
    emerald_ore: { top: '#6b9f6f', side: '#4a754f', edge: '#1f3322' },
    nether_quartz_ore: { top: '#7d4d49', side: '#5d3935', edge: '#2c1a18' },
    deepslate_coal_ore: { top: '#3d3f42', side: '#2c2e30', edge: '#141517' },
    deepslate_iron_ore: { top: '#65615d', side: '#48453f', edge: '#22201d' },
    deepslate_gold_ore: { top: '#7c6c3a', side: '#5b4e2a', edge: '#2a2412' },
    deepslate_diamond_ore: { top: '#5b8a8e', side: '#436667', edge: '#1f3133' },
    deepslate_redstone_ore: { top: '#6b3d3d', side: '#4d2929', edge: '#231111' },
    deepslate_lapis_ore: { top: '#454f5e', side: '#323a45', edge: '#171a1f' },
    deepslate_emerald_ore: { top: '#3f6047', side: '#2c4633', edge: '#142016' },
    deepslate_copper_ore: { top: '#7e6151', side: '#5d473b', edge: '#2b211c' },

    /* Mineral blocks */
    iron_block: { top: '#dcdcdc', side: '#aaaaaa', edge: '#555555' },
    gold_block: { top: '#fbe24a', side: '#caab35', edge: '#665418' },
    diamond_block: { top: '#5cdbd5', side: '#3da2a0', edge: '#1a4848' },
    copper_block: { top: '#c47a52', side: '#9b5d3c', edge: '#48291a' },
    oxidized_copper: { top: '#5fb18d', side: '#458768', edge: '#1c4031' },
    weathered_copper: { top: '#7da77b', side: '#5d7e5b', edge: '#2c3a2a' },
    exposed_copper: { top: '#aa8261', side: '#82624a', edge: '#3c2d22' },
    emerald_block: { top: '#3ec27a', side: '#2c8e57', edge: '#114328' },
    lapis_block: { top: '#1c45a3', side: '#143177', edge: '#081633' },
    redstone_block: { top: '#aa1717', side: '#7e1010', edge: '#380707' },
    quartz_block: { top: '#ece5d6', side: '#c2bba9', edge: '#605a4f' },
    smooth_quartz: { top: '#ece6d4', side: '#c4bdaa', edge: '#605a4d' },
    quartz_pillar: { top: '#e8e1d0', side: '#bcb4a3', edge: '#5a544a' },

    /* Decorative */
    bricks: { top: '#9a4a3a', side: '#74362b', edge: '#371912' },
    pumpkin: { top: '#c2731e', side: '#945616', edge: '#41260a' },
    carved_pumpkin: { top: '#c2731e', side: '#945616', edge: '#41260a' },
    jack_o_lantern: { top: '#cf8326', side: '#9c651b', edge: '#46290a' },
    melon: { top: '#94a832', side: '#5f7d24', edge: '#26380e' },
    hay_block: { top: '#a5821b', side: '#896b15', edge: '#3c2f08' },
    honeycomb_block: { top: '#dba23a', side: '#a87a25', edge: '#4d3710' },
    honey_block: { top: '#fbb738', side: '#cb8e21', edge: '#603f0c' },

    /* Glass — slight blue-grey tint, suffix-stripping handles colours */
    glass: { top: '#e2eaf0', side: '#bcc5cc', edge: '#5d6266' },

    /* Plants kept fairly minimal — most are single-block decoration */
    sugar_cane: { top: '#7fc14a', side: '#5d8e2f', edge: '#2c4313' },
    kelp: { top: '#3a7028', side: '#28501e', edge: '#0e210b' },
    seagrass: { top: '#37852e', side: '#296422', edge: '#102a0e' },
    lily_pad: { top: '#208a36', side: '#15672a', edge: '#082c12' },
    vine: { top: '#3f6c2b', side: '#2d4f1f', edge: '#11200d' },

    /* Wool — common colour set, suffix variants land here */
    white_wool: { top: '#e9ecec', side: '#bdc0c0', edge: '#5e6060' },
    light_gray_wool: { top: '#9b9b95', side: '#777771', edge: '#3a3a37' },
    gray_wool: { top: '#48474b', side: '#343438', edge: '#19191c' },
    black_wool: { top: '#1d1c20', side: '#161518', edge: '#0a0a0c' },
    red_wool: { top: '#a02b21', side: '#791f17', edge: '#37100a' },
    orange_wool: { top: '#ea7d18', side: '#b95e10', edge: '#562b07' },
    yellow_wool: { top: '#e8c637', side: '#b89a26', edge: '#544612' },
    lime_wool: { top: '#70b91c', side: '#558e15', edge: '#283f08' },
    green_wool: { top: '#566b1d', side: '#3f4f15', edge: '#1c2308' },
    cyan_wool: { top: '#1d8189', side: '#155f64', edge: '#082a2d' },
    light_blue_wool: { top: '#3ab2da', side: '#2884a4', edge: '#0f3949' },
    blue_wool: { top: '#2837aa', side: '#1d287d', edge: '#0a1037' },
    purple_wool: { top: '#7e2db2', side: '#5e2186', edge: '#2a0b3f' },
    magenta_wool: { top: '#bd44b5', side: '#8e3287', edge: '#3f152d' },
    pink_wool: { top: '#ec84a4', side: '#bd6481', edge: '#5a2b3a' },
    brown_wool: { top: '#7a4a26', side: '#5b371b', edge: '#2a190c' },

    /* Concrete — slightly more saturated than wool */
    white_concrete: { top: '#cfd5d6', side: '#a5abac', edge: '#525557' },
    gray_concrete: { top: '#3b3f41', side: '#2a2c2e', edge: '#131415' },
    black_concrete: { top: '#0c0e12', side: '#08090c', edge: '#040406' },
    red_concrete: { top: '#8e2020', side: '#691818', edge: '#310b0b' },
    yellow_concrete: { top: '#f0aa14', side: '#ba8410', edge: '#553c07' },
    blue_concrete: { top: '#2c3791', side: '#1f286a', edge: '#0a0e30' },
    green_concrete: { top: '#5b7c1f', side: '#445d17', edge: '#1f290a' },
};

const SUFFIXES_TO_STRIP = [
    '_slab',
    '_stairs',
    '_wall',
    '_fence_gate',
    '_fence',
    '_pressure_plate',
    '_button',
    '_trapdoor',
    '_door',
    '_sign',
];

function hashColor(material: string): BlockColor {
    let h = 5381;
    for (let i = 0; i < material.length; i++) {
        h = ((h << 5) + h + material.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(h) % 360;
    return {
        top: `hsl(${hue} 28% 60%)`,
        side: `hsl(${hue} 30% 44%)`,
        edge: `hsl(${hue} 32% 22%)`,
    };
}

export function colorFor(material: string): BlockColor {
    const m = (material || '').replace(/^minecraft:/, '').toLowerCase();
    if (m in BLOCK_COLORS) return BLOCK_COLORS[m];
    /* Slabs / stairs / walls / etc. inherit their base block's colour. */
    for (const suffix of SUFFIXES_TO_STRIP) {
        if (m.endsWith(suffix)) {
            const base = m.slice(0, -suffix.length);
            if (base in BLOCK_COLORS) return BLOCK_COLORS[base];
        }
    }
    /* Stained-glass variants → tinted glass colour. */
    if (m.endsWith('_stained_glass') || m.endsWith('_stained_glass_pane')) {
        return BLOCK_COLORS['glass'];
    }
    /* Wool colour variants we didn't list explicitly. */
    if (m.endsWith('_wool')) return BLOCK_COLORS['white_wool'];
    if (m.endsWith('_concrete')) return BLOCK_COLORS['gray_concrete'];
    if (m.endsWith('_terracotta')) return BLOCK_COLORS['terracotta'];
    return hashColor(m);
}

export function variantFor(dims: { x: number; y: number; z: number }): Variant {
    const { x, y, z } = dims;
    const ground = Math.max(x, z);
    if (y >= ground * 1.5 && y >= 4) return 'tower';
    if (y <= 2 && ground >= 5) return 'pad';
    return 'island';
}

function stackMaterials(topBlocks: TopBlock[] | undefined): string[] {
    const out: string[] = [];
    for (const b of topBlocks || []) {
        if (colorFor(b.material) === null) continue;
        out.push(b.material);
    }
    if (out.length === 0) return ['stone', 'dirt', 'grass_block'];
    return out;
}

/* ── Iso projection helpers ───────────────────────────────────── */

interface CubeProps {
    x: number;
    y: number;
    z: number;
    size: number;
    mat: string;
}

function IsoCube({ x, y, z, size, mat }: CubeProps): JSX.Element | null {
    const c = colorFor(mat);
    if (!c) return null;
    const sx = (x - z) * size;
    const sy = (x + z) * (size / 2) - y * size;
    const s = size;
    const h = size;
    const top = `${sx},${sy} ${sx + s},${sy + s / 2} ${sx},${sy + s} ${sx - s},${sy + s / 2}`;
    const left = `${sx - s},${sy + s / 2} ${sx - s},${sy + s / 2 + h} ${sx},${sy + s + h} ${sx},${sy + s}`;
    const right = `${sx + s},${sy + s / 2} ${sx + s},${sy + s / 2 + h} ${sx},${sy + s + h} ${sx},${sy + s}`;
    return (
        <g>
            <polygon
                points={top}
                fill={c.top}
                stroke={c.edge}
                strokeWidth="0.6"
                strokeLinejoin="round"
            />
            <polygon
                points={left}
                fill={c.side}
                stroke={c.edge}
                strokeWidth="0.6"
                strokeLinejoin="round"
            />
            <polygon
                points={right}
                fill={c.side}
                style={{ filter: 'brightness(1.12)' }}
                stroke={c.edge}
                strokeWidth="0.6"
                strokeLinejoin="round"
            />
        </g>
    );
}

/* ── VoxelStack — synthetic 3-arrangement stack ───────────────── */

export interface VoxelStackProps {
    topBlocks: TopBlock[] | undefined;
    variant?: Variant;
    width?: number;
    height?: number;
}

export default function VoxelStack({
    topBlocks,
    variant = 'island',
    width = 260,
    height = 150,
}: VoxelStackProps): JSX.Element {
    const mats = stackMaterials(topBlocks);
    const tile = Math.min(width, height) / 8;
    const cubes: { x: number; y: number; z: number; mat: string }[] = [];

    if (variant === 'tower') {
        const layers: [number, number][][] = [
            [[0, 0], [1, 0], [0, 1], [1, 1]],
            [[0, 0], [1, 0], [0, 1], [1, 1]],
            [[0, 0], [1, 0], [0, 1]],
            [[0, 0], [1, 0]],
            [[0, 0]],
        ];
        layers.forEach((coords, y) => {
            const m = mats[Math.min(y, mats.length - 1)];
            coords.forEach(([x, z]) => cubes.push({ x, y, z, mat: m }));
        });
    } else if (variant === 'pad') {
        for (let x = 0; x < 3; x++)
            for (let z = 0; z < 3; z++)
                cubes.push({ x, y: 0, z, mat: mats[0] });
        cubes.push({ x: 1, y: 1, z: 1, mat: mats[1] || mats[0] });
    } else {
        const top = mats[mats.length - 1];
        const mid = mats[Math.floor(mats.length / 2)] || top;
        const bot = mats[0] || mid;
        for (let x = 0; x < 3; x++)
            for (let z = 0; z < 3; z++)
                cubes.push({ x, y: 0, z, mat: bot });
        ([
            [1, 0],
            [0, 1],
            [1, 1],
            [2, 1],
            [1, 2],
        ] as [number, number][]).forEach(([x, z]) =>
            cubes.push({ x, y: 1, z, mat: mid }),
        );
        cubes.push({ x: 1, y: 2, z: 1, mat: top });
    }

    cubes.sort((a, b) => a.x + a.z - (b.x + b.z) || a.y - b.y);

    const xs = cubes.map((c) => (c.x - c.z) * tile);
    const ys = cubes.map((c) => (c.x + c.z) * (tile / 2) - c.y * tile);
    const minX = Math.min(...xs) - tile;
    const maxX = Math.max(...xs) + tile;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + 2 * tile;
    const tx = width / 2 - (minX + maxX) / 2;
    const ty = height / 2 - (minY + maxY) / 2;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ display: 'block' }}
        >
            <defs>
                <radialGradient id="vx-shadow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.32)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
            </defs>
            <ellipse
                cx={width / 2}
                cy={height - 14}
                rx={tile * 2.4}
                ry={tile * 0.7}
                fill="url(#vx-shadow)"
            />
            <g transform={`translate(${tx}, ${ty})`}>
                {cubes.map((c, i) => (
                    <IsoCube key={i} {...c} size={tile} />
                ))}
            </g>
        </svg>
    );
}

/* ── BlueprintVoxels — render real parsed voxels ──────────────── */

export interface RealVoxel {
    x: number;
    y: number;
    z: number;
    material: string;
}

/* Read the file's [Vector, BlockData] pairs into a flat voxel list. */
export function deriveVoxels(blocks: unknown): RealVoxel[] {
    if (!Array.isArray(blocks)) return [];
    const out: RealVoxel[] = [];
    for (const entry of blocks) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const pos = entry[0];
        if (!Array.isArray(pos) || pos.length < 3) continue;
        const data = entry[1] as { blockData?: string } | null;
        if (!data || typeof data.blockData !== 'string') continue;
        const mat = data.blockData.split('[')[0];
        const lower = mat.replace(/^minecraft:/, '').toLowerCase();
        if (lower === 'air' || lower === 'cave_air' || lower === 'void_air') continue;
        const x = Number(pos[0]);
        const y = Number(pos[1]);
        const z = Number(pos[2]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
        out.push({ x, y, z, material: mat });
    }
    return out;
}

interface PreparedVoxels {
    cubes: RealVoxel[];
    viewBox: string;
    downsampleFactor: number;
    surfaceCount: number;
    drawnCount: number;
}

const REF_TILE = 6;

/* Three-way visibility cull keyed to our fixed iso camera at +X +Y −Z.
 * A voxel is invisible if its top (+Y), right (+X) AND front (−Z)
 * neighbours are all occupied — those are the only three faces this
 * camera can see. Anything else can be discarded.
 *
 * Then, if survivors still exceed `maxCubes`, downsample by floor-
 * dividing positions until we fit. Each downsample step halves the
 * count along each axis (8× total per pass) so a single pass is
 * usually plenty, two for very large blueprints. */
function prepareVoxels(voxels: RealVoxel[], maxCubes: number): PreparedVoxels {
    if (voxels.length === 0) {
        return {
            cubes: [],
            viewBox: '0 0 1 1',
            downsampleFactor: 1,
            surfaceCount: 0,
            drawnCount: 0,
        };
    }

    /* Build occupancy set for O(1) neighbour lookups. */
    const occupied = new Set<string>();
    for (const v of voxels) occupied.add(`${v.x},${v.y},${v.z}`);

    /* Cull cubes whose three camera-facing neighbours are all occupied. */
    const visible: RealVoxel[] = [];
    for (const v of voxels) {
        const top = `${v.x},${v.y + 1},${v.z}`;
        const right = `${v.x + 1},${v.y},${v.z}`;
        const front = `${v.x},${v.y},${v.z - 1}`;
        if (occupied.has(top) && occupied.has(right) && occupied.has(front)) continue;
        visible.push(v);
    }
    const surfaceCount = visible.length;

    /* If still over budget, downsample by a power-of-2 factor. */
    let working = visible;
    let factor = 1;
    while (working.length > maxCubes && factor < 16) {
        factor *= 2;
        const seen = new Map<string, RealVoxel>();
        for (const v of visible) {
            const dx = Math.floor(v.x / factor);
            const dy = Math.floor(v.y / factor);
            const dz = Math.floor(v.z / factor);
            const k = `${dx},${dy},${dz}`;
            if (!seen.has(k)) {
                seen.set(k, { x: dx, y: dy, z: dz, material: v.material });
            }
        }
        working = [...seen.values()];
    }

    /* Painter's algorithm: smaller (x+z) first (further from camera),
     * then lower y first (lower stacked cubes drawn before higher). */
    working.sort((a, b) => a.x + a.z - (b.x + b.z) || a.y - b.y);

    /* Bounding box of the projected polygons, in screen units of REF_TILE. */
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const v of working) {
        const sx = (v.x - v.z) * REF_TILE;
        const sy = (v.x + v.z) * (REF_TILE / 2) - v.y * REF_TILE;
        if (sx - REF_TILE < minX) minX = sx - REF_TILE;
        if (sx + REF_TILE > maxX) maxX = sx + REF_TILE;
        if (sy < minY) minY = sy;
        if (sy + 2 * REF_TILE > maxY) maxY = sy + 2 * REF_TILE;
    }

    const padding = 4;
    const vbX = minX - padding;
    const vbY = minY - padding;
    const vbW = maxX - minX + padding * 2;
    const vbH = maxY - minY + padding * 2;

    return {
        cubes: working,
        viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
        downsampleFactor: factor,
        surfaceCount,
        drawnCount: working.length,
    };
}

export interface BlueprintVoxelsProps {
    voxels: RealVoxel[];
    width?: number;
    height?: number;
    maxCubes?: number;
}

export function BlueprintVoxels({
    voxels,
    width = 260,
    height = 150,
    maxCubes = 2000,
}: BlueprintVoxelsProps): JSX.Element {
    const prepared = useMemo(
        () => prepareVoxels(voxels, maxCubes),
        [voxels, maxCubes],
    );

    return (
        <svg
            width={width}
            height={height}
            viewBox={prepared.viewBox}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block' }}
        >
            {prepared.cubes.map((v, i) => (
                <IsoCube
                    key={`${v.x},${v.y},${v.z},${i}`}
                    x={v.x}
                    y={v.y}
                    z={v.z}
                    size={REF_TILE}
                    mat={v.material}
                />
            ))}
        </svg>
    );
}
