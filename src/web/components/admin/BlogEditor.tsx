import React, { useEffect, useRef, useState } from 'react';
import tw from 'twin.macro';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faSave,
    faPaperPlane,
    faEyeSlash,
    faImage,
    faSpinner,
    faClock,
} from '@fortawesome/free-solid-svg-icons';
import {
    AdminBlogPost,
    GetAdminBlogPost,
    PostPublishBlogPost,
    PostUnpublishBlogPost,
    PutAdminBlogPost,
    SessionUser,
    UploadBlogImage,
} from '../../ApiRequestManager';

interface Props {
    user: SessionUser;
    postId: number;
    onClose: () => void;
}

const AUTOSAVE_INTERVAL_MS = 12_000;

export default function BlogEditor({ user, postId, onClose }: Props) {
    const [post, setPost] = useState<AdminBlogPost | null>(null);
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [summary, setSummary] = useState('');
    const [bodyMd, setBodyMd] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [tagsInput, setTagsInput] = useState('');
    const [scheduleAt, setScheduleAt] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initial load.
    useEffect(() => {
        let cancelled = false;
        GetAdminBlogPost(postId)
            .then((p) => {
                if (cancelled) return;
                setPost(p);
                setTitle(p.title);
                setSlug(p.slug);
                setSummary(p.summary);
                setBodyMd(p.bodyMd);
                setCoverImage(p.coverImage);
                setTagsInput(p.tags.join(', '));
            })
            .catch((e) => setError(extract(e)));
        return () => {
            cancelled = true;
        };
    }, [postId]);

    // Track dirty.
    useEffect(() => {
        if (!post) return;
        const isDirty =
            title !== post.title ||
            slug !== post.slug ||
            summary !== post.summary ||
            bodyMd !== post.bodyMd ||
            coverImage !== post.coverImage ||
            tagsInput.trim() !== post.tags.join(', ');
        setDirty(isDirty);
    }, [post, title, slug, summary, bodyMd, coverImage, tagsInput]);

    // Autosave.
    useEffect(() => {
        if (!dirty || busy) return;
        const id = setTimeout(() => {
            handleSave().catch(() => undefined);
        }, AUTOSAVE_INTERVAL_MS);
        return () => clearTimeout(id);
    }, [dirty, busy, title, slug, summary, bodyMd, coverImage, tagsInput]);

    async function handleSave(): Promise<void> {
        if (!post || busy) return;
        setError(null);
        setBusy(true);
        try {
            const updated = await PutAdminBlogPost(user.csrfToken, post.id, {
                title: title.trim() || 'Untitled',
                slug,
                summary,
                bodyMd,
                coverImage,
                tags: tagsInput
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
            });
            setPost(updated);
            setSavedAt(Date.now());
            setDirty(false);
        } catch (e) {
            setError(extract(e));
        } finally {
            setBusy(false);
        }
    }

    async function handlePublish(): Promise<void> {
        if (!post) return;
        if (dirty) await handleSave();
        const at = scheduleAt ? new Date(scheduleAt).getTime() : undefined;
        setBusy(true);
        try {
            const updated = await PostPublishBlogPost(user.csrfToken, post.id, at);
            setPost(updated);
            setSavedAt(Date.now());
            setScheduleAt('');
        } catch (e) {
            setError(extract(e));
        } finally {
            setBusy(false);
        }
    }

    async function handleUnpublish(): Promise<void> {
        if (!post) return;
        if (!window.confirm('Revert this post to draft?')) return;
        setBusy(true);
        try {
            const updated = await PostUnpublishBlogPost(user.csrfToken, post.id);
            setPost(updated);
        } catch (e) {
            setError(extract(e));
        } finally {
            setBusy(false);
        }
    }

    async function handleImageUpload(file: File): Promise<void> {
        setBusy(true);
        try {
            const { url } = await UploadBlogImage(user.csrfToken, file);
            insertAtCursor(`![${file.name}](${url})\n`);
        } catch (e) {
            setError(extract(e));
        } finally {
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    function insertAtCursor(text: string) {
        const ta = textareaRef.current;
        if (!ta) {
            setBodyMd((b) => b + text);
            return;
        }
        const start = ta.selectionStart ?? bodyMd.length;
        const end = ta.selectionEnd ?? bodyMd.length;
        const next = bodyMd.slice(0, start) + text + bodyMd.slice(end);
        setBodyMd(next);
        // Restore caret after the insertion on next tick.
        requestAnimationFrame(() => {
            ta.focus();
            ta.selectionStart = ta.selectionEnd = start + text.length;
        });
    }

    if (!post) {
        return <div css={tw`text-sm text-gray-500`}>Loading post…</div>;
    }

    const published = post.status === 'published';
    const scheduled = post.status === 'scheduled';

    return (
        <div>
            <div css={tw`flex items-center gap-2 mb-3`}>
                <button
                    type="button"
                    onClick={onClose}
                    css={tw`text-sm text-gray-700 hover:text-gray-900 flex items-center gap-1`}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Back to posts
                </button>
                <div css={tw`ml-auto flex items-center gap-2 text-xs text-gray-500`}>
                    {busy && (
                        <span>
                            <FontAwesomeIcon icon={faSpinner} spin /> Saving…
                        </span>
                    )}
                    {!busy && dirty && <span>Unsaved changes</span>}
                    {!busy && !dirty && savedAt && (
                        <span>Saved {new Date(savedAt).toLocaleTimeString()}</span>
                    )}
                </div>
            </div>

            <div css={tw`flex flex-wrap items-center gap-2 mb-4`}>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Post title"
                    css={tw`flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-lg font-semibold`}
                    style={{ minWidth: 200 }}
                />
                <span
                    css={tw`text-xs text-gray-500`}
                    style={{ fontFamily: 'var(--bb-mono)' }}
                >
                    /p/
                </span>
                <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="slug"
                    css={tw`px-2 py-1 border border-gray-300 rounded text-sm`}
                    style={{ width: 220, fontFamily: 'var(--bb-mono)' }}
                />
            </div>

            <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One-line summary (used in RSS, social cards, post list)"
                css={tw`w-full px-3 py-2 border border-gray-300 rounded text-sm mb-3`}
                maxLength={400}
            />

            <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Tags (comma-separated, e.g. release, api, breaking)"
                css={tw`w-full px-3 py-2 border border-gray-300 rounded text-sm mb-3`}
                style={{ fontFamily: 'var(--bb-mono)' }}
            />

            <div css={tw`flex items-center gap-2 mb-2`}>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    css={tw`text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-2`}
                    style={{ background: 'white', cursor: 'pointer' }}
                >
                    <FontAwesomeIcon icon={faImage} />
                    Insert image
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f);
                    }}
                />
                {coverImage && (
                    <span css={tw`text-xs text-gray-500 truncate`} style={{ maxWidth: 280 }}>
                        Cover: {coverImage}
                        <button
                            type="button"
                            onClick={() => setCoverImage(null)}
                            css={tw`ml-2 text-red-700 hover:underline`}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                            clear
                        </button>
                    </span>
                )}
                {!coverImage && (
                    <button
                        type="button"
                        onClick={() => {
                            const url = window.prompt('Cover image URL? (must be /blog/images/... or https://)');
                            if (url) setCoverImage(url);
                        }}
                        css={tw`text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-50`}
                        style={{ background: 'white', cursor: 'pointer' }}
                    >
                        Set cover image
                    </button>
                )}
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    minHeight: 480,
                }}
            >
                <textarea
                    ref={textareaRef}
                    value={bodyMd}
                    onChange={(e) => setBodyMd(e.target.value)}
                    placeholder="Write your post in Markdown. Supports tables, fenced code, lists, links, and images."
                    css={tw`w-full px-3 py-2 border border-gray-300 rounded text-sm`}
                    style={{
                        fontFamily: 'var(--bb-mono)',
                        minHeight: 480,
                        resize: 'vertical',
                        lineHeight: 1.55,
                    }}
                />
                <div
                    className="blog-preview"
                    css={tw`px-4 py-3 border border-gray-200 rounded bg-white overflow-auto`}
                    style={{ minHeight: 480, maxHeight: 720 }}
                >
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {bodyMd || '*Start typing on the left to see a preview here.*'}
                    </ReactMarkdown>
                </div>
            </div>

            <div css={tw`flex items-center gap-2 mt-4`}>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy || !dirty}
                    css={tw`px-3 py-2 rounded bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2`}
                    style={{ border: 'none', cursor: 'pointer' }}
                >
                    <FontAwesomeIcon icon={faSave} />
                    Save draft
                </button>
                {!published && !scheduled && (
                    <>
                        <input
                            type="datetime-local"
                            value={scheduleAt}
                            onChange={(e) => setScheduleAt(e.target.value)}
                            css={tw`px-2 py-1 border border-gray-300 rounded text-sm`}
                            title="Pick a future time to schedule, or leave empty to publish now"
                        />
                        <button
                            type="button"
                            onClick={handlePublish}
                            disabled={busy}
                            css={tw`px-3 py-2 rounded bg-green-700 text-white text-sm hover:bg-green-800 disabled:opacity-50 flex items-center gap-2`}
                            style={{ border: 'none', cursor: 'pointer' }}
                        >
                            <FontAwesomeIcon icon={scheduleAt ? faClock : faPaperPlane} />
                            {scheduleAt ? 'Schedule' : 'Publish'}
                        </button>
                    </>
                )}
                {scheduled && (
                    <>
                        <span
                            css={tw`text-sm text-yellow-800`}
                            style={{
                                background: '#fef3c7',
                                padding: '4px 10px',
                                borderRadius: 6,
                            }}
                        >
                            Scheduled for{' '}
                            {post.publishedAt
                                ? new Date(post.publishedAt).toLocaleString()
                                : '—'}
                        </span>
                        <button
                            type="button"
                            onClick={handleUnpublish}
                            disabled={busy}
                            css={tw`text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50`}
                            style={{ background: 'white', cursor: 'pointer' }}
                        >
                            Cancel schedule
                        </button>
                    </>
                )}
                {published && (
                    <>
                        <a
                            href={`/blog/p/${encodeURIComponent(post.slug)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            css={tw`text-sm text-blue-700 hover:underline ml-2`}
                        >
                            View live →
                        </a>
                        <button
                            type="button"
                            onClick={handleUnpublish}
                            disabled={busy}
                            css={tw`ml-auto text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-2`}
                            style={{ background: 'white', cursor: 'pointer' }}
                        >
                            <FontAwesomeIcon icon={faEyeSlash} />
                            Unpublish
                        </button>
                    </>
                )}
            </div>

            {error && (
                <div
                    css={tw`mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}
                >
                    {error}
                </div>
            )}

            <style>{`
                .blog-preview h1 { font-size: 1.6rem; font-weight: 600; margin: 0.6em 0 0.4em; font-family: var(--bb-display); }
                .blog-preview h2 { font-size: 1.3rem; font-weight: 600; margin: 0.6em 0 0.4em; font-family: var(--bb-display); }
                .blog-preview h3 { font-size: 1.1rem; font-weight: 600; margin: 0.6em 0 0.4em; }
                .blog-preview p { margin: 0.6em 0; line-height: 1.65; }
                .blog-preview ul, .blog-preview ol { padding-left: 1.5em; margin: 0.6em 0; }
                .blog-preview li { margin: 0.2em 0; }
                .blog-preview pre { background: #1a1d24; color: #e6e8eb; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: var(--bb-mono); font-size: 13px; }
                .blog-preview code { font-family: var(--bb-mono); font-size: 0.92em; background: rgba(26,29,36,0.06); padding: 1px 5px; border-radius: 3px; }
                .blog-preview pre code { background: none; padding: 0; }
                .blog-preview blockquote { border-left: 3px solid var(--bb-line-strong); padding-left: 12px; color: var(--bb-mute); margin: 0.6em 0; }
                .blog-preview a { color: #1f5fae; text-decoration: underline; }
                .blog-preview img { max-width: 100%; border-radius: 6px; margin: 0.4em 0; }
                .blog-preview table { border-collapse: collapse; margin: 0.6em 0; }
                .blog-preview th, .blog-preview td { border: 1px solid var(--bb-line); padding: 6px 10px; text-align: left; }
                .blog-preview th { background: rgba(26,29,36,0.04); font-weight: 600; }
                .blog-preview hr { border: none; border-top: 1px solid var(--bb-line); margin: 1.2em 0; }
            `}</style>
        </div>
    );
}

function extract(err: unknown): string {
    const e = err as {
        response?: { data?: { error?: string; reason?: string } };
        message?: string;
    };
    const code = e.response?.data?.error;
    if (code === 'slug_taken') return 'That slug is already in use. Pick a different one.';
    if (code === 'bad_slug') return 'Slug must be lowercase letters, digits and dashes (≤80 chars).';
    if (code === 'missing_title') return 'Title is required.';
    if (code === 'bad_type') return 'Image must be PNG, JPG, WebP, or GIF.';
    return e.response?.data?.reason ?? code ?? e.message ?? 'Unknown error';
}
