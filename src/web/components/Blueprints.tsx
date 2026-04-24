import React, { useMemo, useState } from 'react';
import tw from 'twin.macro';
import { css } from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { BlueprintCatalog, BlueprintCatalogGameMode, BlueprintEntry } from '../../config';
import {
    BlueprintFileUrl,
    BlueprintGameModeZipUrl,
    BlueprintZipUrl,
} from '../ApiRequestManager';

function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function shortMaterial(mat: string): string {
    return mat.startsWith('minecraft:') ? mat.slice('minecraft:'.length) : mat;
}

function Placeholder({ icon }: { icon: string }) {
    return (
        <div
            css={tw`w-full h-32 rounded-md flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 text-blue-900 text-sm font-mono`}
            title={`Icon material: ${icon}`}
        >
            {shortMaterial(icon).replace(/_/g, ' ')}
        </div>
    );
}

function BlueprintCard({
    bp,
    gameModeInfo,
    selected,
    onToggle,
    tagColors,
}: {
    bp: BlueprintEntry;
    gameModeInfo?: BlueprintCatalogGameMode;
    selected: boolean;
    onToggle: () => void;
    tagColors: Record<string, string>;
}) {
    const gameModeLabel = gameModeInfo?.displayName || bp.gameMode;
    return (
        <div
            css={`
                ${tw`p-3 bg-white rounded-md shadow-sm text-left flex flex-col`}
                ${selected && tw`ring-2 ring-blue-500`}
            `}
        >
            <div css={tw`flex items-start justify-between mb-2`}>
                <label css={tw`inline-flex items-center cursor-pointer`}>
                    <input type="checkbox" checked={selected} onChange={onToggle} css={tw`mr-2`} />
                    <span css={tw`text-xs text-gray-500`}>Select</span>
                </label>
                <a
                    href={BlueprintFileUrl(bp.id)}
                    css={tw`text-blue-600 hover:text-blue-800`}
                    title="Download this blueprint"
                >
                    <FontAwesomeIcon icon={faDownload} />
                </a>
            </div>

            {bp.image ? (
                <img
                    src={`/weblink/blueprints/${bp.image}`}
                    alt={bp.displayName}
                    css={tw`w-full h-32 object-cover rounded-md`}
                />
            ) : (
                <Placeholder icon={bp.icon} />
            )}

            <div css={tw`mt-2`}>
                <p css={tw`font-bold text-lg leading-tight`}>{bp.displayName}</p>
                <p css={tw`text-xs text-gray-500`}>
                    {gameModeLabel}
                    {bp.author && (
                        <>
                            {' · '}
                            {bp.authorLink ? (
                                <a href={bp.authorLink} target="noopener" css={tw`text-blue-600`}>
                                    {bp.author}
                                </a>
                            ) : (
                                bp.author
                            )}
                        </>
                    )}
                </p>
            </div>

            {bp.description.length > 0 && (
                <div css={tw`text-sm text-gray-700 mt-1`}>
                    {bp.description.map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            )}

            <div css={tw`mt-2 text-xs text-gray-600 grid grid-cols-2 gap-1`}>
                <div>
                    <span css={tw`font-semibold`}>Size:</span> {bp.stats.dimensions.x}×{bp.stats.dimensions.y}×
                    {bp.stats.dimensions.z}
                </div>
                <div>
                    <span css={tw`font-semibold`}>Blocks:</span> {bp.stats.blockCount.toLocaleString()}
                </div>
                <div>
                    <span css={tw`font-semibold`}>Entities:</span> {bp.stats.entityCount.toLocaleString()}
                </div>
                <div>
                    <span css={tw`font-semibold`}>Air:</span> {bp.stats.airCount.toLocaleString()}
                </div>
                {bp.stats.sinking && (
                    <div css={tw`text-blue-700`}>
                        <FontAwesomeIcon icon={faArrowDown} /> Sinking
                    </div>
                )}
                <div css={tw`col-span-2`}>
                    <span css={tw`font-semibold`}>File:</span> {humanSize(bp.sizeBytes)}
                </div>
            </div>

            {bp.stats.topBlocks.length > 0 && (
                <div css={tw`mt-2 text-xs text-gray-700`}>
                    <div css={tw`font-semibold`}>Top blocks:</div>
                    <div>
                        {bp.stats.topBlocks.map((b) => (
                            <span
                                key={b.material}
                                css={tw`inline-block bg-gray-100 rounded px-1 mr-1 mb-1`}
                            >
                                {shortMaterial(b.material)} × {b.count}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {bp.stats.topEntities.length > 0 && (
                <div css={tw`mt-1 text-xs text-gray-700`}>
                    <div css={tw`font-semibold`}>Entities:</div>
                    <div>
                        {bp.stats.topEntities.map((e) => (
                            <span
                                key={e.type}
                                css={tw`inline-block bg-purple-100 text-purple-800 rounded px-1 mr-1 mb-1`}
                            >
                                {e.type} × {e.count}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {bp.stats.biomes.length > 0 && (
                <div css={tw`mt-1 text-xs text-gray-700`}>
                    <div css={tw`font-semibold`}>Biomes:</div>
                    <div>
                        {bp.stats.biomes.map((biome) => (
                            <span
                                key={biome}
                                css={tw`inline-block bg-green-100 text-green-800 rounded px-1 mr-1 mb-1`}
                            >
                                {biome}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {bp.tags && bp.tags.length > 0 && (
                <div css={tw`mt-2`}>
                    {bp.tags.sort().map((tag) => (
                        <span
                            key={tag}
                            css={css`
                                ${tw`rounded-lg text-white text-xs font-bold px-2 mx-0.5 inline-block`}
                                background-color: ${tagColors[tag] || '#6b7280'};
                            `}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {bp.license && (
                <div css={tw`mt-2 text-xs text-gray-400`}>License: {bp.license}</div>
            )}
        </div>
    );
}

export default function BlueprintsPage({ data }: { data: BlueprintCatalog }) {
    const [gameModeFilter, setGameModeFilter] = useState<string>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const gameModes = useMemo(() => {
        const s = new Set<string>();
        data.blueprints.forEach((b) => s.add(b.gameMode));
        return [...s].sort();
    }, [data.blueprints]);

    const tagColors = useMemo(() => {
        const out: Record<string, string> = {};
        for (const [name, tag] of Object.entries(data.tags || {})) out[name] = tag.color;
        return out;
    }, [data.tags]);

    const filtered = useMemo(
        () =>
            gameModeFilter === 'all'
                ? data.blueprints
                : data.blueprints.filter((b) => b.gameMode === gameModeFilter),
        [data.blueprints, gameModeFilter],
    );

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function clearSelection() {
        setSelected(new Set());
    }

    return (
        <>
            <div css={tw`bg-yellow-400 rounded-lg p-3 mx-auto my-2 text-black text-center`}>
                <p css={tw`text-2xl font-semibold`}>Island Blueprints</p>
                <p css={tw`text-lg`}>
                    Drop-in <code>.blueprint</code> and bundle files for BentoBox game modes.
                </p>
                <p css={tw`text-sm`}>
                    Served from&nbsp;
                    <a href={'https://github.com/BentoBoxWorld/weblink'}>BentoBoxWorld/weblink</a>. Submissions and
                    user accounts are coming soon.
                </p>
            </div>

            <div css={tw`flex flex-wrap items-center gap-3 my-2`}>
                <div>
                    Filter By Game Mode:&nbsp;
                    <select value={gameModeFilter} onChange={(e) => setGameModeFilter(e.target.value)}>
                        <option value="all">all</option>
                        {gameModes.map((gm) => (
                            <option key={gm} value={gm}>
                                {data.gameModes[gm]?.displayName || gm}
                            </option>
                        ))}
                    </select>
                </div>
                {gameModeFilter !== 'all' && (
                    <a
                        href={BlueprintGameModeZipUrl(gameModeFilter)}
                        css={tw`text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700`}
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        &nbsp;Download all for {data.gameModes[gameModeFilter]?.displayName || gameModeFilter}
                    </a>
                )}
            </div>

            {filtered.length === 0 ? (
                <div css={tw`text-center text-gray-500 my-8`}>
                    No blueprints found. Add <code>.blueprint</code> files to weblink/blueprints.
                </div>
            ) : (
                <div css={tw`p-4 grid gap-3 auto-rows-max grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-row`}>
                    {filtered.map((bp) => (
                        <BlueprintCard
                            key={bp.id}
                            bp={bp}
                            gameModeInfo={data.gameModes[bp.gameMode]}
                            selected={selected.has(bp.id)}
                            onToggle={() => toggle(bp.id)}
                            tagColors={tagColors}
                        />
                    ))}
                </div>
            )}

            {selected.size > 0 && (
                <div
                    css={tw`fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-700 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-3 z-50`}
                >
                    <span>{selected.size} selected</span>
                    <a
                        href={BlueprintZipUrl([...selected])}
                        css={tw`bg-white text-blue-700 px-3 py-1 rounded-full font-semibold`}
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        &nbsp;Download ZIP
                    </a>
                    <button
                        type="button"
                        onClick={clearSelection}
                        css={tw`underline text-sm hover:text-blue-100`}
                    >
                        clear
                    </button>
                </div>
            )}
        </>
    );
}
