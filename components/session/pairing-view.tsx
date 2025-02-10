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
    icon: 'code-braces' | 'laptop'
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

        if (statusMessage && statusMessage !== 'Web client connected') {
            spinAnimation.start()
        } else {
            spinAnimation.stop()
        }

        return () => spinAnimation.stop()
    }, [statusMessage, spinValue])

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    })

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                <View style={styles.contentContainer}>
                    <View style={styles.card}>
                        <MaterialCommunityIcons
                            name={icon}
                            size={48}
                            color="#FFFFFF"
                            style={styles.icon}
                        />
                        <Text variant="titleLarge" style={styles.title}>
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
                                            size={14}
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
                                                size={14}
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

                        <View style={styles.urlContainer}>
                            <MaterialCommunityIcons
                                name="link"
                                size={20}
                                color="#CCCCCC"
                            />
                            <Text style={styles.urlText}>
                                Enter this code at:
                            </Text>
                        </View>
                        <Text style={styles.url}>https://snippet.is</Text>

                        {statusMessage === STATUS_MESSAGES.ENDED && (
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
            </View>
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
        paddingHorizontal: 16,
    },
    card: {
        width: '100%',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 24,
    },
    icon: {
        marginVertical: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 24,
        marginBottom: 20,
        fontWeight: '600',
    },
    codeContainer: {
        backgroundColor: '#2A2A2A',
        padding: 20,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
        marginVertical: 16,
    },
    codeText: {
        color: '#FFFFFF',
        fontSize: 42,
        fontWeight: '600',
        letterSpacing: 2,
        marginBottom: 12,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: 0.5,
    },
    statusText: {
        color: '#CCCCCC',
        fontSize: 14,
    },
    statusTextSuccess: {
        color: '#CCCCCC',
        opacity: 1,
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 32,
        gap: 8,
        opacity: 0.5,
    },
    urlText: {
        color: '#CCCCCC',
        fontSize: 14,
    },
    url: {
        color: '#FFFFFF',
        marginTop: 4,
        fontSize: 14,
        fontWeight: '500',
    },
    button: {
        marginTop: 32,
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonContent: {
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    description: {
        color: '#CCCCCC',
        fontSize: 14,
        marginTop: 8,
    },
})
