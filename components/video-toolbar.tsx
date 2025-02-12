import React from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

import { MaterialCommunityIcons } from '@expo/vector-icons'

interface VideoToolbarProps {
    activeTab: 'video' | 'adjust' | 'crop'
    showBookmarksModal: boolean
    onTabChange: (tab: 'video' | 'adjust' | 'crop') => void
    onShowBookmarks: () => void
    onShare: () => void
    isLandscape?: boolean
}

export function VideoToolbar({
    activeTab,
    showBookmarksModal,
    onTabChange,
    onShowBookmarks,
    onShare,
    isLandscape,
}: VideoToolbarProps) {
    return (
        <View
            style={[
                styles.controlsContainer,
                isLandscape && styles.controlsContainerLandscape,
            ]}
        >
            <View
                style={[
                    styles.toolbarContainer,
                    isLandscape && styles.toolbarContainerLandscape,
                ]}
            >
                <Pressable
                    style={[
                        styles.toolButton,
                        activeTab === 'video' && styles.toolButtonActive,
                    ]}
                    onPress={() => onTabChange('video')}
                >
                    <MaterialCommunityIcons
                        name="video"
                        size={24}
                        color={activeTab === 'video' ? '#0A84FF' : '#FFFFFF'}
                    />
                    <Text
                        style={[
                            styles.toolButtonText,
                            activeTab === 'video' &&
                                styles.toolButtonTextActive,
                        ]}
                    >
                        Video
                    </Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.toolButton,
                        activeTab === 'adjust' && styles.toolButtonActive,
                    ]}
                    onPress={() => onTabChange('adjust')}
                >
                    <MaterialCommunityIcons
                        name="tune"
                        size={24}
                        color={activeTab === 'adjust' ? '#0A84FF' : '#FFFFFF'}
                    />
                    <Text
                        style={[
                            styles.toolButtonText,
                            activeTab === 'adjust' &&
                                styles.toolButtonTextActive,
                        ]}
                    >
                        Adjust
                    </Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.toolButton,
                        showBookmarksModal && styles.toolButtonActive,
                    ]}
                    onPress={onShowBookmarks}
                >
                    <MaterialCommunityIcons
                        name="bookmark-outline"
                        size={24}
                        color={showBookmarksModal ? '#0A84FF' : '#FFFFFF'}
                    />
                    <Text
                        style={[
                            styles.toolButtonText,
                            showBookmarksModal && styles.toolButtonTextActive,
                        ]}
                    >
                        Bookmarks
                    </Text>
                </Pressable>
                <Pressable style={styles.toolButton} onPress={onShare}>
                    <MaterialCommunityIcons
                        name={
                            Platform.OS === 'ios'
                                ? 'export-variant'
                                : 'share-variant'
                        }
                        size={24}
                        color="#FFFFFF"
                    />
                    <Text style={styles.toolButtonText}>Share</Text>
                </Pressable>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    controlsContainer: {
        paddingBottom: 8,
    },
    controlsContainerLandscape: {
        width: 100,
        backgroundColor: '#121212',
        paddingVertical: 20,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: '#333333',
        marginLeft: 16,
    },
    toolbarContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingBottom: 16,
        backgroundColor: '#121212',
    },
    toolbarContainerLandscape: {
        flexDirection: 'column',
        paddingVertical: 0,
        paddingHorizontal: 0,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    toolButton: {
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 12,
        marginVertical: 12,
        width: 64,
    },
    toolButtonActive: {
        opacity: 1,
    },
    toolButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        opacity: 0.8,
    },
    toolButtonTextActive: {
        color: '#0A84FF',
        opacity: 1,
    },
})
