import { StyleSheet, View } from 'react-native'

import { Auth } from '@/components/user/auth'

export default function AuthScreen() {
    return (
        <View style={styles.container}>
            <Auth />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1, // This ensures the auth screen takes full height
    },
})
