import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCube,
    faWrench,
    faPuzzlePiece,
    faLayerGroup,
    faPaperPlane,
    faHeart,
    faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface ColumnLink {
    label: string;
    to?: string;
    href?: string;
    icon?: IconDefinition;
}

const COLUMNS: { title: string; links: ColumnLink[] }[] = [
    {
        title: 'Downloads',
        links: [
            { label: 'Presets', to: '/#presets-anchor', icon: faCube },
            { label: 'Custom build', to: '/custom', icon: faWrench },
            { label: 'Third-party addons', to: '/thirdparty', icon: faPuzzlePiece },
            { label: 'Blueprints', to: '/blueprints', icon: faLayerGroup },
        ],
    },
    {
        title: 'Project',
        links: [
            { label: 'Documentation', href: 'https://docs.bentobox.world/', icon: faQuestion },
            { label: 'GitHub', href: 'https://github.com/BentoBoxWorld' },
            { label: 'Submit a blueprint', to: '/submit', icon: faPaperPlane },
            { label: 'Discord community', href: 'https://discord.gg/KwjFBUaNSt' },
        ],
    },
    {
        title: 'Legal',
        links: [
            { label: 'Terms of Service', to: '/terms' },
            { label: 'Privacy Policy', to: '/privacy' },
        ],
    },
];

export default function Footer() {
    return (
        <footer
            style={{
                background: 'var(--bb-ink)',
                color: 'rgba(245, 241, 232, 0.78)',
                padding: '64px 28px 32px',
                marginTop: 64,
            }}
        >
            <div style={{ maxWidth: 1180, margin: '0 auto' }}>
                <div
                    className="bb-grid-footer"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                        gap: 40,
                        marginBottom: 40,
                    }}
                >
                    {/* Brand block */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 7,
                                    background: 'var(--bb-paper)',
                                    color: 'var(--bb-ink)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontFamily: 'var(--bb-display)',
                                    fontWeight: 700,
                                    fontSize: 16,
                                }}
                            >
                                B
                            </div>
                            <div
                                style={{
                                    fontFamily: 'var(--bb-display)',
                                    fontWeight: 700,
                                    fontSize: 18,
                                    color: 'var(--bb-paper)',
                                }}
                            >
                                BentoBox
                            </div>
                        </div>
                        <p
                            style={{
                                fontSize: 14,
                                lineHeight: 1.55,
                                marginTop: 14,
                                maxWidth: 320,
                                color: 'rgba(245, 241, 232, 0.65)',
                            }}
                        >
                            Open-source island game-mode platform for Paper Minecraft servers.
                            Built by volunteers, free forever.
                        </p>
                        <a
                            href="https://github.com/sponsors/tastybento"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bb-btn"
                            style={{
                                marginTop: 16,
                                background: 'rgba(245, 241, 232, 0.1)',
                                color: 'var(--bb-paper)',
                                border: '1px solid rgba(245, 241, 232, 0.2)',
                                fontSize: 13,
                            }}
                        >
                            <FontAwesomeIcon icon={faHeart} style={{ color: 'var(--bb-rose)' }} />
                            Sponsor on GitHub
                        </a>
                    </div>

                    {/* Link columns */}
                    {COLUMNS.map((col) => (
                        <div key={col.title}>
                            <div
                                className="bb-eyebrow"
                                style={{
                                    color: 'rgba(245, 241, 232, 0.5)',
                                    marginBottom: 14,
                                }}
                            >
                                {col.title}
                            </div>
                            <ul
                                style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                }}
                            >
                                {col.links.map((l) => {
                                    const inner = (
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}
                                        >
                                            {l.icon && (
                                                <FontAwesomeIcon
                                                    icon={l.icon}
                                                    style={{ fontSize: 12, opacity: 0.6 }}
                                                />
                                            )}
                                            {l.label}
                                        </span>
                                    );
                                    return (
                                        <li key={l.label}>
                                            {l.to ? (
                                                <Link
                                                    to={l.to}
                                                    style={{
                                                        color: 'rgba(245, 241, 232, 0.78)',
                                                        textDecoration: 'none',
                                                        fontSize: 14,
                                                    }}
                                                >
                                                    {inner}
                                                </Link>
                                            ) : (
                                                <a
                                                    href={l.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        color: 'rgba(245, 241, 232, 0.78)',
                                                        textDecoration: 'none',
                                                        fontSize: 14,
                                                    }}
                                                >
                                                    {inner}
                                                </a>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        paddingTop: 24,
                        borderTop: '1px solid rgba(245, 241, 232, 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 16,
                    }}
                >
                    <div style={{ fontSize: 12, color: 'rgba(245, 241, 232, 0.5)' }}>
                        © BentoBoxWorld &middot; Site by{' '}
                        <a
                            href="https://github.com/tastybento"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'rgba(245, 241, 232, 0.7)', fontStyle: 'italic' }}
                        >
                            tastybento
                        </a>{' '}
                        &middot; Not affiliated with Mojang or Microsoft
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <a
                            href="https://github.com/BentoBoxWorld"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub"
                            style={{ color: 'rgba(245, 241, 232, 0.6)', fontSize: 18 }}
                        >
                            <FontAwesomeIcon icon={faGithub} />
                        </a>
                        <a
                            href="https://discord.gg/KwjFBUaNSt"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Discord"
                            style={{ color: 'rgba(245, 241, 232, 0.6)', fontSize: 18 }}
                        >
                            <FontAwesomeIcon icon={faDiscord} />
                        </a>
                    </div>
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .bb-grid-footer { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
                }
                @media (max-width: 480px) {
                    .bb-grid-footer { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </footer>
    );
}
