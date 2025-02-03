/** @type {import('prettier').Config} */
module.exports = {
    plugins: ['@ianvs/prettier-plugin-sort-imports'],
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 80,
    tabWidth: 4,
    arrowParens: 'avoid',
    semi: false,

    // Sort imports at the top of files
    importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
    importOrderTypeScriptVersion: '5.0.0',
    importOrder: [
        '^react',
        '^(react/(.*)$)|^(react   $)',
        '^react-native',
        '^(react-native/(.*)$)|^(react-native   $)',
        '^expo',
        '^(expo/(.*)$)|^(expo   $)',
        '<THIRD_PARTY_MODULES>',
        '',
        '^@/lib/(.*)$',
        '^@/components/.+/(.*)$',
        '^@/hooks/(.*)$',
        '',
        '^[./]',
        '',
        '<TYPES>',
        '<TYPES>^[.]',
    ],
}
