import React, { useEffect, useRef } from 'react'
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BlurView } from 'expo-blur'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import type { VideoMetadata } from '@/types/webrtc'

interface VideoMetadataModalProps {
    visible: boolean
    onClose: () => void
    video: VideoMetadata
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`
    } else if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    } else {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
}

export function VideoMetadataModal({
    visible,
    onClose,
    video,
}: VideoMetadataModalProps) {
    const insets = useSafeAreaInsets()
    const slideAnim = useRef(new Animated.Value(0)).current

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : 1,
            useNativeDriver: true,
            damping: 15,
        }).start()
    }, [visible])

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="none"
            presentationStyle="overFullScreen"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.modalContainer}>
                <Pressable style={styles.modalOverlay} onPress={onClose} />
                <Animated.View
                    style={[
                        styles.bottomSheet,
                        {
                            transform: [
                                {
                                    translateY: slideAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 300],
                                    }),
                                },
                            ],
                            paddingBottom: insets.bottom,
                        },
                    ]}
                >
                    <BlurView
                        intensity={90}
                        tint="dark"
                        style={styles.bottomSheet}
                    >
                        <View style={styles.handle} />
                        <View style={styles.bottomSheetHeader}>
                            <View style={styles.headerLeft} />
                            <Text style={styles.bottomSheetTitle}>
                                Video Details
                            </Text>
                            <View style={styles.headerRight} />
                        </View>

                        <View style={styles.metadataList}>
                            <View style={styles.metadataRow}>
                                <MaterialCommunityIcons
                                    name="clock-outline"
                                    size={22}
                                    color="#0A84FF"
                                />
                                <View style={styles.metadataTextContainer}>
                                    <Text style={styles.metadataLabel}>
                                        Duration
                                    </Text>
                                    <Text style={styles.metadataValue}>
                                        {Math.round(video.duration)}s
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.metadataRow}>
                                <MaterialCommunityIcons
                                    name="file-outline"
                                    size={22}
                                    color="#0A84FF"
                                />
                                <View style={styles.metadataTextContainer}>
                                    <Text style={styles.metadataLabel}>
                                        Size
                                    </Text>
                                    <Text style={styles.metadataValue}>
                                        {formatFileSize(video.size)}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.metadataRow}>
                                <MaterialCommunityIcons
                                    name="calendar-outline"
                                    size={22}
                                    color="#0A84FF"
                                />
                                <View style={styles.metadataTextContainer}>
                                    <Text style={styles.metadataLabel}>
                                        Created
                                    </Text>
                                    <Text style={styles.metadataValue}>
                                        {new Date(
                                            video.created_at,
                                        ).toLocaleDateString()}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </BlurView>
                </Animated.View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    bottomSheet: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        maxHeight: '80%',
        minHeight: 300,
        overflow: 'hidden',
        paddingTop: 12,
    },
    handle: {
        width: 36,
        height: 5,
        backgroundColor: '#808080',
        borderRadius: 2.5,
        marginTop: 8,
        marginBottom: 20,
        alignSelf: 'center',
    },
    bottomSheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    bottomSheetTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        flex: 1,
        marginTop: 4,
    },
    headerLeft: {
        minWidth: 60,
        height: 44,
        marginTop: 4,
    },
    headerRight: {
        minWidth: 60,
        height: 44,
        marginTop: 4,
    },
    metadataList: {
        paddingHorizontal: 16,
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        minHeight: 44,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    },
    metadataTextContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginLeft: 12,
    },
    metadataLabel: {
        color: '#FFFFFF',
        fontSize: 17,
    },
    metadataValue: {
        color: '#8E8E93',
        fontSize: 17,
    },
})
