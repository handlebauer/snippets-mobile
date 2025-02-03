export default {
    expo: {
        name: 'snippets',
        slug: 'snippets',
        version: '0.0.1',
        orientation: 'portrait',
        icon: './assets/images/icon.png',
        newArchEnabled: true,
        scheme: 'myapp',
        userInterfaceStyle: 'automatic',
        splash: {
            image: './assets/images/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff',
        },
        ios: {
            supportsTablet: true,
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/images/adaptive-icon.png',
                backgroundColor: '#ffffff',
            },
        },
        web: {
            bundler: 'metro',
            output: 'single',
            favicon: './assets/images/favicon.png',
        },
        plugins: ['expo-router'],
        experiments: {
            typedRoutes: true,
            reactServerFunctions: true,
        },
        extra: {
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        },
    },
}
