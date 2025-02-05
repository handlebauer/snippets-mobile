import React from 'react'
import { StyleSheet } from 'react-native'
import { useTheme } from 'react-native-paper'

import { Tabs } from 'expo-router'
import FontAwesome from '@expo/vector-icons/FontAwesome'

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
    name: React.ComponentProps<typeof FontAwesome>['name']
    color: string
}) {
    return <FontAwesome size={28} style={styles.tabBarIcon} {...props} />
}

export default function TabLayout() {
    const theme = useTheme()

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: theme.colors.primary,
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Record',
                    tabBarIcon: ({ color }) => (
                        <TabBarIcon name="dot-circle-o" color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => (
                        <TabBarIcon name="user" color={color} />
                    ),
                }}
            />
        </Tabs>
    )
}

const styles = StyleSheet.create({
    tabBarIcon: {
        marginBottom: -3,
    },
    headerButton: {
        marginRight: 15,
    },
})
