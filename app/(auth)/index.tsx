import { StyleSheet } from 'react-native'
import { Surface } from 'react-native-paper'

import Auth from '@/components/user/auth'

export default function AuthScreen() {
    return (
        <Surface style={styles.container}>
            <Auth />
        </Surface>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 12,
    },
})
