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
            bundleIdentifier: 'is.project.snippets',
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
            // [
            //     'expo-splash-screen',
            //     {
            //         backgroundColor: '#1c1c1e',
            //         image: './assets/images/splash-icon.png',
            //     },
            // ],
        ],
        experiments: {
            typedRoutes: true,
            reactServerFunctions: true,
        },
        extra: {
            supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
            supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
            githubOAuthClientId: process.env.GITHUB_APP_CLIENT_ID,
            githubOAuthClientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
            apiUrl: process.env.API_URL,
            eas: {
                projectId: 'abd6e45d-9048-467e-a2c9-597877588671',
            },
        },
    },
}
