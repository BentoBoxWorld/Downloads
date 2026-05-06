import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRss, faTimes } from '@fortawesome/free-solid-svg-icons';
import {
    BlogList as BlogListData,
    BlogPostSummary,
    BlogTag,
    GetBlogList,
    GetBlogTags,
} from '../../ApiRequestManager';

export default function BlogList() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const tagParam = params.get('tag') || undefined;
    const [page, setPage] = useState(1);
    const [data, setData] = useState<BlogListData | null>(null);
    const [tags, setTags] = useState<BlogTag[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Reset to page 1 whenever the active tag changes.
    useEffect(() => {
        setPage(1);
    }, [tagParam]);

    useEffect(() => {
        let cancelled = false;
        GetBlogTags()
            .then((t) => {
                if (!cancelled) setTags(t);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        GetBlogList(page, tagParam)
            .then((d) => {
                if (!cancelled) setData(d);
            })
            .catch((e) => {
                if (!cancelled) setError((e as Error).message);
            });
        return () => {
            cancelled = true;
        };
    }, [page, tagParam]);

    return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
            <header style={{ marginBottom: 32 }}>
                <p className="bb-eyebrow" style={{ marginBottom: 8 }}>BentoBox Blog</p>
                <h1
                    className="bb-display"
                    style={{ fontSize: 40, lineHeight: 1.1, margin: 0 }}
                >
                    Releases, API changes &amp; notes from the developers.
                </h1>
                <p style={{ color: 'var(--bb-mute)', marginTop: 12, fontSize: 16, lineHeight: 1.55 }}>
                    Follow along as the BentoBox plugin and its addons evolve. Subscribe to the{' '}
                    <a
                        href="/blog/feed.xml"
                        style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                        <FontAwesomeIcon icon={faRss} /> RSS feed
                    </a>{' '}
                    to never miss an update.
                </p>
                {tagParam && (
                    <div
                        style={{
                            marginTop: 16,
                            padding: '10px 14px',
                            background: 'var(--bb-paper-2)',
                            borderRadius: 8,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 14,
                        }}
                    >
                        <span style={{ color: 'var(--bb-mute)' }}>Filtering by tag:</span>
                        <strong>#{tagParam}</strong>
                        <Link
                            to="/blog"
                            style={{ color: 'var(--bb-mute)', textDecoration: 'none' }}
                            title="Clear filter"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </Link>
                    </div>
                )}
                {!tagParam && tags.length > 0 && (
                    <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {tags.slice(0, 12).map((t) => (
                            <Link
                                key={t.slug}
                                to={`/blog?tag=${encodeURIComponent(t.slug)}`}
                                className="bb-pill"
                                style={{ textDecoration: 'none', cursor: 'pointer' }}
                            >
                                #{t.slug}
                                <span style={{ color: 'var(--bb-mute)', fontSize: 11 }}>
                                    {t.count}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </header>

            {error && (
                <div style={errorBox}>Failed to load posts: {error}</div>
            )}

            {data === null && !error && (
                <div style={{ color: 'var(--bb-mute)', textAlign: 'center', padding: 40 }}>
                    Loading…
                </div>
            )}

            {data && data.posts.length === 0 && (
                <div style={{ color: 'var(--bb-mute)', textAlign: 'center', padding: 40 }}>
                    No posts yet — check back soon.
                </div>
            )}

            {data && data.posts.length > 0 && (
                <ol
                    style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'grid',
                        gap: 24,
                    }}
                >
                    {data.posts.map((p) => (
                        <PostCard key={p.id} post={p} />
                    ))}
                </ol>
            )}

            {data && (data.hasMore || page > 1) && (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32 }}>
                    <button
                        type="button"
                        className="bb-btn bb-btn-ghost"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        style={{ opacity: page <= 1 ? 0.4 : 1 }}
                    >
                        ← Newer
                    </button>
                    <span
                        style={{
                            alignSelf: 'center',
                            fontSize: 13,
                            color: 'var(--bb-mute)',
                        }}
                    >
                        Page {page}
                    </span>
                    <button
                        type="button"
                        className="bb-btn bb-btn-ghost"
                        disabled={!data.hasMore}
                        onClick={() => setPage((p) => p + 1)}
                        style={{ opacity: !data.hasMore ? 0.4 : 1 }}
                    >
                        Older →
                    </button>
                </div>
            )}
        </div>
    );
}

function PostCard({ post }: { post: BlogPostSummary }) {
    const date = new Date(post.publishedAt);
    return (
        <li
            className="bb-card bb-card-hover"
            style={{ padding: 0, overflow: 'hidden' }}
        >
            <Link
                to={`/blog/p/${encodeURIComponent(post.slug)}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
                {post.coverImage && (
                    <img
                        src={post.coverImage}
                        alt=""
                        style={{
                            width: '100%',
                            aspectRatio: '16 / 9',
                            objectFit: 'cover',
                            display: 'block',
                            background: 'var(--bb-paper-2)',
                        }}
                        loading="lazy"
                    />
                )}
                <div style={{ padding: '20px 24px' }}>
                    <p
                        style={{
                            fontSize: 11,
                            color: 'var(--bb-mute)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            margin: 0,
                            fontFamily: 'var(--bb-mono)',
                        }}
                    >
                        {date.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })}
                        {' · '}
                        {post.author.name}
                    </p>
                    <h2
                        className="bb-display"
                        style={{ fontSize: 24, margin: '8px 0 6px', lineHeight: 1.2 }}
                    >
                        {post.title}
                    </h2>
                    {post.summary && (
                        <p
                            style={{
                                color: 'var(--bb-mute)',
                                margin: 0,
                                fontSize: 15,
                                lineHeight: 1.55,
                            }}
                        >
                            {post.summary}
                        </p>
                    )}
                    {post.tags.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {post.tags.map((t) => (
                                <span
                                    key={t}
                                    className="bb-pill"
                                    style={{ fontSize: 11 }}
                                >
                                    #{t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </Link>
        </li>
    );
}

const errorBox: React.CSSProperties = {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
};
