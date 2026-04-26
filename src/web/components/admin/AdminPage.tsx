import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faShieldAlt,
    faUsers,
    faCube,
    faPuzzlePiece,
    faHistory,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { GetMe, PostLogout, SessionUser } from '../../ApiRequestManager';
import RecentTab from './RecentTab';
import AdminsTab from './AdminsTab';
import PresetsTab from './PresetsTab';
import AddonsTab from './AddonsTab';

type TabId = 'recent' | 'admins' | 'presets' | 'addons';

interface TabDef {
    id: TabId;
    label: string;
    icon: IconDefinition;
}

const TABS: TabDef[] = [
    { id: 'recent', label: 'Recent', icon: faHistory },
    { id: 'admins', label: 'Admins', icon: faUsers },
    { id: 'presets', label: 'Presets', icon: faCube },
    { id: 'addons', label: 'Addons', icon: faPuzzlePiece },
];

export default function AdminPage() {
    const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
    const [tab, setTab] = useState<TabId>('recent');

    useEffect(() => {
        GetMe()
            .then(setUser)
            .catch(() => setUser(null));
    }, []);

    if (user === undefined) {
        return <div css={tw`text-center my-12 text-gray-500`}>Loading…</div>;
    }
    if (user === null) {
        return (
            <div css={tw`text-center my-12`}>
                <p css={tw`text-xl mb-2`}>You need to be logged in to access this page.</p>
                <a href="/api/auth/discord/login?return=/admin" css={tw`text-blue-700 underline`}>
                    Login with Discord
                </a>
            </div>
        );
    }
    if (!user.isAdmin) {
        return (
            <div css={tw`text-center my-12`}>
                <p css={tw`text-xl font-semibold mb-2`}>Admin access required</p>
                <p css={tw`text-gray-700 mb-4`}>
                    Your Discord account does not have admin privileges on this server.
                </p>
                <p css={tw`text-xs text-gray-500`}>Discord ID: {user.id}</p>
            </div>
        );
    }

    async function handleLogout() {
        try {
            await PostLogout(user!.csrfToken);
        } finally {
            setUser(null);
        }
    }

    return (
        <div>
            <div css={tw`flex items-center gap-3 mb-6`}>
                <FontAwesomeIcon icon={faShieldAlt} css={tw`text-2xl text-gray-700`} />
                <p css={tw`text-2xl font-semibold m-0`}>Admin</p>
                <div css={tw`ml-auto flex items-center gap-3 text-sm text-gray-600`}>
                    <span>
                        Signed in as <strong>{user.globalName || user.username}</strong>
                    </span>
                    <button
                        type="button"
                        onClick={handleLogout}
                        css={tw`text-gray-600 hover:text-gray-900 underline`}
                    >
                        Log out
                    </button>
                </div>
            </div>

            <div css={tw`flex gap-6`} style={{ alignItems: 'flex-start' }}>
                {/* Sidebar */}
                <nav
                    css={tw`bg-white rounded-md shadow-sm p-2 flex-shrink-0`}
                    style={{ width: 200 }}
                >
                    {TABS.map((t) => {
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                css={[
                                    tw`w-full flex items-center gap-3 px-3 py-2 rounded text-left text-sm`,
                                    active
                                        ? tw`bg-gray-900 text-white`
                                        : tw`text-gray-700 hover:bg-gray-100`,
                                ]}
                                style={{ border: 'none', cursor: 'pointer' }}
                            >
                                <FontAwesomeIcon icon={t.icon} style={{ width: 16 }} />
                                {t.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Body */}
                <div css={tw`flex-1 bg-white rounded-md shadow-sm p-5`} style={{ minWidth: 0 }}>
                    {tab === 'recent' && <RecentTab user={user} />}
                    {tab === 'admins' && <AdminsTab user={user} />}
                    {tab === 'presets' && <PresetsTab user={user} />}
                    {tab === 'addons' && <AddonsTab user={user} />}
                </div>
            </div>
        </div>
    );
}
