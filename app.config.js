export default {
    expo: {
        name: 'snippets',
        slug: 'snippets',
        version: '0.0.1',
        icon: './assets/images/icon.png',
        newArchEnabled: true,
        scheme: 'snippets',
        userInterfaceStyle: 'automatic',
        splash: {
            image: './assets/images/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff',
        },
        ios: {
            bundleIdentifier: 'change-when-ready',
            usesAppleSignIn: true,
            supportsTablet: true,
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false,
            },
            requireFullScreen: true,
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
        plugins: [
            'expo-router',
            'expo-apple-authentication',
            '@config-plugins/react-native-webrtc',
            'expo-video',
            [
                'expo-screen-orientation',
                {
                    initialOrientation: 'DEFAULT',
                },
            ],
        ],
        bundleIdentifier: 'change-when-ready',
        experiments: {
            typedRoutes: true,
            reactServerFunctions: true,
        },
        extra: {
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
            openshotAccessKey: process.env.OPENSHOT_ACCESS_KEY,
            openshotBaseUrl: process.env.OPENSHOT_BASE_URL,
            eas: {
                projectId: 'abd6e45d-9048-467e-a2c9-597877588671',
            },
        },
    },
}
