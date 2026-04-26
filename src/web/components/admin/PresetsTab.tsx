import React from 'react';
import tw from 'twin.macro';
import { SessionUser } from '../../ApiRequestManager';

export default function PresetsTab({ user: _user }: { user: SessionUser }) {
    return (
        <div>
            <h3 css={tw`text-lg font-semibold mb-2`}>Presets</h3>
            <p css={tw`text-sm text-gray-600`}>
                Reorder and edit the presets shown on the home page. Coming in Stage 4.
            </p>
        </div>
    );
}
