import React, { useEffect, useRef } from 'react'
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BlurView } from 'expo-blur'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface CodeStats {
    totalEdits: number
    insertCount: number
    deleteCount: number
    replaceCount: number
    charsAdded: number
    charsDeleted: number
    typingSpeed: number
    longestPause: number
    duration: number
}

interface CodeMetadataModalProps {
    visible: boolean
    onClose: () => void
    stats: CodeStats
}

export function CodeMetadataModal({
    visible,
    onClose,
    stats,
}: CodeMetadataModalProps) {
    const insets = useSafeAreaInsets()
    const slideAnim = useRef(new Animated.Value(1)).current

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : 1,
            useNativeDriver: true,
            damping: 20,
            mass: 1,
            stiffness: 100,
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
                                { paddingBottom: insets.bottom + 44 },
                            ]}
                        >
                            <View style={styles.handle} />
                            <View style={styles.bottomSheetHeader}>
                                <View style={styles.headerLeft} />
                                <Text style={styles.bottomSheetTitle}>
                                    Code Details
                                </Text>
                                <View style={styles.headerRight} />
                            </View>

                            <View style={styles.metadataList}>
                                <View style={styles.metadataRow}>
                                    <MaterialCommunityIcons
                                        name="pencil-outline"
                                        size={22}
                                        color="#0A84FF"
                                    />
                                    <View style={styles.metadataTextContainer}>
                                        <Text style={styles.metadataLabel}>
                                            Total Edits
                                        </Text>
                                        <Text style={styles.metadataValue}>
                                            {stats.totalEdits}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.metadataRow}>
                                    <MaterialCommunityIcons
                                        name="text"
                                        size={22}
                                        color="#0A84FF"
                                    />
                                    <View style={styles.metadataTextContainer}>
                                        <Text style={styles.metadataLabel}>
                                            Characters Added
                                        </Text>
                                        <Text style={styles.metadataValue}>
                                            {stats.charsAdded}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.metadataRow}>
                                    <MaterialCommunityIcons
                                        name="backspace-outline"
                                        size={22}
                                        color="#0A84FF"
                                    />
                                    <View style={styles.metadataTextContainer}>
                                        <Text style={styles.metadataLabel}>
                                            Characters Deleted
                                        </Text>
                                        <Text style={styles.metadataValue}>
                                            {stats.charsDeleted}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.metadataRow}>
                                    <MaterialCommunityIcons
                                        name="speedometer"
                                        size={22}
                                        color="#0A84FF"
                                    />
                                    <View style={styles.metadataTextContainer}>
                                        <Text style={styles.metadataLabel}>
                                            Typing Speed
                                        </Text>
                                        <Text style={styles.metadataValue}>
                                            {stats.typingSpeed} CPM
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.metadataRow}>
                                    <MaterialCommunityIcons
                                        name="timer-outline"
                                        size={22}
                                        color="#0A84FF"
                                    />
                                    <View style={styles.metadataTextContainer}>
                                        <Text style={styles.metadataLabel}>
                                            Longest Pause
                                        </Text>
                                        <Text style={styles.metadataValue}>
                                            {stats.longestPause}s
                                        </Text>
                                    </View>
                                </View>
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
                                            {stats.duration}s
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.timelineContainer}>
                                    <View style={styles.timeline}>
                                        <View style={styles.timelineProgress} />
                                    </View>
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheet: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1C1C1E',
        minHeight: 400,
        maxHeight: '75%',
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
    },
    bottomSheetTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        flex: 1,
    },
    headerLeft: {
        minWidth: 60,
        height: 44,
    },
    headerRight: {
        minWidth: 60,
        height: 44,
    },
    scrollView: {
        flexGrow: 0,
    },
    metadataList: {
        paddingHorizontal: 16,
        paddingBottom: 16,
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
    timelineContainer: {
        paddingVertical: 12,
    },
    timeline: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
    },
    timelineProgress: {
        position: 'absolute',
        width: 2,
        height: '100%',
        backgroundColor: '#FFB800',
        borderRadius: 1,
    },
})
