import React from 'react';
import tw from 'twin.macro';
import { SessionUser } from '../../ApiRequestManager';

export default function AddonsTab({ user: _user }: { user: SessionUser }) {
    return (
        <div>
            <h3 css={tw`text-lg font-semibold mb-2`}>Addons</h3>
            <p css={tw`text-sm text-gray-600`}>
                Add, edit, and remove addons. Each addon also has a Versions tab for its per-Minecraft-version mappings.
                Coming in Stages 5–6.
            </p>
        </div>
    );
}
