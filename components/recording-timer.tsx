import React from 'react'
import { StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'

import { useChannel } from '@/contexts/channel.context'

import { useScreenOrientation } from '@/hooks/use-screen-orientation'

export function RecordingTimer() {
    const {
        state: { recordingDuration, recordingStartTime },
    } = useChannel()
    const { isLandscape } = useScreenOrientation()

    return (
        <Text
            variant="titleMedium"
            style={[
                styles.timer,
                recordingStartTime ? styles.timerRecording : null,
                isLandscape && styles.containerLandscape,
            ]}
        >
            {recordingDuration}
        </Text>
    )
}

const styles = StyleSheet.create({
    timer: {
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        fontSize: 16,
        fontWeight: '500',
        overflow: 'hidden',
    },
    containerLandscape: {
        top: 16,
    },
    timerRecording: {
        backgroundColor: 'rgba(255, 59, 48, 0.9)', // iOS alert red with some transparency
    },
})
