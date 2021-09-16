import React from 'react';
import tw from 'twin.macro';
import { ThirdParty } from '../../config';
import { css } from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { useForm } from 'react-hook-form';

export default function PresetsPage({ data }: { data: ThirdParty }) {
    const { register, watch } = useForm();

    const filter = watch('tag');

    return (
        <>
            <div css={tw`bg-yellow-400 rounded-lg p-3 mx-auto my-2 text-black text-center`}>
                <p css={tw`text-2xl font-semibold`}>Third Party Mods</p>
                <p css={tw`text-lg`}>These are not affiliated with BentoBox, or the BentoBox Team.</p>
                <p css={tw`text-sm`}>
                    Want to add your own? Make A PR to&nbsp;
                    <a href={'https://github.com/BentoBoxWorld/Downloads'}>BentoBoxWorld/Downloads</a>
                </p>
            </div>
            <div>
                Filter By Tag:&nbsp;
                <select {...register('tag', { required: true })}>
                    <option value={'none'}>none</option>
                    {Object.keys(data.tags)
                        .sort()
                        .map((tag) => (
                            <option key={tag} value={tag}>
                                {tag}
                            </option>
                        ))}
                </select>
            </div>
            <ul
                css={css`
                    li {
                        ${tw`p-1`}
                    }
                `}
            >
                <div css={tw`p-4 grid gap-3 auto-rows-max grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-row`}>
                    {Object.keys(data.addons)
                        .sort()
                        .filter((a) => filter === 'none' || !filter || data.addons[a].Tags?.includes(filter))
                        .map((a) => {
                            const addon = data.addons[a];
                            return (
                                <div key={a} css={tw`p-2 bg-white rounded-md shadow-sm text-center min-h-60`}>
                                    <div css={tw`mt-4 mb-1`}>
                                        <a href={addon.Releases} target={'noopener'}>
                                            <FontAwesomeIcon icon={faExternalLinkAlt} size={'lg'} />
                                            <p css={tw`font-bold text-lg inline mb-1`}>&nbsp;{a}</p>
                                        </a>
                                    </div>
                                    <br />
                                    <a href={addon.AuthorLink} css={tw`ml-auto`}>
                                        <p css={tw`font-bold inline`}>Author:&nbsp;</p>
                                        {addon.Author}
                                    </a>
                                    <div css={tw`m-2`}>{addon.Description}</div>
                                    {addon.Tags && (
                                        <div>
                                            {addon.Tags.sort().map((tag) => (
                                                <div
                                                    key={tag}
                                                    css={css`
                                                        ${tw`rounded-lg text-white font-bold w-max px-2 mx-1 my-1 inline`}
                                                        background-color: ${data.tags[tag].color}
                                                    `}
                                                    title={data.tags[tag].description}
                                                >
                                                    {tag}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {(addon.Github || addon.Issues) && (
                                        <div css={tw`flex space-x-3 justify-center`}>
                                            {addon.Github && (
                                                <a href={addon.Github} target={'noopener'}>
                                                    <FontAwesomeIcon icon={faGithub} />
                                                </a>
                                            )}
                                            {addon.Issues && (
                                                <a href={addon.Issues} target={'noopener'}>
                                                    <FontAwesomeIcon icon={faBug} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </ul>
        </>
    );
}
