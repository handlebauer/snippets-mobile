import React from 'react'
import { StyleSheet } from 'react-native'
import { useTheme } from 'react-native-paper'

import { BlurView } from 'expo-blur'
import { Tabs } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { useStream } from '@/contexts/recording.context'

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
    name: React.ComponentProps<typeof MaterialCommunityIcons>['name']
    color: string
    activeIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name']
}) {
    // If the color matches the primary color, the tab is active
    const theme = useTheme()
    const isActive = props.color === theme.colors.primary

    return (
        <MaterialCommunityIcons
            size={26}
            style={styles.tabBarIcon}
            name={isActive ? props.activeIcon : props.name}
            color={props.color}
        />
    )
}

export default function TabLayout() {
    const theme = useTheme()
    const { isStreaming, isEditing } = useStream()

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: '#666666',
                headerShown: false,
                tabBarStyle: {
                    display: isStreaming || isEditing ? 'none' : 'flex',
                    height: 75,
                    backgroundColor: 'transparent',
                    borderTopColor: 'transparent',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    elevation: 0,
                },
                tabBarBackground: () => (
                    <BlurView
                        tint="dark"
                        intensity={80}
                        style={StyleSheet.absoluteFill}
                    />
                ),
            }}
        >
            <Tabs.Screen
                name="videos"
                options={{
                    title: 'Videos',
                    tabBarIcon: ({ color }) => (
                        <TabBarIcon
                            name="movie-open-outline"
                            activeIcon="movie-open"
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Record',
                    tabBarIcon: ({ color }) => (
                        <TabBarIcon
                            name="plus-circle-outline"
                            activeIcon="plus-circle"
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => (
                        <TabBarIcon
                            name="account-outline"
                            activeIcon="account"
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    )
}

const styles = StyleSheet.create({
    tabBarIcon: {
        marginBottom: 0,
    },
    headerButton: {
        marginRight: 15,
    },
})
