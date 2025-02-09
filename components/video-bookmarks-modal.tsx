import React, { useEffect, useRef, useState } from 'react'
import {
    Animated,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    TextInput,
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
    onUpdateBookmark?: (id: string, label: string) => void
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
    onUpdateBookmark,
}: VideoBookmarksModalProps) {
    const insets = useSafeAreaInsets()
    const slideAnim = useRef(new Animated.Value(0)).current
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingLabel, setEditingLabel] = useState('')
    const inputRef = useRef<TextInput>(null)

    const handlePressOutside = () => {
        if (editingId) {
            inputRef.current?.blur()
        }
    }

    // Focus input when a new bookmark is added
    useEffect(() => {
        if (visible && bookmarks.length > 0) {
            const latestBookmark = bookmarks[bookmarks.length - 1]
            if (!latestBookmark.label) {
                setEditingId(latestBookmark.id)
                setEditingLabel('')
                setTimeout(() => {
                    inputRef.current?.focus()
                }, 100)
            }
        }
    }, [visible, bookmarks])

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : 1,
            useNativeDriver: true,
            damping: 15,
        }).start()
    }, [visible])

    const handleLabelSubmit = (id: string, label: string) => {
        if (onUpdateBookmark) {
            onUpdateBookmark(id, label.trim())
        }
        setEditingId(null)
        setEditingLabel('')
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
                        <Pressable
                            onPress={handlePressOutside}
                            style={styles.contentContainer}
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
                                    <Text style={styles.addButtonText}>
                                        Add
                                    </Text>
                                </Pressable>
                            </View>

                            <FlatList
                                data={bookmarks}
                                keyExtractor={item => item.id}
                                style={styles.bookmarksList}
                                contentContainerStyle={
                                    styles.bookmarksListContent
                                }
                                showsVerticalScrollIndicator={true}
                                bounces={true}
                                ListEmptyComponent={
                                    <View style={styles.emptyBookmarksList}>
                                        <Text style={styles.emptyBookmarksText}>
                                            No bookmarks yet
                                        </Text>
                                        <Text
                                            style={styles.emptyBookmarksSubtext}
                                        >
                                            Tap Add to create a bookmark
                                        </Text>
                                    </View>
                                }
                                renderItem={({ item }) => (
                                    <Pressable
                                        onPress={handlePressOutside}
                                        style={styles.bookmarksItem}
                                    >
                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.bookmarksItemLeft,
                                                pressed &&
                                                    styles.timestampPressed,
                                            ]}
                                            onPress={() =>
                                                onSeekToBookmark(item.timestamp)
                                            }
                                        >
                                            <MaterialCommunityIcons
                                                name="bookmark"
                                                size={20}
                                                color="#0A84FF"
                                            />
                                            <Text
                                                style={
                                                    styles.bookmarksTimestamp
                                                }
                                            >
                                                {formatTimestamp(
                                                    item.timestamp,
                                                )}
                                            </Text>
                                            <MaterialCommunityIcons
                                                name="chevron-right"
                                                size={16}
                                                color="#8E8E93"
                                                style={styles.timestampIcon}
                                            />
                                        </Pressable>

                                        <TextInput
                                            ref={
                                                editingId === item.id
                                                    ? inputRef
                                                    : undefined
                                            }
                                            style={styles.labelInput}
                                            value={
                                                editingId === item.id
                                                    ? editingLabel
                                                    : item.label || ''
                                            }
                                            onChangeText={setEditingLabel}
                                            onFocus={() => {
                                                setEditingId(item.id)
                                                setEditingLabel(
                                                    item.label || '',
                                                )
                                            }}
                                            onBlur={() => {
                                                if (editingId === item.id) {
                                                    handleLabelSubmit(
                                                        item.id,
                                                        editingLabel,
                                                    )
                                                }
                                            }}
                                            onSubmitEditing={() => {
                                                handleLabelSubmit(
                                                    item.id,
                                                    editingLabel,
                                                )
                                            }}
                                            placeholder="Add label..."
                                            placeholderTextColor="#8E8E93"
                                            returnKeyType="done"
                                        />

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
                        </Pressable>
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
        paddingVertical: 8,
        paddingHorizontal: 12,
        minHeight: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        marginBottom: 8,
        gap: 12,
    },
    bookmarksItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 80,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: 'rgba(10, 132, 255, 0.1)',
    },
    timestampPressed: {
        opacity: 0.7,
    },
    timestampIcon: {
        marginLeft: 2,
    },
    bookmarksTimestamp: {
        color: '#FFFFFF',
        fontSize: 15,
    },
    labelInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        padding: 0,
        height: 36,
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
    contentContainer: {
        flex: 1,
    },
})
