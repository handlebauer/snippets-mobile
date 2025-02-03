import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

export default function TabOneScreen() {
    const theme = useTheme()

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: theme.colors.background },
            ]}
        >
            <Text>Tab One</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
