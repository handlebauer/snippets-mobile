import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ScreenShareViewer } from '@/components/screen-share-viewer'

import { useWebRTC } from '@/hooks/use-webrtc'

export default function Index() {
    const { state, startSession, resetState, channel } = useWebRTC()

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                <ScreenShareViewer
                    state={state}
                    onStartSession={startSession}
                    onReset={resetState}
                    channel={channel?.current}
                />
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    content: {
        flex: 1,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
