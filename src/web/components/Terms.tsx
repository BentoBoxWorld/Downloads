import React from 'react';
import tw from 'twin.macro';

export const TERMS_VERSION = '2026-04-24';

export default function TermsPage() {
    return (
        <article css={tw`max-w-none text-gray-800`}>
            <h1 css={tw`text-3xl font-bold mb-2`}>Terms of Submission</h1>
            <p css={tw`text-sm text-gray-500 mb-6`}>Version {TERMS_VERSION}</p>

            <p css={tw`mb-3`}>
                These terms govern blueprints and other content (&ldquo;Content&rdquo;) submitted through this site. By
                submitting Content you agree to all of the following. If you do not agree, do not submit.
            </p>

            <Section title="1. Authorship and license">
                <p>
                    You represent and warrant that (a) you authored the Content yourself, or (b) you have all rights
                    necessary to redistribute it under an open-source license. You grant the BentoBoxWorld project a
                    perpetual, worldwide, irrevocable, royalty-free license to host, copy, modify, redistribute, and
                    sublicense the Content under the terms of the&nbsp;
                    <a href="https://www.eclipse.org/legal/epl-2.0/" target="_blank" rel="noopener noreferrer" css={tw`text-blue-700 underline`}>
                        Eclipse Public License 2.0
                    </a>
                    &nbsp;(or any later version of that license at our discretion).
                </p>
            </Section>

            <Section title="2. Acceptable use">
                <p>
                    Submissions must not contain malware, illegal content, content infringing the rights of third
                    parties, sexually explicit material involving minors, or content designed to harm, harass, or
                    impersonate any person or organization. We may reject, modify, or remove any submission for any
                    reason and without notice.
                </p>
            </Section>

            <Section title="3. No warranty">
                <p>
                    The site, the catalog, and any downloaded blueprints are provided &ldquo;as is&rdquo; without
                    warranty of any kind. The BentoBoxWorld project, its maintainers, and contributors are not liable
                    for any damages arising from use of the site or any submitted content.
                </p>
            </Section>

            <Section title="4. Account and data">
                <p>
                    To submit, you must sign in with Discord. We store the minimum information needed to attribute and
                    moderate submissions, as described in the&nbsp;
                    <a href="/privacy" css={tw`text-blue-700 underline`}>
                        Privacy Policy
                    </a>
                    . You may delete your account at any time from the&nbsp;
                    <a href="/account" css={tw`text-blue-700 underline`}>
                        Account
                    </a>
                    &nbsp;page.
                </p>
            </Section>

            <Section title="5. Changes">
                <p>
                    We may update these terms. The version at the top of this page increments when material changes
                    are made. The next time you submit after a change, you will be prompted to accept the new version.
                </p>
            </Section>

            <p css={tw`text-sm text-gray-500 mt-8`}>
                Questions? Contact us on the&nbsp;
                <a href="https://discord.gg/KwjFBUaNSt" target="_blank" rel="noopener noreferrer" css={tw`text-blue-700 underline`}>
                    BentoBox Discord
                </a>
                .
            </p>
        </article>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section css={tw`mb-5`}>
            <h2 css={tw`text-xl font-semibold mt-4 mb-2`}>{title}</h2>
            {children}
        </section>
    );
}
