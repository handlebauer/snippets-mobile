import React from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { Button, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { STATUS_MESSAGES } from '@/constants/webrtc'

interface PairingViewProps {
    sessionCode: string | null
    statusMessage: string | null
    onReset: () => void
    icon: 'code-tags' | 'code-braces' | 'laptop'
    title: string
    description?: string
}

export function PairingView({
    sessionCode,
    statusMessage,
    onReset,
    icon,
    title,
    description,
}: PairingViewProps) {
    const spinValue = React.useRef(new Animated.Value(0)).current
    const fadeAnim = React.useRef(new Animated.Value(0)).current

    // Set up spinning animation for the loading icon
    React.useEffect(() => {
        const spinAnimation = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        )

        // Fade in animation
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start()

        if (statusMessage && statusMessage !== 'Web client connected') {
            spinAnimation.start()
        } else {
            spinAnimation.stop()
        }

        return () => spinAnimation.stop()
    }, [statusMessage, spinValue, fadeAnim])

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    })

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                <View style={styles.contentContainer}>
                    <View style={styles.card}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons
                                name={icon}
                                size={36}
                                color="#FFFFFF"
                                style={styles.icon}
                            />
                        </View>

                        <Text variant="titleMedium" style={styles.title}>
                            {title}
                        </Text>

                        <View style={styles.codeContainer}>
                            <Text
                                variant="headlineLarge"
                                style={styles.codeText}
                            >
                                {sessionCode}
                            </Text>
                            {statusMessage && (
                                <View style={styles.statusContainer}>
                                    {statusMessage ===
                                    'Web client connected' ? (
                                        <MaterialCommunityIcons
                                            name="check-circle"
                                            size={16}
                                            color="#22C55E"
                                        />
                                    ) : (
                                        <Animated.View
                                            style={{
                                                transform: [{ rotate: spin }],
                                            }}
                                        >
                                            <MaterialCommunityIcons
                                                name="loading"
                                                size={16}
                                                color="#CCCCCC"
                                            />
                                        </Animated.View>
                                    )}
                                    <Text
                                        style={[
                                            styles.statusText,
                                            statusMessage ===
                                                'Web client connected' &&
                                                styles.statusTextSuccess,
                                        ]}
                                    >
                                        {statusMessage}
                                    </Text>
                                </View>
                            )}
                            {description && (
                                <Text style={styles.description}>
                                    {description}
                                </Text>
                            )}
                        </View>

                        <View style={styles.footer}>
                            <View style={styles.urlContainer}>
                                <MaterialCommunityIcons
                                    name="link"
                                    size={16}
                                    color="#CCCCCC"
                                />
                                <Text style={styles.urlText}>
                                    Enter this code at:
                                </Text>
                            </View>
                            <Text style={styles.url}>
                                snippets-connect.vercel.app
                            </Text>

                            {statusMessage === STATUS_MESSAGES.ENDED && (
                                <Button
                                    mode="outlined"
                                    onPress={onReset}
                                    style={styles.button}
                                    contentStyle={styles.buttonContent}
                                    labelStyle={styles.buttonLabel}
                                >
                                    New Session
                                </Button>
                            )}
                        </View>
                    </View>
                </View>
            </Animated.View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        width: '100%',
    },
    container: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
    contentContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#2A2A2A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    icon: {
        opacity: 0.9,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        marginBottom: 20,
        fontWeight: '600',
        textAlign: 'center',
    },
    codeContainer: {
        backgroundColor: '#2A2A2A',
        padding: 20,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginBottom: 20,
    },
    codeText: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '600',
        letterSpacing: 3,
        marginBottom: 12,
        fontFamily: 'System',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: 0.8,
    },
    statusText: {
        color: '#CCCCCC',
        fontSize: 14,
        fontWeight: '500',
    },
    statusTextSuccess: {
        color: '#22C55E',
    },
    description: {
        color: '#CCCCCC',
        fontSize: 13,
        marginTop: 12,
        textAlign: 'center',
    },
    footer: {
        width: '100%',
        alignItems: 'center',
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: 0.7,
    },
    urlText: {
        color: '#CCCCCC',
        fontSize: 13,
    },
    url: {
        color: '#FFFFFF',
        marginTop: 4,
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    button: {
        marginTop: 24,
        width: '100%',
        borderRadius: 10,
        borderColor: '#3A3A3A',
        overflow: 'hidden',
    },
    buttonContent: {
        paddingVertical: 8,
    },
    buttonLabel: {
        fontSize: 15,
        letterSpacing: 0.3,
        fontWeight: '500',
    },
})
