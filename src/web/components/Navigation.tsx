import { useLocation } from 'react-router';
import tw from 'twin.macro';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faWrench } from '@fortawesome/free-solid-svg-icons';
import React, { useEffect } from 'react';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';

export default function Navigation() {
    const location = useLocation();

    useEffect(() => {}, [location]);

    return (
        <header>
            <ul css={tw`flex flex-row flex-wrap w-full justify-center`}>
                <li>
                    <div
                        css={`
                            ${tw`m-2 w-24 h-10 hover:text-blue-500 focus:outline-none focus:border-none text-center`}
                            ${window.location.pathname === '/' &&
                            tw`text-blue-700 border-0 border-b border-solid border-blue-700`}
                        `}
                    >
                        <NavLink to={'/'}>
                            <FontAwesomeIcon icon={faImage} />
                            &nbsp;Presets
                        </NavLink>
                    </div>
                </li>
                <li>
                    <div
                        css={`
                            ${tw`m-2 w-24 h-10 hover:text-blue-500 focus:outline-none focus:border-none text-center`}
                            ${window.location.pathname === '/custom' &&
                            tw`text-blue-700 border-0 border-b border-solid border-blue-700`}
                        `}
                    >
                        <NavLink to={'/custom'}>
                            <FontAwesomeIcon icon={faWrench} />
                            &nbsp;Custom
                        </NavLink>
                    </div>
                </li>
                <li>
                    <div css={tw`m-2 w-24 h-10 hover:text-blue-500 focus:outline-none focus:border-none text-center`}>
                        <a href={'https://discord.gg/KwjFBUaNSt'}>
                            <FontAwesomeIcon icon={faDiscord} />
                            &nbsp;Discord
                        </a>
                    </div>
                </li>
            </ul>
        </header>
    );
}
