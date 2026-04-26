import React from 'react';
import tw from 'twin.macro';

export default function PrivacyPage() {
    return (
        <article css={tw`max-w-none text-gray-800`}>
            <h1 css={tw`text-3xl font-bold mb-2`}>Privacy Policy</h1>
            <p css={tw`text-sm text-gray-500 mb-6`}>Last updated: 2026-04-24</p>

            <Section title="What we store">
                <ul css={tw`list-disc ml-6`}>
                    <li>Your Discord user ID, username, current display name, and avatar hash (for attribution).</li>
                    <li>A session identifier linked to your account, with creation/expiry timestamps.</li>
                    <li>
                        For each submission you make: your Discord user ID, the submission timestamp, the version of
                        the Terms you accepted, and the URL of the resulting pull request on{' '}
                        <a
                            href="https://github.com/BentoBoxWorld/weblink"
                            target="noopener"
                            css={tw`text-blue-700 underline`}
                        >
                            BentoBoxWorld/weblink
                        </a>
                        .
                    </li>
                </ul>
                <p css={tw`mt-2`}>
                    We do <strong>not</strong> request or store your email address. Discord login uses the{' '}
                    <code>identify</code> scope only. We do not request or store any other Discord data (servers,
                    messages, friends, etc.).
                </p>
            </Section>

            <Section title="What we share">
                <p>
                    Your Discord user ID is included in the body of the public pull request opened when you submit a
                    blueprint, so a maintainer can credit you and contact you on Discord for clarification. The pull
                    request and its history live on GitHub and are subject to GitHub&rsquo;s own terms.
                </p>
                <p css={tw`mt-2`}>We do not share or sell your information for any other purpose.</p>
            </Section>

            <Section title="California (CCPA) and other deletion rights">
                <p>
                    You may delete your account at any time from the&nbsp;
                    <a href="/account" css={tw`text-blue-700 underline`}>
                        Account
                    </a>
                    &nbsp;page. Deletion removes your user record, all sessions, and the local index of submissions
                    you have made. It does <strong>not</strong> retract pull requests already opened on weblink, since
                    those are public artefacts hosted on GitHub. If you need a pull request itself removed, contact us
                    on the BentoBox Discord and we will do our best to accommodate the request.
                </p>
                <p css={tw`mt-2`}>
                    California residents have the right under the CCPA to know what personal information we hold and
                    to request its deletion. The two paragraphs above describe our complete data holdings and our
                    deletion process.
                </p>
            </Section>

            <Section title="Cookies">
                <p>
                    We set one essential, HttpOnly session cookie when you log in, plus a short-lived cookie holding
                    the OAuth state for the duration of the Discord login redirect. We do not use analytics or
                    tracking cookies.
                </p>
            </Section>
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
