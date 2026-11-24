import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';
import { AddonStatsSummary, GetStatsSummary, StatsSummary } from '../../ApiRequestManager';

/**
 * Catalogue of the README badges served by src/api/stats.ts, with live
 * previews and copy-ready snippets (Markdown / HTML / plain URL).
 */

type Format = 'markdown' | 'html' | 'url';
type Style = 'flat' | 'flat-square' | 'for-the-badge';

interface BadgeDef {
    metric: string;
    title: string;
    detail: string;
}

const ECOSYSTEM_BADGES: BadgeDef[] = [
    { metric: 'servers', title: 'Servers', detail: 'Public BentoBox server count, as on the landing page.' },
    { metric: 'downloads', title: 'Downloads', detail: 'All addons and BentoBox, across every source.' },
    { metric: 'islands', title: 'Islands', detail: 'Islands in existence (7-day peak).' },
    { metric: 'players', title: 'Players online', detail: 'Peak concurrent players over the last week.' },
    { metric: 'islands-created', title: 'New islands', detail: 'Average islands created per day (last 7 days).' },
];

const ADDON_BADGES: BadgeDef[] = [
    { metric: 'servers', title: 'Servers', detail: 'Servers running it (7-day peak, rounded down).' },
    { metric: 'share', title: 'Share', detail: 'Percentage of BentoBox servers running it.' },
    { metric: 'rank', title: 'Popularity', detail: 'Rank among addons or game modes (top 10 only).' },
    { metric: 'downloads', title: 'Downloads', detail: 'Site ZIPs + GitHub + Modrinth + Hangar + CurseForge.' },
    { metric: 'mc', title: 'Minecraft', detail: 'Supported Minecraft versions from config.json.' },
    { metric: 'version', title: 'Version', detail: 'Addon version for the newest Minecraft version.' },
];

const FORMATS: { id: Format; label: string }[] = [
    { id: 'markdown', label: 'Markdown' },
    { id: 'html', label: 'HTML' },
    { id: 'url', label: 'URL' },
];

interface Options {
    origin: string;
    format: Format;
    style: Style;
    logo: boolean;
    link: boolean;
}

function badgeUrl(o: Options, metric: string, addon?: string): string {
    const params: string[] = [];
    if (o.style !== 'flat') params.push(`style=${o.style}`);
    if (!o.logo) params.push('logo=false');
    const path = addon ? `${encodeURIComponent(addon.replace(/\s+/g, ''))}/${metric}` : metric;
    return `${o.origin}/badge/${path}.svg${params.length ? `?${params.join('&')}` : ''}`;
}

function snippet(o: Options, url: string, alt: string): string {
    const target = `${o.origin}/`;
    if (o.format === 'url') return url;
    if (o.format === 'html') {
        const img = `<img src="${url}" alt="${alt}">`;
        return o.link ? `<a href="${target}">${img}</a>` : img;
    }
    const img = `![${alt}](${url})`;
    return o.link ? `[${img}](${target})` : img;
}

function fmt(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : n.toLocaleString('en-US');
}

export default function BadgesTab() {
    const [stats, setStats] = useState<StatsSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [addon, setAddon] = useState<string>('');
    const [format, setFormat] = useState<Format>('markdown');
    const [style, setStyle] = useState<Style>('flat');
    const [logo, setLogo] = useState(true);
    const [link, setLink] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        GetStatsSummary()
            .then((s) => {
                setStats(s);
                const sorted = [...s.addons].sort((a, b) => a.name.localeCompare(b.name));
                if (sorted.length) setAddon(sorted[0].name);
            })
            .catch((e) => setError((e as Error).message ?? 'Failed to load stats'));
    }, []);

    const opts: Options = { origin: window.location.origin, format, style, logo, link };

    function copy(key: string, text: string) {
        const done = () => {
            setCopied(key);
            window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(done, () => setError('Clipboard not available'));
        } else {
            setError('Clipboard not available — select the snippet and copy it by hand.');
        }
    }

    const addons = stats ? [...stats.addons].sort((a, b) => a.name.localeCompare(b.name)) : [];
    const current: AddonStatsSummary | undefined = addons.find((a) => a.name === addon);
    const separator = format === 'url' ? '\n' : ' ';

    const renderCard = (def: BadgeDef, addonName?: string) => {
        const url = badgeUrl(opts, def.metric, addonName);
        const alt = `${addonName ?? 'BentoBox'} ${def.title.toLowerCase()}`;
        const text = snippet(opts, url, alt);
        const key = `${addonName ?? '*'}/${def.metric}`;
        return (
            <div key={key} css={tw`border border-gray-200 rounded p-3 bg-white`}>
                <div css={tw`flex items-baseline gap-2 mb-2`}>
                    <span css={tw`font-medium text-sm`}>{def.title}</span>
                    <span css={tw`text-xs text-gray-500`}>{def.detail}</span>
                </div>
                <div css={tw`mb-2`} style={{ minHeight: 28 }}>
                    <img src={url} alt={alt} />
                </div>
                <div css={tw`flex items-start gap-2`}>
                    <code
                        css={tw`flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 break-all`}
                        style={{ fontFamily: 'var(--bb-mono)' }}
                    >
                        {text}
                    </code>
                    <CopyButton copied={copied === key} onClick={() => copy(key, text)} />
                </div>
            </div>
        );
    };

    const rowSnippet = (defs: BadgeDef[], addonName?: string) =>
        defs
            .map((d) =>
                snippet(
                    opts,
                    badgeUrl(opts, d.metric, addonName),
                    `${addonName ?? 'BentoBox'} ${d.title.toLowerCase()}`,
                ),
            )
            .join(separator);

    return (
        <div>
            <h3 css={tw`text-lg font-semibold mb-1`}>README badges</h3>
            <p css={tw`text-sm text-gray-600 mb-4`}>
                Live badges for GitHub READMEs, docs and posts. Numbers refresh hourly and are rounded down (e.g. 890 →
                &ldquo;850+&rdquo;). When a figure is too small to promote, a badge switches to a stronger one (e.g.
                servers → Minecraft versions), so the preview shows exactly what readers will see.
            </p>

            {/* Options */}
            <div css={tw`flex flex-wrap items-center gap-4 mb-6 p-3 bg-gray-50 border border-gray-200 rounded text-sm`}>
                <div css={tw`flex rounded overflow-hidden border border-gray-300`} role="group" aria-label="Format">
                    {FORMATS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFormat(f.id)}
                            aria-pressed={format === f.id}
                            css={[
                                tw`px-3 py-1`,
                                format === f.id ? tw`bg-gray-900 text-white` : tw`bg-white text-gray-700`,
                            ]}
                            style={{ border: 'none', cursor: 'pointer' }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <label css={tw`flex items-center gap-2`}>
                    Style
                    {/* eslint-disable-next-line jsx-a11y/no-onchange -- deprecated rule; onChange is correct for React selects */}
                    <select
                        value={style}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStyle(e.currentTarget.value as Style)}
                        css={tw`border border-gray-300 rounded px-2 py-1`}
                    >
                        <option value="flat">flat</option>
                        <option value="flat-square">flat-square</option>
                        <option value="for-the-badge">for-the-badge</option>
                    </select>
                </label>
                <label css={tw`flex items-center gap-2`}>
                    <input
                        type="checkbox"
                        checked={logo}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogo(e.currentTarget.checked)}
                    />
                    Logo
                </label>
                {format !== 'url' && (
                    <label css={tw`flex items-center gap-2`}>
                        <input
                            type="checkbox"
                            checked={link}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLink(e.currentTarget.checked)}
                        />
                        Link to download site
                    </label>
                )}
            </div>

            {error && (
                <div css={tw`mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}>{error}</div>
            )}
            {!stats && !error && <div css={tw`text-sm text-gray-500`}>Loading&hellip;</div>}

            {stats && (
                <>
                    <Section
                        title="BentoBox ecosystem"
                        subtitle="For the BentoBox README, the docs site and blog posts."
                        onCopyAll={() => copy('*/all', rowSnippet(ECOSYSTEM_BADGES))}
                        copiedAll={copied === '*/all'}
                    >
                        {ECOSYSTEM_BADGES.map((d) => renderCard(d))}
                    </Section>

                    <Section
                        title="Addons & game modes"
                        subtitle="For each addon's own README."
                        onCopyAll={() => copy(`${addon}/all`, rowSnippet(ADDON_BADGES, addon))}
                        copiedAll={copied === `${addon}/all`}
                        extra={
                            // eslint-disable-next-line jsx-a11y/no-onchange -- deprecated rule; onChange is correct for React selects
                            <select
                                value={addon}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAddon(e.currentTarget.value)}
                                aria-label="Addon"
                                css={tw`border border-gray-300 rounded px-2 py-1 text-sm`}
                            >
                                {addons.map((a) => (
                                    <option key={a.name} value={a.name}>
                                        {a.name}
                                        {a.gamemode ? ' (game mode)' : ''}
                                    </option>
                                ))}
                            </select>
                        }
                    >
                        {current && <AddonFigures a={current} />}
                        {current && ADDON_BADGES.map((d) => renderCard(d, current.name))}
                    </Section>
                </>
            )}
        </div>
    );
}

function Section({
    title,
    subtitle,
    extra,
    onCopyAll,
    copiedAll,
    children,
}: Readonly<{
    title: string;
    subtitle: string;
    extra?: React.ReactNode;
    onCopyAll: () => void;
    copiedAll: boolean;
    children: React.ReactNode;
}>) {
    return (
        <section css={tw`mb-8`}>
            <div css={tw`flex flex-wrap items-center gap-3 mb-1`}>
                <h4 css={tw`font-semibold m-0`}>{title}</h4>
                {extra}
                <button
                    type="button"
                    onClick={onCopyAll}
                    css={tw`ml-auto px-3 py-1 rounded bg-gray-900 text-white text-sm hover:bg-gray-800 flex items-center gap-2`}
                    style={{ border: 'none', cursor: 'pointer' }}
                >
                    <FontAwesomeIcon icon={copiedAll ? faCheck : faCopy} />
                    {copiedAll ? 'Copied' : 'Copy all as a row'}
                </button>
            </div>
            <p css={tw`text-xs text-gray-500 mb-3`}>{subtitle}</p>
            <div css={tw`grid gap-3`} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {children}
            </div>
        </section>
    );
}

function AddonFigures({ a }: Readonly<{ a: AddonStatsSummary }>) {
    const d = a.downloadsBySource;
    const sources = [
        ['site', d.site],
        ['GitHub', d.github],
        ['Modrinth', d.modrinth],
        ['Hangar', d.hangar],
        ['CurseForge', d.curseforge],
    ] as const;
    return (
        <div
            css={tw`border border-gray-200 rounded p-3 bg-gray-50 text-xs text-gray-700`}
            style={{ gridColumn: '1 / -1' }}
        >
            <span css={tw`mr-4`}>
                Servers <strong>{fmt(a.servers)}</strong>
            </span>
            <span css={tw`mr-4`}>
                Share <strong>{a.share === null ? '—' : `${a.share}%`}</strong>
            </span>
            <span css={tw`mr-4`}>
                Rank <strong>{a.rank === null ? '—' : `#${a.rank}`}</strong>
            </span>
            <span css={tw`mr-4`}>
                Downloads <strong>{fmt(a.downloads)}</strong>{' '}
                <span css={tw`text-gray-500`}>
                    (
                    {sources
                        .filter(([, n]) => n > 0)
                        .map(([label, n]) => `${label} ${fmt(n)}`)
                        .join(' · ') || 'none'}
                    )
                </span>
            </span>
            <span css={tw`mr-4`}>
                Minecraft <strong>{a.mc ? `${a.mc.min} – ${a.mc.max}` : '—'}</strong>
            </span>
            <span>
                Version <strong>{a.version ?? '—'}</strong>
            </span>
        </div>
    );
}

function CopyButton({ copied, onClick }: Readonly<{ copied: boolean; onClick: () => void }>) {
    return (
        <button
            type="button"
            onClick={onClick}
            title="Copy"
            aria-label="Copy snippet"
            css={[
                tw`px-2 py-1 rounded text-xs flex items-center gap-1 flex-shrink-0`,
                copied ? tw`bg-green-100 text-green-800` : tw`bg-gray-100 text-gray-700 hover:bg-gray-200`,
            ]}
            style={{ border: 'none', cursor: 'pointer' }}
        >
            <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}
