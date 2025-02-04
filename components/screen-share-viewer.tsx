import React from 'react'
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native'
import { Button, Text, useTheme } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RTCView } from 'react-native-webrtc'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { STATUS_MESSAGES } from '@/constants/webrtc'

import type { ScreenShareState } from '@/types/webrtc'

interface ScreenShareViewerProps {
    state: ScreenShareState
    onStartSession: () => void
    onReset: () => void
}

export function ScreenShareViewer({
    state,
    onStartSession,
    onReset,
}: ScreenShareViewerProps) {
    const theme = useTheme()
    const spinValue = React.useRef(new Animated.Value(0)).current

    React.useEffect(() => {
        const spinAnimation = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        )

        if (state.statusMessage) {
            spinAnimation.start()
        } else {
            spinAnimation.stop()
        }

        return () => spinAnimation.stop()
    }, [state.statusMessage])

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    })

    if (!state.sessionCode) {
        return (
            <SafeAreaView
                style={[
                    styles.safeArea,
                    { backgroundColor: theme.colors.background },
                ]}
                edges={['top']}
            >
                <View style={styles.container}>
                    <View style={styles.contentContainer}>
                        <MaterialCommunityIcons
                            name="laptop"
                            size={48}
                            color={theme.colors.onBackground}
                            style={styles.icon}
                        />
                        <Text
                            variant="headlineSmall"
                            style={[
                                styles.title,
                                { color: theme.colors.onBackground },
                            ]}
                        >
                            Connect Ddevice
                        </Text>
                        <Text
                            variant="bodyLarge"
                            style={[
                                styles.subtitle,
                                { color: theme.colors.onSurfaceVariant },
                            ]}
                        >
                            Enter this code in the companion web app to connect
                            your device
                        </Text>
                        <Button
                            mode="contained"
                            onPress={onStartSession}
                            style={styles.button}
                            contentStyle={styles.buttonContent}
                        >
                            Start
                        </Button>
                    </View>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView
            style={[
                styles.safeArea,
                { backgroundColor: theme.colors.background },
            ]}
            edges={['top']}
        >
            <View style={styles.container}>
                <View style={styles.contentContainer}>
                    <MaterialCommunityIcons
                        name="laptop"
                        size={48}
                        color={theme.colors.onBackground}
                        style={styles.icon}
                    />
                    <Text
                        variant="headlineSmall"
                        style={[
                            styles.title,
                            { color: theme.colors.onBackground },
                        ]}
                    >
                        Connect Device
                    </Text>

                    <View
                        style={[
                            styles.codeCard,
                            { backgroundColor: theme.dark ? '#000' : '#fff' },
                        ]}
                    >
                        <Text
                            variant="headlineMedium"
                            style={[
                                styles.codeText,
                                { color: theme.colors.onBackground },
                            ]}
                        >
                            {state.sessionCode}
                        </Text>
                        {state.statusMessage && (
                            <View style={styles.statusContainer}>
                                <Animated.View
                                    style={{ transform: [{ rotate: spin }] }}
                                >
                                    <MaterialCommunityIcons
                                        name="loading"
                                        size={14}
                                        color={theme.colors.onSurfaceVariant}
                                    />
                                </Animated.View>
                                <Text
                                    variant="bodyMedium"
                                    style={[
                                        styles.statusText,
                                        {
                                            color: theme.colors
                                                .onSurfaceVariant,
                                        },
                                    ]}
                                >
                                    Waiting for connection...
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.urlContainer}>
                        <MaterialCommunityIcons
                            name="link"
                            size={20}
                            color={theme.colors.onSurfaceVariant}
                            style={styles.linkIcon}
                        />
                        <Text
                            variant="bodyMedium"
                            style={[
                                styles.urlText,
                                { color: theme.colors.onSurfaceVariant },
                            ]}
                        >
                            Open this URL in your browser:
                        </Text>
                    </View>
                    <Text
                        variant="bodyMedium"
                        style={[styles.url, { color: theme.colors.primary }]}
                    >
                        https://snippet.is
                    </Text>

                    {(state.statusMessage === STATUS_MESSAGES.ENDED ||
                        !state.streamURL) && (
                        <Button
                            mode="outlined"
                            onPress={onReset}
                            style={styles.button}
                            contentStyle={styles.buttonContent}
                        >
                            New Session
                        </Button>
                    )}
                </View>
            </View>

            {state.streamURL && (
                <View style={styles.streamContainer}>
                    <RTCView
                        streamURL={state.streamURL}
                        style={styles.stream}
                        objectFit="contain"
                    />
                </View>
            )}
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    contentContainer: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        alignSelf: 'center',
    },
    icon: {
        marginBottom: 24,
    },
    title: {
        textAlign: 'center',
        fontWeight: '600',
        marginBottom: 12,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 32,
        paddingHorizontal: 24,
    },
    codeCard: {
        width: '100%',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    codeText: {
        fontSize: 36,
        fontWeight: '600',
        letterSpacing: 2,
        marginBottom: 16,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 4,
    },
    statusText: {
        opacity: 0.7,
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 32,
        gap: 8,
    },
    linkIcon: {
        opacity: 0.7,
    },
    urlText: {
        opacity: 0.7,
    },
    url: {
        marginTop: 4,
        fontWeight: '500',
    },
    button: {
        marginTop: 32,
        minWidth: 140,
    },
    buttonContent: {
        paddingVertical: 8,
        paddingHorizontal: 24,
    },
    streamContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
    },
    stream: {
        flex: 1,
    },
})
