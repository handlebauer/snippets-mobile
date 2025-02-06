import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'

import { ScreenShareViewer } from '@/components/screen-share-viewer'

import { useWebRTC } from '@/hooks/use-webrtc'

export default function Index() {
    const { state, startSession, resetState, channel } = useWebRTC()

    useEffect(() => {
        console.log('🔄 [Index] state updated:', state)
    }, [state])

    return (
        <View style={styles.container}>
            <ScreenShareViewer
                state={state}
                onStartSession={startSession}
                onReset={resetState}
                channel={channel?.current}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
})
