import React from 'react';
import tw from 'twin.macro';
import ReactMarkdown from 'react-markdown';
import { PremadeCardType } from '../web';
import remarkBreaks from 'remark-breaks';

export default function PremadeCard(props: PremadeCardType) {
    const { addons, color, description, name, subtext, dependencies, dependencyText } = props;

    if (!addons) return <></>;

    const addonsList = addons.map((addon) => {
        return <li key={addon}>{addon}</li>;
    });

    let pluginsList: JSX.Element[] | null = null;

    if (dependencies) {
        pluginsList = dependencies.map((addon) => {
            return <li key={addon}>{addon}</li>;
        });
    }

    return (
        <div
            css={`
                background-color: ${color};
                ${tw`m-3 inline-flex flex-col items-center justify-start flex-1 h-auto w-full p-4 rounded-lg min-w-card text-gray-700`};
            `}
        >
            <p css={tw`w-full text-2xl font-semibold`}>{name}</p>
            <div css={tw`w-full pb-5 text-lg tracking-wide leading-tight`}>
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>{description}</ReactMarkdown>
            </div>
            <div css={tw`w-full pb-2 text-sm tracking-wide leading-tight`}>
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>{subtext}</ReactMarkdown>
            </div>
            <ul css={tw`w-full pb-6 text-sm tracking-wide leading-tight list-inside list-disc`}>{addonsList}</ul>
            {pluginsList && dependencyText && (
                <>
                    <div css={tw`w-full pb-2 text-sm tracking-wide leading-tight`}>
                        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{dependencyText}</ReactMarkdown>
                    </div>
                    <ul css={tw`w-full pb-6 text-sm tracking-wide leading-tight list-inside list-disc`}>
                        {pluginsList}
                    </ul>
                </>
            )}
            <div css={tw`rounded mr-auto mt-auto flex flex-row`}>
                <div css={tw`opacity-95 border rounded-lg border-gray-700 px-4`}>
                    <a
                        css={tw`m-auto inset-0 text-sm font-medium leading-normal text-center py-2`}
                        href={`/api/generate?downloads=${encodeURI(
                            '[' + addons.map((a) => '"' + a + '"').join(',') + ']',
                        )}`}
                    >
                        Download
                    </a>
                </div>
                <div css={tw`opacity-95 border rounded-lg border-gray-700 px-4 ml-3`}>
                    <a
                        css={tw`m-auto inset-0 text-sm font-medium leading-normal text-center py-2`}
                        href={`/custom#${encodeURI('[' + addons.map((a) => '"' + a + '"').join(',') + ']')}`}
                    >
                        Customize
                    </a>
                </div>
            </div>
        </div>
    );
}
