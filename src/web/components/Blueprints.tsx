import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDownload,
    faSearch,
    faArrowDown,
    faTimes,
    faLayerGroup,
    faUpload,
} from '@fortawesome/free-solid-svg-icons';
import {
    BlueprintCatalog,
    BlueprintCatalogGameMode,
    BlueprintEntry,
} from '../../config';
import {
    BlueprintFileUrl,
    BlueprintGameModeZipUrl,
    BlueprintZipUrl,
} from '../ApiRequestManager';

/* ── Isometric voxel preview ──────────────────────────────────────
 * Pure SVG. Picks colours from the blueprint's topBlocks and arranges
 * them in a small isometric stack. Variant is derived from dimensions:
 *   tall (y > max(x,z))  → tower
 *   flat (y === 1)       → pad
 *   otherwise            → island (3×3 base + step + accent)
 * ──────────────────────────────────────────────────────────────── */

type BlockColor = { top: string; side: string; edge: string } | null;

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

function colorFor(material: string): BlockColor {
    const m = (material || '').replace(/^minecraft:/, '').toLowerCase();
    return m in BLOCK_COLORS ? BLOCK_COLORS[m] : DEFAULT_BLOCK;
}

function variantFor(stats: BlueprintEntry['stats']): 'tower' | 'pad' | 'island' {
    const { x, y, z } = stats.dimensions;
    const ground = Math.max(x, z);
    if (y >= ground * 1.5 && y >= 4) return 'tower';
    if (y <= 2 && ground >= 5) return 'pad';
    return 'island';
}

/* Pulls the most-common-first list of materials from topBlocks, dropping air-likes. */
function stackMaterials(topBlocks: BlueprintEntry['stats']['topBlocks']): string[] {
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

function VoxelStack({
    topBlocks,
    variant = 'island',
    width = 260,
    height = 150,
}: {
    topBlocks: BlueprintEntry['stats']['topBlocks'];
    variant?: 'tower' | 'pad' | 'island';
    width?: number;
    height?: number;
}): JSX.Element {
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

function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function shortMaterial(mat: string): string {
    return (mat || '').replace(/^minecraft:/, '').replace(/_/g, ' ');
}

/* "X minutes ago" — based on `generatedAt` (unix ms) from the catalog. */
function timeAgo(ms: number): string {
    const diff = Date.now() - ms;
    if (diff < 60_000) return 'just now';
    const m = Math.round(diff / 60_000);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} d ago`;
}

function BlueprintCard({
    bp,
    gameModeInfo,
    selected,
    onToggle,
    expanded,
    onHover,
    tagColors,
}: {
    bp: BlueprintEntry;
    gameModeInfo?: BlueprintCatalogGameMode;
    selected: boolean;
    onToggle: () => void;
    expanded: boolean;
    onHover: (id: string | null) => void;
    tagColors: Record<string, string>;
}) {
    const gameModeLabel = gameModeInfo?.displayName || bp.gameMode;
    const dims = `${bp.stats.dimensions.x} × ${bp.stats.dimensions.y} × ${bp.stats.dimensions.z}`;

    return (
        <article
            onMouseEnter={() => onHover(bp.id)}
            onMouseLeave={() => onHover(null)}
            style={{
                position: 'relative',
                background: '#0c2038',
                border: `1px solid ${selected ? 'var(--bp-accent)' : 'var(--bp-line)'}`,
                borderRadius: 14,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                transform: expanded ? 'translateY(-2px)' : 'none',
                boxShadow: expanded ? '0 18px 40px -16px rgba(0,0,0,0.6)' : 'none',
            }}
        >
            {/* Image / placeholder area */}
            <div
                style={{
                    position: 'relative',
                    height: 168,
                    background:
                        'radial-gradient(600px 200px at 30% 0%, rgba(127,179,204,0.10), transparent 60%), #0a1d33',
                }}
            >
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage:
                            'linear-gradient(var(--bp-line) 1px, transparent 1px), linear-gradient(90deg, var(--bp-line) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        WebkitMaskImage:
                            'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15))',
                        maskImage:
                            'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15))',
                    }}
                />

                {/* Top row: select + dimensions */}
                <div
                    style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        right: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        zIndex: 2,
                    }}
                >
                    <label
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: 'rgba(10,29,51,0.85)',
                            border: '1px solid var(--bp-line)',
                            fontSize: 11,
                            fontFamily: 'var(--bb-mono)',
                            color: 'var(--bp-ink)',
                            cursor: 'pointer',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={onToggle}
                            style={{ accentColor: 'var(--bp-accent)' }}
                        />
                        Select
                    </label>
                    <span className="bp-chip">{dims}</span>
                </div>

                {bp.stats.sinking && (
                    <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 2 }}>
                        <span className="bp-chip" style={{ color: '#a8d6ee' }}>
                            <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 9 }} /> Sinking
                        </span>
                    </div>
                )}

                {/* Image override if curator supplied one, else CSS-only voxel preview. */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        zIndex: 1,
                    }}
                >
                    {bp.image ? (
                        <img
                            src={`/blueprints/images/${bp.image}`}
                            alt={bp.displayName}
                            style={{
                                maxWidth: '85%',
                                maxHeight: 140,
                                borderRadius: 8,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            }}
                        />
                    ) : (
                        <VoxelStack
                            topBlocks={bp.stats.topBlocks}
                            variant={variantFor(bp.stats)}
                            width={260}
                            height={150}
                        />
                    )}
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: 16, color: 'var(--bp-ink)' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 8,
                    }}
                >
                    <div
                        style={{
                            fontFamily: 'var(--bb-display)',
                            fontSize: 18,
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            color: '#fff',
                        }}
                    >
                        {bp.displayName}
                    </div>
                    <a
                        href={BlueprintFileUrl(bp.id)}
                        title={`Download ${bp.displayName}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--bp-ink-soft)', display: 'inline-flex' }}
                    >
                        <FontAwesomeIcon icon={faDownload} style={{ fontSize: 14 }} />
                    </a>
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: 'var(--bp-ink-soft)',
                        marginTop: 2,
                        fontFamily: 'var(--bb-mono)',
                    }}
                >
                    {gameModeLabel}
                    {bp.author ? (
                        <>
                            {' · '}
                            {bp.authorLink ? (
                                <a
                                    href={bp.authorLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--bp-ink-soft)' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {bp.author}
                                </a>
                            ) : (
                                bp.author
                            )}
                        </>
                    ) : null}
                </div>

                {bp.description.length > 0 && (
                    <p
                        style={{
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: 'var(--bp-ink)',
                            margin: '10px 0 0',
                            opacity: 0.92,
                        }}
                    >
                        {bp.description.join(' ')}
                    </p>
                )}

                {/* Quick-stat strip */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid var(--bp-line)',
                    }}
                >
                    <Stat label="Blocks" value={bp.stats.blockCount.toLocaleString()} />
                    <Stat label="Entities" value={bp.stats.entityCount.toString()} />
                    <Stat label="File" value={humanSize(bp.sizeBytes)} />
                </div>

                {/* Hover-expanded detail */}
                {expanded && (
                    <div
                        style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: '1px solid var(--bp-line)',
                            animation: 'bpFade 0.15s ease',
                        }}
                    >
                        {bp.stats.topBlocks.length > 0 && (
                            <>
                                <SectionLabel>Top blocks</SectionLabel>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 4,
                                        marginBottom: 10,
                                    }}
                                >
                                    {bp.stats.topBlocks.slice(0, 5).map((b) => (
                                        <span key={b.material} className="bp-chip">
                                            {shortMaterial(b.material)} × {b.count}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                        {bp.stats.topEntities.length > 0 && (
                            <>
                                <SectionLabel>Entities</SectionLabel>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 4,
                                        marginBottom: 10,
                                    }}
                                >
                                    {bp.stats.topEntities.map((e) => (
                                        <span
                                            key={e.type}
                                            className="bp-chip"
                                            style={{
                                                background: 'rgba(165, 124, 200, 0.18)',
                                                color: '#d6c0eb',
                                            }}
                                        >
                                            {shortMaterial(e.type)} × {e.count}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                        {bp.stats.biomes.length > 0 && (
                            <>
                                <SectionLabel>Biomes</SectionLabel>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {bp.stats.biomes.map((b) => (
                                        <span key={b} className="bp-chip solid">
                                            {shortMaterial(b)}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Tags + license */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 14,
                        gap: 8,
                    }}
                >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(bp.tags || []).sort().map((t) => (
                            <span
                                key={t}
                                style={{
                                    fontSize: 10,
                                    fontFamily: 'var(--bb-mono)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    padding: '2px 6px',
                                    borderRadius: 3,
                                    background: tagColors[t] || '#3a4a5a',
                                    color: '#fff',
                                }}
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                    {bp.license && (
                        <span
                            style={{
                                fontSize: 10,
                                color: 'var(--bp-ink-soft)',
                                fontFamily: 'var(--bb-mono)',
                            }}
                        >
                            {bp.license}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div
                style={{
                    fontSize: 10,
                    color: 'var(--bp-ink-soft)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontFamily: 'var(--bb-mono)',
                    fontSize: 13,
                    color: '#fff',
                }}
            >
                {value}
            </div>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                color: 'var(--bp-ink-soft)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
            }}
        >
            {children}
        </div>
    );
}

function UploadCard(): JSX.Element {
    const [drag, setDrag] = useState(false);
    return (
        <Link
            to="/submit"
            onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
            }}
            style={{
                position: 'relative',
                borderRadius: 14,
                background: drag ? 'rgba(127,179,204,0.10)' : 'rgba(10, 29, 51, 0.55)',
                border: `1.5px dashed ${drag ? 'var(--bp-accent)' : 'var(--bp-line-strong)'}`,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: 380,
                color: 'var(--bp-ink)',
                textDecoration: 'none',
                transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
        >
            <div
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: 'rgba(127,179,204,0.10)',
                    border: '1px solid var(--bp-line-strong)',
                    display: 'grid',
                    placeItems: 'center',
                    marginBottom: 14,
                }}
            >
                <FontAwesomeIcon
                    icon={faUpload}
                    style={{ fontSize: 22, color: 'var(--bp-ink)' }}
                />
            </div>
            <div
                style={{
                    fontFamily: 'var(--bb-display)',
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#fff',
                    letterSpacing: '-0.01em',
                }}
            >
                Submit your blueprint
            </div>
            <div
                style={{
                    fontSize: 13,
                    color: 'var(--bp-ink-soft)',
                    marginTop: 6,
                    lineHeight: 1.5,
                    maxWidth: 240,
                }}
            >
                Drop a{' '}
                <code
                    style={{
                        fontFamily: 'var(--bb-mono)',
                        background: 'rgba(127,179,204,0.10)',
                        padding: '1px 4px',
                        borderRadius: 3,
                    }}
                >
                    .blueprint
                </code>{' '}
                file here. We&rsquo;ll parse it, you fill in the metadata, and we open a PR for
                review.
            </div>
            <span
                className="bb-btn bb-btn-paper"
                style={{
                    marginTop: 16,
                    padding: '10px 16px',
                    fontSize: 13,
                    pointerEvents: 'none',
                }}
            >
                <FontAwesomeIcon icon={faUpload} style={{ fontSize: 12 }} />
                Choose file
            </span>
            <div
                style={{
                    fontSize: 11,
                    color: 'var(--bp-ink-soft)',
                    marginTop: 10,
                    fontFamily: 'var(--bb-mono)',
                }}
            >
                max 5 MB · sign in with Discord
            </div>
        </Link>
    );
}

function ToggleChip({
    active,
    onClick,
    swatch,
    children,
}: {
    active: boolean;
    onClick: () => void;
    swatch?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                border: `1px solid ${active ? 'var(--bp-accent)' : 'var(--bp-line)'}`,
                background: active ? 'rgba(127,179,204,0.16)' : 'rgba(10,29,51,0.5)',
                color: active ? '#fff' : 'var(--bp-ink-soft)',
                fontSize: 12,
                fontFamily: 'var(--bb-sans)',
                cursor: 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
            }}
        >
            {swatch && (
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: swatch,
                    }}
                />
            )}
            {children}
        </button>
    );
}

export default function BlueprintsPage({ data }: { data: BlueprintCatalog }) {
    const [search, setSearch] = useState('');
    const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
    const [gameModeFilter, setGameModeFilter] = useState<string>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [hoverId, setHoverId] = useState<string | null>(null);

    const tagColors = useMemo(() => {
        const out: Record<string, string> = {};
        for (const [name, tag] of Object.entries(data.tags || {})) out[name] = tag.color;
        return out;
    }, [data.tags]);

    const allTags = useMemo(() => {
        const s = new Set<string>();
        data.blueprints.forEach((b) => (b.tags || []).forEach((t) => s.add(t)));
        return [...s].sort();
    }, [data.blueprints]);

    const allModes = useMemo(() => {
        const s = new Set<string>();
        data.blueprints.forEach((b) => s.add(b.gameMode));
        return [...s].sort();
    }, [data.blueprints]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return data.blueprints.filter((bp) => {
            if (gameModeFilter !== 'all' && bp.gameMode !== gameModeFilter) return false;
            if (activeTags.size && !(bp.tags || []).some((t) => activeTags.has(t))) return false;
            if (!q) return true;
            return (
                bp.displayName.toLowerCase().includes(q) ||
                bp.description.join(' ').toLowerCase().includes(q) ||
                bp.gameMode.toLowerCase().includes(q) ||
                (bp.author || '').toLowerCase().includes(q) ||
                (bp.tags || []).some((t) => t.toLowerCase().includes(q))
            );
        });
    }, [data.blueprints, gameModeFilter, activeTags, search]);

    function toggleSelect(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleTag(t: string) {
        setActiveTags((prev) => {
            const next = new Set(prev);
            if (next.has(t)) next.delete(t);
            else next.add(t);
            return next;
        });
    }

    function clearFilters() {
        setSearch('');
        setActiveTags(new Set());
        setGameModeFilter('all');
    }

    const filterBaseline = search === '' && activeTags.size === 0 && gameModeFilter === 'all';

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bp-paper-2)' }}>
            {/* ── Hero band ─────────────────────────────────────── */}
            <section
                className="bp-paper with-grid"
                style={{ padding: '40px 28px 56px', position: 'relative' }}
            >
                <div
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    <div
                        className="bb-grid-2"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1.6fr 1fr',
                            alignItems: 'flex-end',
                            gap: 24,
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontFamily: 'var(--bb-mono)',
                                    fontSize: 11,
                                    color: 'var(--bp-ink-soft)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    marginBottom: 10,
                                }}
                            >
                                <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: 11 }} />
                                Sheet 01 · Island Blueprints
                            </div>
                            <h1
                                style={{
                                    fontFamily: 'var(--bb-display)',
                                    fontSize: 52,
                                    fontWeight: 700,
                                    color: '#fff',
                                    margin: 0,
                                    letterSpacing: '-0.025em',
                                    lineHeight: 1.05,
                                }}
                            >
                                Drop-in starter islands.
                            </h1>
                            <p
                                style={{
                                    fontSize: 16,
                                    lineHeight: 1.55,
                                    color: 'var(--bp-ink)',
                                    marginTop: 12,
                                    maxWidth: 620,
                                    opacity: 0.92,
                                }}
                            >
                                Community-made{' '}
                                <code style={{ fontFamily: 'var(--bb-mono)' }}>.blueprint</code>{' '}
                                and bundle files for any BentoBox game mode. Curated from{' '}
                                <a
                                    href="https://github.com/BentoBoxWorld/weblink"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        fontFamily: 'var(--bb-mono)',
                                        color: 'var(--bp-ink)',
                                    }}
                                >
                                    BentoBoxWorld/weblink
                                </a>
                                . Want to add yours?{' '}
                                <a
                                    href="/submit"
                                    style={{
                                        color: 'var(--bp-ink)',
                                        textDecoration: 'underline',
                                        textDecorationColor: 'var(--bp-line-strong)',
                                    }}
                                >
                                    Submit a blueprint
                                </a>
                                .
                            </p>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 6,
                                fontFamily: 'var(--bb-mono)',
                                fontSize: 11,
                                color: 'var(--bp-ink-soft)',
                                textAlign: 'right',
                            }}
                        >
                            <span>
                                {data.blueprints.length} blueprints · {allModes.length} game modes
                            </span>
                            <span>updated {timeAgo(data.generatedAt)}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Filter rail + grid ─────────────────────────────── */}
            <section style={{ padding: '24px 28px 96px' }}>
                <div
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 240px) minmax(0, 1fr)',
                        gap: 28,
                    }}
                    className="bb-grid-2"
                >
                    {/* Filter rail */}
                    <aside
                        style={{
                            color: 'var(--bp-ink)',
                            position: 'sticky',
                            top: 80,
                            alignSelf: 'start',
                        }}
                    >
                        <div style={{ position: 'relative', marginBottom: 18 }}>
                            <FontAwesomeIcon
                                icon={faSearch}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--bp-ink-soft)',
                                    fontSize: 13,
                                    pointerEvents: 'none',
                                }}
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search…"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 34px',
                                    background: 'rgba(10,29,51,0.6)',
                                    border: '1px solid var(--bp-line-strong)',
                                    borderRadius: 'var(--r-md)',
                                    color: 'var(--bp-ink)',
                                    fontFamily: 'var(--bb-sans)',
                                    fontSize: 13,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 18 }}>
                            <SectionLabel>Game mode</SectionLabel>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                <ToggleChip
                                    active={gameModeFilter === 'all'}
                                    onClick={() => setGameModeFilter('all')}
                                >
                                    All
                                </ToggleChip>
                                {allModes.map((gm) => (
                                    <ToggleChip
                                        key={gm}
                                        active={gameModeFilter === gm}
                                        onClick={() =>
                                            setGameModeFilter(gameModeFilter === gm ? 'all' : gm)
                                        }
                                    >
                                        {data.gameModes[gm]?.displayName || gm}
                                    </ToggleChip>
                                ))}
                            </div>
                            {gameModeFilter !== 'all' && (
                                <a
                                    href={BlueprintGameModeZipUrl(gameModeFilter)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        marginTop: 10,
                                        fontSize: 12,
                                        fontFamily: 'var(--bb-mono)',
                                        color: 'var(--bp-ink)',
                                        textDecoration: 'underline',
                                        textDecorationColor: 'var(--bp-line-strong)',
                                    }}
                                >
                                    <FontAwesomeIcon icon={faDownload} style={{ fontSize: 11 }} />
                                    Download all
                                </a>
                            )}
                        </div>

                        {allTags.length > 0 && (
                            <div style={{ marginBottom: 18 }}>
                                <SectionLabel>Tags</SectionLabel>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {allTags.map((t) => (
                                        <ToggleChip
                                            key={t}
                                            active={activeTags.has(t)}
                                            onClick={() => toggleTag(t)}
                                            swatch={tagColors[t]}
                                        >
                                            {t}
                                        </ToggleChip>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!filterBaseline && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--bp-ink-soft)',
                                    fontSize: 12,
                                    fontFamily: 'var(--bb-sans)',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                }}
                            >
                                Clear filters
                            </button>
                        )}
                    </aside>

                    {/* Card grid (UploadCard always sits first so users notice it) */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: 16,
                            alignContent: 'start',
                        }}
                    >
                        <UploadCard />
                        {filtered.length === 0 ? (
                            <div
                                style={{
                                    padding: '48px 24px',
                                    textAlign: 'center',
                                    background: 'rgba(10, 29, 51, 0.6)',
                                    border: '1px dashed var(--bp-line-strong)',
                                    borderRadius: 14,
                                    color: 'var(--bp-ink-soft)',
                                    fontSize: 14,
                                    gridColumn: '1 / -1',
                                }}
                            >
                                No blueprints match those filters.
                            </div>
                        ) : (
                            filtered.map((bp) => (
                                <BlueprintCard
                                    key={bp.id}
                                    bp={bp}
                                    gameModeInfo={data.gameModes[bp.gameMode]}
                                    selected={selected.has(bp.id)}
                                    onToggle={() => toggleSelect(bp.id)}
                                    expanded={hoverId === bp.id}
                                    onHover={setHoverId}
                                    tagColors={tagColors}
                                />
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* ── Sticky selection bar ───────────────────────────── */}
            {selected.size > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 100,
                        background: 'var(--bp-paper)',
                        border: '1px solid var(--bp-line-strong)',
                        borderRadius: 999,
                        boxShadow: '0 18px 40px -8px rgba(0,0,0,0.6)',
                        padding: '8px 8px 8px 18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 12,
                        color: 'var(--bp-ink)',
                        fontFamily: 'var(--bb-sans)',
                        fontSize: 13,
                    }}
                >
                    <span>
                        <span style={{ fontFamily: 'var(--bb-mono)', color: '#fff' }}>
                            {selected.size}
                        </span>{' '}
                        selected
                    </span>
                    <a
                        href={BlueprintZipUrl([...selected])}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 999,
                            background: 'var(--bp-ink)',
                            color: 'var(--bp-paper)',
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        <FontAwesomeIcon icon={faDownload} style={{ fontSize: 11 }} />
                        Download ZIP
                    </a>
                    <button
                        type="button"
                        onClick={() => setSelected(new Set())}
                        title="Clear selection"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--bp-ink-soft)',
                            cursor: 'pointer',
                            padding: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                        }}
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            )}
        </div>
    );
}
