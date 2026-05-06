import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface GiscusConfig {
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
    mapping: string;
    theme: string;
}

/** Embeds the Giscus comments widget. The component is a no-op when the
 *  server returns null from /api/blog/comments-config (i.e. no env.giscus). */
export default function Giscus({ slug }: { slug: string }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [config, setConfig] = useState<GiscusConfig | null>(null);

    useEffect(() => {
        let cancelled = false;
        axios
            .get('/api/blog/comments-config')
            .then((r) => {
                if (!cancelled) setConfig(r.data || null);
            })
            .catch(() => {
                if (!cancelled) setConfig(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!ref.current || !config) return;
        const container = ref.current;
        // Wipe any prior iframe (slug change → fresh widget).
        container.innerHTML = '';
        const s = document.createElement('script');
        s.src = 'https://giscus.app/client.js';
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-repo', config.repo);
        s.setAttribute('data-repo-id', config.repoId);
        s.setAttribute('data-category', config.category);
        s.setAttribute('data-category-id', config.categoryId);
        s.setAttribute('data-mapping', config.mapping);
        s.setAttribute('data-strict', '0');
        s.setAttribute('data-reactions-enabled', '1');
        s.setAttribute('data-emit-metadata', '0');
        s.setAttribute('data-input-position', 'bottom');
        s.setAttribute('data-theme', config.theme);
        s.setAttribute('data-lang', 'en');
        s.setAttribute('data-loading', 'lazy');
        container.appendChild(s);
        return () => {
            container.innerHTML = '';
        };
    }, [config, slug]);

    if (!config) return null;
    return (
        <section style={{ marginTop: 40 }}>
            <h2
                className="bb-display"
                style={{ fontSize: 22, marginBottom: 16, fontWeight: 600 }}
            >
                Comments
            </h2>
            <div ref={ref} />
        </section>
    );
}
