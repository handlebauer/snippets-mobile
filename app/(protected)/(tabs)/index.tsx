import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ScreenShareViewer } from '@/components/screen-share-viewer'

import { useWebRTC } from '@/hooks/use-webrtc'

export default function Index() {
    const { state, startSession, resetState } = useWebRTC()

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                <ScreenShareViewer
                    state={state}
                    onStartSession={startSession}
                    onReset={resetState}
                />
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
