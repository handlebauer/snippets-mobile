import React from 'react'
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'

import { BlurView } from 'expo-blur'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import type { MaterialCommunityIcons as Icon } from '@expo/vector-icons'

interface MenuItem {
    title: string
    icon: keyof typeof Icon.glyphMap
    onPress: () => void
}

interface FloatingMenuProps {
    visible: boolean
    onClose: () => void
    items: MenuItem[]
    anchorPosition: { x: number; y: number }
}

export function FloatingMenu({
    visible,
    onClose,
    items,
    anchorPosition,
}: FloatingMenuProps) {
    const [animation] = React.useState(new Animated.Value(0))
    const windowWidth = Dimensions.get('window').width
    const menuWidth = 220
    const menuPadding = 8

    // Calculate menu position
    const menuX = Math.min(
        anchorPosition.x - menuWidth + 30, // Align with right edge of button
        windowWidth - menuWidth - menuPadding, // Keep menu within screen bounds
    )

    React.useEffect(() => {
        if (visible) {
            Animated.spring(animation, {
                toValue: 1,
                useNativeDriver: true,
                tension: 100,
                friction: 10,
            }).start()
        } else {
            Animated.spring(animation, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 10,
            }).start()
        }
    }, [visible, animation])

    if (!visible) return null

    return (
        <Modal
            transparent
            visible={visible}
            onRequestClose={onClose}
            animationType="none"
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.menuContainer,
                        {
                            top: anchorPosition.y + 40, // Position below button
                            left: menuX,
                            opacity: animation,
                            transform: [
                                {
                                    scale: animation.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.95, 1],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <BlurView
                        intensity={25}
                        tint="dark"
                        style={styles.menuBlur}
                    >
                        <View style={styles.menu}>
                            {items.map((item, index) => (
                                <Pressable
                                    key={item.title}
                                    style={({ pressed }) => [
                                        styles.menuItem,
                                        pressed && styles.menuItemPressed,
                                        index === items.length - 1 &&
                                            styles.menuItemLast,
                                    ]}
                                    onPress={() => {
                                        onClose()
                                        item.onPress()
                                    }}
                                >
                                    <MaterialCommunityIcons
                                        name={item.icon}
                                        size={18}
                                        color="#FFFFFF"
                                        style={styles.menuItemIcon}
                                    />
                                    <Text style={styles.menuItemText}>
                                        {item.title}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </BlurView>
                </Animated.View>
            </Pressable>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    menuContainer: {
        position: 'absolute',
        width: 220,
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    menuBlur: {
        overflow: 'hidden',
        borderRadius: 14,
        backgroundColor: 'rgba(30, 30, 30, 0.7)',
    },
    menu: {
        padding: 6,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
    },
    menuItemPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    menuItemLast: {
        borderBottomWidth: 0,
    },
    menuItemIcon: {
        marginRight: 8,
        opacity: 0.9,
    },
    menuItemText: {
        color: '#FFFFFF',
        fontSize: 15,
    },
})
