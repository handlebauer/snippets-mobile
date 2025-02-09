import React, { useEffect, useRef } from 'react'
import {
    Animated,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BlurView } from 'expo-blur'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface Bookmark {
    id: string
    timestamp: number
    label?: string
    createdAt: string
}

interface VideoBookmarksModalProps {
    visible: boolean
    onClose: () => void
    bookmarks: Bookmark[]
    onAddBookmark: () => void
    onDeleteBookmark: (id: string) => void
    onSeekToBookmark: (timestamp: number) => void
}

function formatTimestamp(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = (seconds % 60).toFixed(1)
    const formattedSeconds = remainingSeconds.padStart(4, '0')
    return `${minutes}:${formattedSeconds}`
}

export function VideoBookmarksModal({
    visible,
    onClose,
    bookmarks,
    onAddBookmark,
    onDeleteBookmark,
    onSeekToBookmark,
}: VideoBookmarksModalProps) {
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
                                Bookmarks
                            </Text>
                            <Pressable
                                style={styles.addButton}
                                onPress={onAddBookmark}
                            >
                                <Text style={styles.addButtonText}>Add</Text>
                            </Pressable>
                        </View>

                        <FlatList
                            data={bookmarks}
                            keyExtractor={item => item.id}
                            style={styles.bookmarksList}
                            contentContainerStyle={styles.bookmarksListContent}
                            showsVerticalScrollIndicator={true}
                            bounces={true}
                            ListEmptyComponent={
                                <View style={styles.emptyBookmarksList}>
                                    <Text style={styles.emptyBookmarksText}>
                                        No bookmarks yet
                                    </Text>
                                    <Text style={styles.emptyBookmarksSubtext}>
                                        Tap Add to create a bookmark
                                    </Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <Pressable
                                    onPress={() =>
                                        onSeekToBookmark(item.timestamp)
                                    }
                                    style={({ pressed }) => [
                                        styles.bookmarksItem,
                                        pressed && styles.bookmarksItemPressed,
                                    ]}
                                >
                                    <View style={styles.bookmarksItemInfo}>
                                        <MaterialCommunityIcons
                                            name="bookmark"
                                            size={20}
                                            color="#0A84FF"
                                        />
                                        <Text style={styles.bookmarksTimestamp}>
                                            {formatTimestamp(item.timestamp)}
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={() =>
                                            onDeleteBookmark(item.id)
                                        }
                                        style={styles.bookmarksDeleteButton}
                                        hitSlop={8}
                                    >
                                        <MaterialCommunityIcons
                                            name="delete-outline"
                                            size={20}
                                            color="#FF453A"
                                        />
                                    </Pressable>
                                </Pressable>
                            )}
                        />
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
        minHeight: 400,
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
    addButton: {
        minWidth: 60,
        height: 44,
        justifyContent: 'center',
        marginTop: 4,
    },
    addButtonText: {
        color: '#0A84FF',
        fontSize: 17,
    },
    bookmarksList: {
        flex: 1,
    },
    bookmarksListContent: {
        paddingHorizontal: 16,
    },
    bookmarksItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        marginBottom: 8,
    },
    bookmarksItemPressed: {
        opacity: 0.7,
    },
    bookmarksItemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bookmarksTimestamp: {
        color: '#FFFFFF',
        fontSize: 17,
    },
    bookmarksDeleteButton: {
        padding: 8,
    },
    emptyBookmarksList: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyBookmarksText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyBookmarksSubtext: {
        color: '#8E8E93',
        fontSize: 15,
        textAlign: 'center',
    },
})
