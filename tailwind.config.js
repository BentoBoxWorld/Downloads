module.exports = {
    purge: [],
    darkMode: false, // or 'media' or 'class'
    theme: {
        extend: {
            backgroundImage: () => ({
                background: "url('/back.jpg')",
            }),
            height: () => ({
                content: 'fit-content',
            }),
            minWidth: {
                '1/4': '25%',
                '3/8': '37.5%',
                '1/2': '50%',
                '3/4': '75%',
                card: 'max(250px, 37.5%)',
                60: '15rem',
                26: '6.5rem',
            },
            minHeight: {
                60: '15rem',
            },
        },
        minHeight: {
            0: '0',
            '1/4': '25%',
            '3/8': '37.5%',
            '1/2': '50%',
            '3/4': '75%',
            card: 'max(250px, 37.5%)',
            full: '100%',
            screen: '100vh',
        },
    },
    variants: {
        extend: {},
    },
    plugins: [require('@tailwindcss/custom-forms')],
};
