import React, { useEffect, useRef, useState } from 'react'
import {
    Animated,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BlurView } from 'expo-blur'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface VideoThumbnailSelectorModalProps {
    visible: boolean
    onClose: () => void
    videoUri: string
    duration: number
    onSelectThumbnail: (thumbnailUri: string, timeInSeconds: number) => void
}

export function VideoThumbnailSelectorModal({
    visible,
    onClose,
    videoUri,
    duration,
    onSelectThumbnail,
}: VideoThumbnailSelectorModalProps) {
    const insets = useSafeAreaInsets()
    const slideAnim = useRef(new Animated.Value(1)).current
    const [thumbnails, setThumbnails] = useState<
        { uri: string; time: number }[]
    >([])
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (visible) {
            setSelectedIndex(null)
        }
    }, [visible])

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : 1,
            useNativeDriver: true,
            damping: 20,
            mass: 1,
            stiffness: 100,
        }).start()
    }, [visible])

    useEffect(() => {
        async function generateThumbnails() {
            setLoading(true)
            try {
                const thumbnailCount = 6 // Number of thumbnails to generate
                const interval = duration / (thumbnailCount + 1) // Time between thumbnails
                const newThumbnails: { uri: string; time: number }[] = []

                for (let i = 1; i <= thumbnailCount; i++) {
                    const time = Math.round(i * interval * 1000) // Convert to milliseconds
                    try {
                        const { uri } = await VideoThumbnails.getThumbnailAsync(
                            videoUri,
                            {
                                time,
                                quality: 0.7,
                            },
                        )
                        newThumbnails.push({ uri, time: time / 1000 }) // Convert back to seconds
                    } catch (err) {
                        console.warn(`Failed to generate thumbnail ${i}:`, err)
                    }
                }

                setThumbnails(newThumbnails)
            } catch (err) {
                console.error('Failed to generate thumbnails:', err)
            } finally {
                setLoading(false)
            }
        }

        if (visible && videoUri) {
            generateThumbnails()
        }
    }, [visible, videoUri, duration])

    const handleSelect = () => {
        if (selectedIndex !== null && thumbnails[selectedIndex]) {
            const { uri, time } = thumbnails[selectedIndex]
            onSelectThumbnail(uri, time)
            onClose()
        }
    }

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
                                        outputRange: [0, 800],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <BlurView
                        intensity={90}
                        tint="dark"
                        style={styles.blurContainer}
                    >
                        <View
                            style={[
                                styles.sheetContent,
                                { paddingBottom: insets.bottom },
                            ]}
                        >
                            <View style={styles.handle} />
                            <View style={styles.bottomSheetHeader}>
                                <Pressable
                                    onPress={onClose}
                                    style={styles.headerButton}
                                >
                                    <Text style={styles.cancelButton}>
                                        Cancel
                                    </Text>
                                </Pressable>
                                <Text style={styles.bottomSheetTitle}>
                                    Choose Thumbnail
                                </Text>
                                <Pressable
                                    onPress={handleSelect}
                                    style={[
                                        styles.headerButton,
                                        selectedIndex === null &&
                                            styles.headerButtonDisabled,
                                    ]}
                                    disabled={selectedIndex === null}
                                >
                                    <Text
                                        style={[
                                            styles.doneButton,
                                            selectedIndex === null &&
                                                styles.doneButtonDisabled,
                                        ]}
                                    >
                                        Done
                                    </Text>
                                </Pressable>
                            </View>

                            <View style={styles.content}>
                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        <MaterialCommunityIcons
                                            name="image-multiple"
                                            size={48}
                                            color="#666666"
                                        />
                                        <Text style={styles.loadingText}>
                                            Generating thumbnails...
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.thumbnailGrid}>
                                        {thumbnails.map((thumb, index) => (
                                            <Pressable
                                                key={index}
                                                onPress={() =>
                                                    setSelectedIndex(index)
                                                }
                                                style={[
                                                    styles.thumbnailContainer,
                                                    selectedIndex === index &&
                                                        styles.selectedThumbnail,
                                                ]}
                                            >
                                                <Image
                                                    source={{ uri: thumb.uri }}
                                                    style={styles.thumbnail}
                                                    resizeMode="cover"
                                                />
                                                {selectedIndex === index && (
                                                    <View
                                                        style={
                                                            styles.selectedOverlay
                                                        }
                                                    >
                                                        <MaterialCommunityIcons
                                                            name="check-circle"
                                                            size={24}
                                                            color="#FFFFFF"
                                                        />
                                                    </View>
                                                )}
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheet: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1C1C1E',
        minHeight: 400,
    },
    blurContainer: {
        flex: 1,
    },
    sheetContent: {
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
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    },
    bottomSheetTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        flex: 1,
    },
    headerButton: {
        minWidth: 60,
        height: 44,
        justifyContent: 'center',
    },
    headerButtonDisabled: {
        opacity: 0.5,
    },
    cancelButton: {
        fontSize: 17,
        color: '#FFFFFF',
    },
    doneButton: {
        fontSize: 17,
        color: '#0A84FF',
        fontWeight: '600',
        textAlign: 'right',
    },
    doneButtonDisabled: {
        opacity: 0.5,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        minHeight: 200,
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 17,
        marginTop: 16,
    },
    thumbnailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 200,
    },
    thumbnailContainer: {
        width: '31%',
        aspectRatio: 16 / 9,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#2C2C2E',
    },
    selectedThumbnail: {
        borderWidth: 2,
        borderColor: '#0A84FF',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: '#2C2C2E',
    },
    selectedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 132, 255, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
})
