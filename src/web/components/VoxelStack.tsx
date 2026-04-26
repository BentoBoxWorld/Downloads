import React from 'react';

/* ── Isometric voxel preview ──────────────────────────────────────
 * Pure SVG. Picks colours from the blueprint's topBlocks and arranges
 * them in a small isometric stack. Variant is derived from dimensions:
 *   tall (y > max(x,z))  → tower
 *   flat (y === 1)       → pad
 *   otherwise            → island (3×3 base + step + accent)
 * ──────────────────────────────────────────────────────────────── */

export type BlockColor = { top: string; side: string; edge: string } | null;

export type Variant = 'tower' | 'pad' | 'island';

export interface TopBlock {
    material: string;
    count: number;
}

const BLOCK_COLORS: Record<string, BlockColor> = {
    grass_block: { top: '#7bbf5b', side: '#8a6a3d', edge: '#3a2c19' },
    cherry_leaves: { top: '#f4b6c8', side: '#d98aa3', edge: '#7a3a4f' },
    cherry_log: { top: '#7a3a4f', side: '#a25668', edge: '#3a1822' },
    oak_log: { top: '#6b5230', side: '#b18a4f', edge: '#3a2a17' },
    oak_planks: { top: '#caa26b', side: '#a07f4f', edge: '#5a4422' },
    oak_leaves: { top: '#5e8d3c', side: '#446c2a', edge: '#1f3414' },
    acacia_leaves: { top: '#7fa15a', side: '#a08e3d', edge: '#3a3416' },
    spruce_leaves: { top: '#3e6a3a', side: '#2a4f2a', edge: '#13241a' },
    birch_leaves: { top: '#a8c47b', side: '#7a9858', edge: '#3a4a25' },
    jungle_leaves: { top: '#5a9a3a', side: '#3e6e25', edge: '#1a3010' },
    azalea_leaves: { top: '#6f9a4a', side: '#4f7335', edge: '#243617' },
    water: { top: '#3b6fb0', side: '#284a78', edge: '#0f2342' },
    sand: { top: '#e8d49e', side: '#c9b074', edge: '#7a6a40' },
    red_sand: { top: '#c97a3e', side: '#9c5a2a', edge: '#542d12' },
    dirt: { top: '#8a6a3d', side: '#6b4f2a', edge: '#332210' },
    coarse_dirt: { top: '#6f5028', side: '#523a1c', edge: '#27170a' },
    podzol: { top: '#574019', side: '#3e2c10', edge: '#1c1308' },
    stone: { top: '#9a9a9a', side: '#727272', edge: '#3a3a3a' },
    cobblestone: { top: '#878787', side: '#666', edge: '#2f2f2f' },
    end_stone: { top: '#e3df9a', side: '#bdb87b', edge: '#6e6a3e' },
    end_stone_bricks: { top: '#cdc983', side: '#a09c5d', edge: '#52502a' },
    obsidian: { top: '#1f1733', side: '#150d24', edge: '#06030d' },
    prismarine: { top: '#5fa193', side: '#3e7468', edge: '#143830' },
    sea_lantern: { top: '#dbeae0', side: '#a8c4b6', edge: '#4f6a60' },
    tuff_bricks: { top: '#7e7c74', side: '#5d5b54', edge: '#26241f' },
    tuff: { top: '#6f6d65', side: '#4f4d47', edge: '#1f1e1a' },
    chorus_plant: { top: '#6a3a7a', side: '#46224f', edge: '#1a0a25' },
    chorus_flower: { top: '#a37cb6', side: '#6a3a7a', edge: '#2c0f3d' },
    blue_ice: { top: '#a8d6ee', side: '#7ab0d4', edge: '#2c5775' },
    ice: { top: '#c8e3f4', side: '#90b5cf', edge: '#3d6280' },
    snow_block: { top: '#f3f7fa', side: '#cfd8dc', edge: '#5a6470' },
    netherrack: { top: '#7a2c2c', side: '#561c1c', edge: '#220707' },
    air: null,
    cave_air: null,
    void_air: null,
};

const DEFAULT_BLOCK: BlockColor = { top: '#7a8a76', side: '#5a6a5a', edge: '#27322a' };

export function colorFor(material: string): BlockColor {
    const m = (material || '').replace(/^minecraft:/, '').toLowerCase();
    return m in BLOCK_COLORS ? BLOCK_COLORS[m] : DEFAULT_BLOCK;
}

export function variantFor(dims: { x: number; y: number; z: number }): Variant {
    const { x, y, z } = dims;
    const ground = Math.max(x, z);
    if (y >= ground * 1.5 && y >= 4) return 'tower';
    if (y <= 2 && ground >= 5) return 'pad';
    return 'island';
}

/* Pulls the most-common-first list of materials from topBlocks, dropping air-likes. */
function stackMaterials(topBlocks: TopBlock[] | undefined): string[] {
    const out: string[] = [];
    for (const b of topBlocks || []) {
        if (colorFor(b.material) === null) continue;
        out.push(b.material);
    }
    if (out.length === 0) return ['stone', 'dirt', 'grass_block'];
    return out;
}

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
