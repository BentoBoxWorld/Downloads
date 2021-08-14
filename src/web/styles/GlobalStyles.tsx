import React from 'react';
import { createGlobalStyle } from 'styled-components';
import tw, { GlobalStyles as BaseStyles, theme } from 'twin.macro';

const CustomStyles = createGlobalStyle`
  body {
    -webkit-tap-highlight-color: ${theme`colors.purple.500`};
    ${tw`antialiased`};
    ${tw`md:bg-background md:bg-fixed md:bg-cover`};
  }
`;

const GlobalStyles = () => (
    <>
        <BaseStyles />
        <CustomStyles />
    </>
);

export default GlobalStyles;
