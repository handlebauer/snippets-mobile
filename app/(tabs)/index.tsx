import { StyleSheet } from 'react-native'
import { Surface, Text } from 'react-native-paper'

import { View } from '@/components/base/themed'
import EditScreenInfo from '@/components/expo/edit-screen-info'

export default function TabOneScreen() {
    return (
        <Surface style={styles.container}>
            <Text variant="headlineMedium">Tab One</Text>
            <View
                style={styles.separator}
                lightColor="#eee"
                darkColor="rgba(255,255,255,0.1)"
            />
            <EditScreenInfo path="app/(tabs)/index.tsx" />
        </Surface>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    separator: {
        marginVertical: 30,
        height: 1,
        width: '80%',
    },
})
