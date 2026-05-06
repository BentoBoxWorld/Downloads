import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { BlogPost as BlogPostData, GetBlogPost } from '../../ApiRequestManager';

export default function BlogPost() {
    const { slug } = useParams<{ slug: string }>();
    const [post, setPost] = useState<BlogPostData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Ensure highlight.css is in <head>. SSR injects it for direct loads,
    // but client-side navigation from /blog → /blog/p/:slug needs us to add
    // it ourselves so code blocks are coloured.
    useEffect(() => {
        if (document.querySelector('link[data-blog-hljs]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/blog/highlight.css';
        link.setAttribute('data-blog-hljs', '');
        document.head.appendChild(link);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setPost(null);
        setError(null);
        GetBlogPost(slug)
            .then((p) => {
                if (!cancelled) setPost(p);
            })
            .catch((e) => {
                if (cancelled) return;
                const status = (e as { response?: { status?: number } }).response?.status;
                setError(status === 404 ? 'not_found' : (e as Error).message);
            });
        return () => {
            cancelled = true;
        };
    }, [slug]);

    if (error === 'not_found') {
        return (
            <div style={containerStyle}>
                <p className="bb-display" style={{ fontSize: 48, margin: 0 }}>
                    404
                </p>
                <p style={{ color: 'var(--bb-mute)' }}>That post doesn’t exist (or isn’t published).</p>
                <Link to="/blog" style={{ color: 'inherit' }}>
                    ← Back to blog
                </Link>
            </div>
        );
    }
    if (error) {
        return <div style={containerStyle}>Error loading post: {error}</div>;
    }
    if (!post) {
        return (
            <div style={{ ...containerStyle, color: 'var(--bb-mute)' }}>Loading…</div>
        );
    }

    const published = new Date(post.publishedAt);
    const updated = new Date(post.updatedAt);

    return (
        <div style={containerStyle}>
            <Link
                to="/blog"
                style={{
                    color: 'var(--bb-mute)',
                    textDecoration: 'none',
                    fontSize: 13,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 16,
                }}
            >
                <FontAwesomeIcon icon={faArrowLeft} /> Back to blog
            </Link>
            {post.coverImage && (
                <img
                    src={post.coverImage}
                    alt=""
                    style={{
                        width: '100%',
                        aspectRatio: '16 / 9',
                        objectFit: 'cover',
                        borderRadius: 12,
                        marginBottom: 24,
                        background: 'var(--bb-paper-2)',
                    }}
                />
            )}
            <header style={{ marginBottom: 24 }}>
                <p
                    style={{
                        fontSize: 12,
                        color: 'var(--bb-mute)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontFamily: 'var(--bb-mono)',
                        margin: 0,
                    }}
                >
                    {published.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                    {post.edited && (
                        <>
                            {' · '}
                            <span title={updated.toISOString()}>updated {updated.toLocaleDateString()}</span>
                        </>
                    )}
                </p>
                <h1
                    className="bb-display"
                    style={{ fontSize: 40, lineHeight: 1.15, margin: '8px 0 16px' }}
                >
                    {post.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--bb-mute)' }}>
                    {post.author.avatarUrl && (
                        <img
                            src={post.author.avatarUrl}
                            alt=""
                            style={{ width: 24, height: 24, borderRadius: '50%' }}
                        />
                    )}
                    <span>By {post.author.name}</span>
                </div>
                {post.tags.length > 0 && (
                    <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {post.tags.map((t) => (
                            <Link
                                key={t}
                                to={`/blog?tag=${encodeURIComponent(t)}`}
                                className="bb-pill"
                                style={{ textDecoration: 'none', fontSize: 12 }}
                            >
                                #{t}
                            </Link>
                        ))}
                    </div>
                )}
            </header>

            <article
                className="blog-content"
                dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
            />

            <hr style={{ border: 'none', borderTop: '1px solid var(--bb-line)', margin: '40px 0 24px' }} />

            <p style={{ color: 'var(--bb-mute)', fontSize: 13 }}>
                Liked this post?{' '}
                <a
                    href="/blog/feed.xml"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                    Subscribe via RSS
                </a>{' '}
                or{' '}
                <a
                    href="https://discord.gg/KwjFBUaNSt"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                    join the Discord
                </a>
                .
            </p>

            <style>{`
                .blog-content {
                    font-size: 17px;
                    line-height: 1.7;
                    color: var(--bb-ink);
                }
                .blog-content h1 { font-size: 1.8rem; font-weight: 600; margin: 1.6em 0 0.5em; font-family: var(--bb-display); letter-spacing: -0.01em; }
                .blog-content h2 { font-size: 1.45rem; font-weight: 600; margin: 1.6em 0 0.5em; font-family: var(--bb-display); letter-spacing: -0.01em; }
                .blog-content h3 { font-size: 1.18rem; font-weight: 600; margin: 1.4em 0 0.4em; }
                .blog-content p { margin: 0.9em 0; }
                .blog-content ul, .blog-content ol { padding-left: 1.5em; margin: 0.9em 0; }
                .blog-content li { margin: 0.3em 0; }
                .blog-content pre {
                    background: #1a1d24;
                    color: #e6e8eb;
                    padding: 14px 16px;
                    border-radius: 8px;
                    overflow-x: auto;
                    font-family: var(--bb-mono);
                    font-size: 14px;
                    line-height: 1.55;
                    margin: 1.2em 0;
                }
                .blog-content code {
                    font-family: var(--bb-mono);
                    font-size: 0.92em;
                    background: rgba(26,29,36,0.06);
                    padding: 1px 6px;
                    border-radius: 4px;
                }
                .blog-content pre code { background: none; padding: 0; }
                .blog-content blockquote {
                    border-left: 3px solid var(--bb-line-strong);
                    padding-left: 14px;
                    color: var(--bb-mute);
                    margin: 1em 0;
                    font-style: italic;
                }
                .blog-content a { color: #1f5fae; text-decoration: underline; }
                .blog-content a:hover { color: #15457f; }
                .blog-content img { max-width: 100%; border-radius: 8px; margin: 1em 0; }
                .blog-content table { border-collapse: collapse; margin: 1em 0; width: 100%; }
                .blog-content th, .blog-content td { border: 1px solid var(--bb-line); padding: 8px 12px; text-align: left; }
                .blog-content th { background: rgba(26,29,36,0.04); font-weight: 600; }
                .blog-content hr { border: none; border-top: 1px solid var(--bb-line); margin: 1.5em 0; }
                .blog-content .callout {
                    border-left: 4px solid var(--callout-color, var(--bb-line-strong));
                    background: var(--callout-bg, rgba(26,29,36,0.04));
                    padding: 12px 16px;
                    border-radius: 0 8px 8px 0;
                    margin: 1.2em 0;
                }
                .blog-content .callout-title {
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 12px;
                    letter-spacing: 0.06em;
                    color: var(--callout-color, var(--bb-ink));
                    margin-bottom: 4px;
                }
                .blog-content .callout-note      { --callout-color: #1f5fae; --callout-bg: #eff6ff; }
                .blog-content .callout-tip       { --callout-color: #2f7d32; --callout-bg: #ecfdf5; }
                .blog-content .callout-important { --callout-color: #6f42c1; --callout-bg: #f5f3ff; }
                .blog-content .callout-warning   { --callout-color: #b45309; --callout-bg: #fffbeb; }
                .blog-content .callout-caution   { --callout-color: #b91c1c; --callout-bg: #fef2f2; }
                .blog-content .callout p:first-of-type { margin-top: 0; }
                .blog-content .callout p:last-of-type  { margin-bottom: 0; }
            `}</style>
        </div>
    );
}

const containerStyle: React.CSSProperties = {
    maxWidth: 720,
    margin: '0 auto',
    padding: '32px 24px',
};
