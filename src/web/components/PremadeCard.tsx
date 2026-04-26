import React from 'react';
import tw from 'twin.macro';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faWrench } from '@fortawesome/free-solid-svg-icons';
import { PremadeCardType } from '../web';

export default function PremadeCard(props: PremadeCardType) {
    const { addons, color, description, name, subtext, dependencies, dependencyText } = props;
    if (!addons) return <></>;

    const downloadHref = `/api/generate?downloads=${encodeURI(
        '[' + addons.map((a) => '"' + a + '"').join(',') + ']',
    )}`;
    const customizeHref = `/custom#${encodeURI(
        '[' + addons.map((a) => '"' + a + '"').join(',') + ']',
    )}`;

    return (
        <article
            css={tw`flex flex-col overflow-hidden`}
            style={{
                background: 'var(--bb-card)',
                border: '1px solid var(--bb-paper-edge)',
                borderRadius: 'var(--bb-r-lg)',
                boxShadow: 'var(--bb-shadow-card)',
            }}
        >
            {/* Color accent stripe */}
            <div style={{ height: 6, background: color }} />

            <div css={tw`flex flex-col flex-grow p-5`}>
                <header css={tw`mb-3`}>
                    <h3
                        style={{
                            fontFamily: 'var(--bb-display)',
                            fontWeight: 700,
                            fontSize: 22,
                            color: 'var(--bb-ink)',
                            letterSpacing: '-0.01em',
                            margin: 0,
                        }}
                    >
                        {name}
                    </h3>
                </header>

                <div
                    css={tw`mb-3`}
                    style={{
                        fontSize: 15,
                        lineHeight: 1.5,
                        color: 'var(--bb-ink-2)',
                    }}
                >
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>{description}</ReactMarkdown>
                </div>

                {subtext && (
                    <div
                        css={tw`mb-3`}
                        style={{
                            fontSize: 13,
                            lineHeight: 1.55,
                            color: 'var(--bb-mute)',
                        }}
                    >
                        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{subtext}</ReactMarkdown>
                    </div>
                )}

                <ul
                    css={tw`m-0 p-0 mb-4 flex flex-row flex-wrap`}
                    style={{ listStyle: 'none', gap: 6 }}
                >
                    {addons.map((addon) => (
                        <li
                            key={addon}
                            style={{
                                fontFamily: 'var(--bb-mono)',
                                fontSize: 11,
                                padding: '3px 8px',
                                borderRadius: 4,
                                background: 'var(--bb-paper-2)',
                                color: 'var(--bb-ink-2)',
                                border: '1px solid var(--bb-paper-edge)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: color,
                                    flexShrink: 0,
                                }}
                            />
                            {addon}
                        </li>
                    ))}
                </ul>

                {dependencies && dependencyText && (
                    <>
                        <div css={tw`mb-2`} style={{ fontSize: 12, color: 'var(--bb-mute)' }}>
                            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                                {dependencyText}
                            </ReactMarkdown>
                        </div>
                        <ul
                            css={tw`m-0 p-0 mb-4 flex flex-row flex-wrap`}
                            style={{ listStyle: 'none', gap: 6 }}
                        >
                            {dependencies.map((dep) => (
                                <li
                                    key={dep}
                                    style={{
                                        fontFamily: 'var(--bb-mono)',
                                        fontSize: 11,
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        background: 'transparent',
                                        color: 'var(--bb-mute)',
                                        border: '1px dashed var(--bb-paper-edge)',
                                    }}
                                >
                                    {dep}
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                <div
                    css={tw`mt-auto flex flex-row flex-wrap`}
                    style={{ gap: 8, paddingTop: 8 }}
                >
                    <a
                        href={downloadHref}
                        className="bb-btn bb-btn-primary"
                        style={{ flex: '1 1 auto' }}
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        Download
                    </a>
                    <a
                        href={customizeHref}
                        className="bb-btn bb-btn-ghost"
                        style={{ flex: '1 1 auto' }}
                    >
                        <FontAwesomeIcon icon={faWrench} />
                        Customize
                    </a>
                </div>
            </div>
        </article>
    );
}
