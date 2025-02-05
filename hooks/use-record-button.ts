import { useCallback, useRef, useState } from 'react'
import { Animated } from 'react-native'

interface UseRecordButtonResult {
    isRecording: boolean
    innerStyle: {
        width: Animated.AnimatedInterpolation<string | number>
        height: Animated.AnimatedInterpolation<string | number>
        borderRadius: Animated.AnimatedInterpolation<string | number>
        backgroundColor: string
    }
    handleRecordPress: () => void
}

interface UseRecordButtonOptions {
    onRecordPress: (isRecording: boolean) => void
}

export function useRecordButton({
    onRecordPress,
}: UseRecordButtonOptions): UseRecordButtonResult {
    const [isRecording, setIsRecording] = useState(false)
    const recordingAnimation = useRef(new Animated.Value(0)).current

    const handleRecordPress = useCallback(() => {
        const newIsRecording = !isRecording
        setIsRecording(newIsRecording)

        // Animate the button
        Animated.spring(recordingAnimation, {
            toValue: newIsRecording ? 1 : 0,
            useNativeDriver: false,
            damping: 25,
            stiffness: 300,
            mass: 0.5,
        }).start()

        // Call the handler with the new state
        onRecordPress(newIsRecording)
    }, [isRecording, recordingAnimation, onRecordPress])

    const innerStyle = {
        width: recordingAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [60, 40],
        }),
        height: recordingAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [60, 40],
        }),
        borderRadius: recordingAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [30, 4],
        }),
        backgroundColor: '#FF3B30',
    }

    return {
        isRecording,
        innerStyle,
        handleRecordPress,
    }
}
