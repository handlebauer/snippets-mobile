import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

import { useStream } from '@/contexts/recording.context'

import { useScreenOrientation } from '@/hooks/use-screen-orientation'

export function RecordingTimer() {
    const { recordingDuration, recordingStartTime } = useStream()
    const { isLandscape } = useScreenOrientation()

    return (
        <View
            style={[styles.container, isLandscape && styles.containerLandscape]}
        >
            <Text
                variant="titleMedium"
                style={[
                    styles.timer,
                    recordingStartTime ? styles.timerRecording : null,
                ]}
            >
                {recordingDuration}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    containerLandscape: {
        top: 16,
    },
    timer: {
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 3,
        fontSize: 18,
        overflow: 'hidden',
    },
    timerRecording: {
        backgroundColor: 'rgba(255, 59, 48, 0.9)', // iOS alert red with some transparency
    },
})
