import React from 'react';
import tw from 'twin.macro';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCubes, faWrench, faPuzzlePiece } from '@fortawesome/free-solid-svg-icons';
import PremadeCard from './PremadeCard';
import { PresetsEntity } from '../../config';

interface PresetsPageProps {
    presets: PresetsEntity[];
    /**
     * When true (used by Landing.tsx), suppresses the standalone-page hero
     * — the surrounding Landing section already supplies its own heading.
     */
    embedded?: boolean;
}

export default function PresetsPage({ presets, embedded = false }: PresetsPageProps) {
    const hash =
        typeof location !== 'undefined' && location.hash.length >= 2
            ? location.hash.slice(1)
            : undefined;
    const preset = hash
        ? presets.filter((p) => hash.toLowerCase() === p.addons[0].toLowerCase())[0]
        : undefined;

    return (
        <>
            {!embedded && !preset && <Hero presetCount={presets.length} />}
            {preset && (
                <>
                    {!embedded && (
                        <div
                            css={tw`mx-auto my-6 p-6 rounded-xl`}
                            style={{
                                background: 'var(--bb-paper-2)',
                                border: '1px solid var(--bb-paper-edge)',
                            }}
                        >
                            <p
                                css={tw`text-sm font-medium`}
                                style={{
                                    fontFamily: 'var(--bb-mono)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    color: 'var(--bb-mute)',
                                }}
                            >
                                Featured preset
                            </p>
                            <p
                                css={tw`text-3xl mt-1`}
                                style={{
                                    fontFamily: 'var(--bb-display)',
                                    fontWeight: 700,
                                    color: 'var(--bb-ink)',
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                {hash}
                            </p>
                            <p css={tw`text-base mt-1`} style={{ color: 'var(--bb-mute)' }}>
                                Download as-is, or customize the addon list before bundling.
                            </p>
                        </div>
                    )}
                    <PremadeCard
                        key={preset.name}
                        name={preset.name}
                        description={preset.description}
                        subtext={preset.subtext}
                        addons={preset.addons}
                        color={preset.color}
                        dependencies={preset.dependencies}
                        dependencyText={preset.dependencyText}
                    />
                    {!embedded && (
                        <div
                            css={tw`flex flex-row items-center my-8`}
                            style={{ color: 'var(--bb-mute)' }}
                        >
                            <span
                                css={tw`flex-grow border-0 border-t border-solid`}
                                style={{ borderColor: 'var(--bb-line)' }}
                            ></span>
                            <span
                                css={tw`px-4`}
                                style={{
                                    fontFamily: 'var(--bb-mono)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    fontSize: 11,
                                }}
                            >
                                More presets
                            </span>
                            <span
                                css={tw`flex-grow border-0 border-t border-solid`}
                                style={{ borderColor: 'var(--bb-line)' }}
                            ></span>
                        </div>
                    )}
                </>
            )}

            <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-4`}>
                {presets
                    .filter((p) => !preset || hash !== p.addons[0])
                    .map((p) => (
                        <PremadeCard
                            key={p.name}
                            name={p.name}
                            description={p.description}
                            subtext={p.subtext}
                            addons={p.addons}
                            color={p.color}
                            dependencies={p.dependencies}
                            dependencyText={p.dependencyText}
                        />
                    ))}
            </div>
        </>
    );
}

function Hero({ presetCount }: { presetCount: number }) {
    return (
        <div css={tw`mb-8`}>
            <div
                css={tw`grid gap-6`}
                style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}
                className="bb-grid-2"
            >
                <div
                    css={tw`p-6 md:p-8 rounded-xl`}
                    style={{
                        background: 'var(--bb-ink)',
                        color: 'var(--bb-paper)',
                    }}
                >
                    <p
                        style={{
                            fontFamily: 'var(--bb-mono)',
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: '0.14em',
                            color: 'rgba(245, 241, 232, 0.6)',
                            margin: 0,
                        }}
                    >
                        Bundle in one click
                    </p>
                    <h1
                        css={tw`mt-3 mb-3`}
                        style={{
                            fontFamily: 'var(--bb-display)',
                            fontWeight: 700,
                            fontSize: 32,
                            lineHeight: 1.1,
                            letterSpacing: '-0.02em',
                            margin: '12px 0',
                        }}
                    >
                        Pick a preset.
                        <br />
                        Drop in your{' '}
                        <code
                            style={{
                                background: 'rgba(245, 241, 232, 0.12)',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontFamily: 'var(--bb-mono)',
                                fontSize: 28,
                            }}
                        >
                            plugins/
                        </code>{' '}
                        folder.
                    </h1>
                    <p
                        style={{
                            fontSize: 15,
                            lineHeight: 1.55,
                            color: 'rgba(245, 241, 232, 0.8)',
                            maxWidth: 480,
                            marginBottom: 20,
                        }}
                    >
                        Each preset is a curated bundle of BentoBox + addons that work well together.
                        Download a ZIP, or customize the addon list first.
                    </p>
                    <div css={tw`flex flex-row flex-wrap`} style={{ gap: 8 }}>
                        <a href="#presets-grid" className="bb-btn bb-btn-accent">
                            <FontAwesomeIcon icon={faCubes} />
                            Browse {presetCount} presets
                        </a>
                        <NavLink
                            to="/custom"
                            className="bb-btn bb-btn-ghost"
                            style={{
                                background: 'rgba(245, 241, 232, 0.08)',
                                color: 'var(--bb-paper)',
                                borderColor: 'rgba(245, 241, 232, 0.18)',
                            }}
                        >
                            <FontAwesomeIcon icon={faWrench} />
                            Build your own
                        </NavLink>
                    </div>
                </div>

                <div
                    css={tw`p-6 rounded-xl flex flex-col`}
                    style={{
                        background: 'var(--bb-paper-2)',
                        border: '1px solid var(--bb-paper-edge)',
                    }}
                >
                    <p
                        style={{
                            fontFamily: 'var(--bb-mono)',
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: '0.14em',
                            color: 'var(--bb-mute)',
                            margin: 0,
                        }}
                    >
                        How it works
                    </p>
                    <ol
                        style={{
                            marginTop: 12,
                            paddingLeft: 0,
                            listStyle: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        {[
                            { n: '1', t: 'Pick a preset or build a custom bundle' },
                            { n: '2', t: 'We pull matching JARs from GitHub & CI' },
                            { n: '3', t: 'You get a ZIP with an install guide' },
                        ].map((step) => (
                            <li
                                key={step.n}
                                style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}
                            >
                                <span
                                    style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 6,
                                        background: 'var(--bb-ink)',
                                        color: 'var(--bb-paper)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontFamily: 'var(--bb-mono)',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        flexShrink: 0,
                                    }}
                                >
                                    {step.n}
                                </span>
                                <span
                                    style={{
                                        color: 'var(--bb-ink-2)',
                                        fontSize: 14,
                                        lineHeight: 1.45,
                                    }}
                                >
                                    {step.t}
                                </span>
                            </li>
                        ))}
                    </ol>
                    <NavLink
                        to="/thirdparty"
                        css={tw`mt-auto pt-4`}
                        style={{
                            color: 'var(--bb-ink)',
                            fontSize: 13,
                            textDecoration: 'none',
                            borderTop: '1px solid var(--bb-line)',
                            marginTop: 16,
                        }}
                    >
                        <FontAwesomeIcon
                            icon={faPuzzlePiece}
                            style={{ marginRight: 6, fontSize: 12 }}
                        />
                        Or browse community addons →
                    </NavLink>
                </div>
            </div>
            <div id="presets-grid" />
        </div>
    );
}
