import { View } from 'react-native'
import { Text } from 'react-native-paper'

export default function TabOneScreen() {
    return (
        <View className="flex-1 items-center justify-center bg-background">
            <Text>Tab One</Text>
            <View className="my-8 h-px w-4/5 bg-separator-light dark:bg-separator-dark" />
        </View>
    )
}
