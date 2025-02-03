module.exports = {
    extends: ['expo', 'prettier'],
    plugins: ['prettier'],
    rules: {
        'prettier/prettier': 'error',
        'no-unused-vars': 'error',
    },
    ignorePatterns: ['node_modules', 'dist', 'build', 'public', '__tests__'],
}
