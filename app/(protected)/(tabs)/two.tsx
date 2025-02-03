import { Text, View } from '@/components/base/themed'

export default function TabTwoScreen() {
    return (
        <View className="flex-1 items-center justify-center">
            <Text>Tab Two</Text>
            <View className="my-8 h-px w-4/5 bg-separator-light dark:bg-separator-dark" />
        </View>
    )
}
