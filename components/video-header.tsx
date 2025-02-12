import React from 'react'
import { Platform, Pressable, StatusBar, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

import { MaterialCommunityIcons } from '@expo/vector-icons'

interface VideoHeaderProps {
    isFromPostRecording: boolean
    hasChanges: boolean
    onDelete: () => void
    onCancel: () => void
    onSave: () => void
    onShowMenu: () => void
    moreButtonRef: React.RefObject<View>
    isLandscape?: boolean
}

export function VideoHeader({
    isFromPostRecording,
    hasChanges,
    onDelete,
    onCancel,
    onSave,
    onShowMenu,
    moreButtonRef,
    isLandscape,
}: VideoHeaderProps) {
    return (
        <View style={[styles.navBar, isLandscape && styles.navBarLandscape]}>
            {isFromPostRecording ? (
                <>
                    <Pressable onPress={onDelete}>
                        <Text style={[styles.navButton, styles.deleteButton]}>
                            Delete
                        </Text>
                    </Pressable>
                    <View style={styles.titleContainer}>
                        <Text style={styles.navTitle}>Video</Text>
                        <Pressable
                            onPress={onShowMenu}
                            style={styles.moreButton}
                            ref={moreButtonRef}
                        >
                            <MaterialCommunityIcons
                                name="dots-horizontal"
                                size={24}
                                color="#FFFFFF"
                            />
                        </Pressable>
                    </View>
                    <Pressable
                        onPress={onSave}
                        disabled={false} // Always enabled for post-recording
                        style={({ pressed }) => [
                            styles.saveButton,
                            pressed && styles.saveButtonPressed,
                        ]}
                    >
                        <Text style={styles.navButton}>Save</Text>
                    </Pressable>
                </>
            ) : (
                <>
                    <Pressable onPress={onCancel}>
                        <Text style={styles.navButton}>Close</Text>
                    </Pressable>
                    <View style={styles.titleContainer}>
                        <Text style={styles.navTitle}>Video</Text>
                        <Pressable
                            onPress={onShowMenu}
                            style={styles.moreButton}
                            ref={moreButtonRef}
                        >
                            <MaterialCommunityIcons
                                name="dots-horizontal"
                                size={24}
                                color="#FFFFFF"
                            />
                        </Pressable>
                    </View>
                    <Pressable
                        onPress={onSave}
                        disabled={!hasChanges} // Disabled when no changes in normal editing
                        style={({ pressed }) => [
                            styles.saveButton,
                            !hasChanges && styles.saveButtonDisabled,
                            pressed && styles.saveButtonPressed,
                        ]}
                    >
                        <Text
                            style={[
                                styles.navButton,
                                !hasChanges && styles.navButtonDisabled,
                            ]}
                        >
                            Save
                        </Text>
                    </Pressable>
                </>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    navBar: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#121212',
        marginTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
    },
    navBarLandscape: {
        marginTop: 0,
        paddingHorizontal: Platform.OS === 'ios' ? 64 : 32,
    },
    navButton: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    navTitle: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    moreButton: {
        padding: 4,
    },
    saveButton: {
        opacity: 1,
        padding: 8,
        borderRadius: 8,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonPressed: {
        opacity: 0.8,
    },
    navButtonDisabled: {
        color: '#999999',
    },
    deleteButton: {
        color: '#FF3B30',
    },
})
