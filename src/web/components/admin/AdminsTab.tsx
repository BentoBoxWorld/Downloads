import React from 'react';
import tw from 'twin.macro';
import { SessionUser } from '../../ApiRequestManager';

export default function AdminsTab({ user: _user }: { user: SessionUser }) {
    return (
        <div>
            <h3 css={tw`text-lg font-semibold mb-2`}>Admins</h3>
            <p css={tw`text-sm text-gray-600`}>
                Promote or demote admins by Discord user ID. Coming in Stage 3.
            </p>
        </div>
    );
}
