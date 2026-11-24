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
export default function Giscus({ slug }: Readonly<{ slug: string }>) {
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
        s.dataset.repo = config.repo;
        s.dataset.repoId = config.repoId;
        s.dataset.category = config.category;
        s.dataset.categoryId = config.categoryId;
        s.dataset.mapping = config.mapping;
        s.dataset.strict = '0';
        s.dataset.reactionsEnabled = '1';
        s.dataset.emitMetadata = '0';
        s.dataset.inputPosition = 'bottom';
        s.dataset.theme = config.theme;
        s.dataset.lang = 'en';
        s.dataset.loading = 'lazy';
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
