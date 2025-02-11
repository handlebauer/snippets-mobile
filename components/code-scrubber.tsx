import React from 'react'
import {
    Animated,
    LayoutChangeEvent,
    PanResponder,
    Pressable,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'

import { MaterialCommunityIcons } from '@expo/vector-icons'

// Constants for playback modes (inspired by web app)
// const PLAYBACK_THRESHOLDS = {
//     FRAME_MS: 100, // 10fps for smoother scrubbing
//     EVENTS_PER_FRAME: 10,
// } as const

// Format time helper (e.g., 65.342 -> "00:04.87")
const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    const centiseconds = Math.floor((timeInSeconds % 1) * 100)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
}

// Helper to safely get animated value
const getAnimatedValue = (anim: Animated.Value): number => {
    return (anim as any)._value || 0
}

interface EditorEvent {
    type: 'insert' | 'delete' | 'replace'
    timestamp: number
    from: number
    to: number
    text: string
    removed?: string
}

interface CodeScrubberProps {
    events: EditorEvent[]
    currentTime: number
    duration: number
    isPlaying: boolean
    onSeek: (time: number) => void
    onPlayPause: () => void
    trimStart: number
    trimEnd: number
    onTrimChange: (start: number, end: number) => void
    onTrimDragStart: () => void
    onTrimDragEnd: () => void
    isTrimming: boolean
}

interface TrimHandleProps {
    position: Animated.Value
    isLeft: boolean
    duration: number
    timelineWidth: number
    otherHandlePosition: Animated.Value
    onDragStart: () => void
    onDragEnd: () => void
    currentTime: number
    playheadAnim: Animated.Value
}

function TrimHandle({
    position,
    isLeft,
    duration,
    timelineWidth,
    otherHandlePosition,
    onDragStart,
    onDragEnd,
    playheadAnim,
}: TrimHandleProps) {
    const [isDragging, setIsDragging] = React.useState(false)
    const initialPosition = React.useRef(0)
    const [currentPos, setCurrentPos] = React.useState(0)

    const panResponder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: () => {
                    setIsDragging(true)
                    onDragStart()
                    initialPosition.current = getAnimatedValue(position)
                    setCurrentPos(getAnimatedValue(position))
                },
                onPanResponderMove: (_, gestureState) => {
                    if (!timelineWidth) return

                    const minTrimGap = (1 / duration) * timelineWidth
                    const otherPos = getAnimatedValue(otherHandlePosition)

                    // Calculate new position with constraints
                    const newPos = isLeft
                        ? Math.max(
                              0,
                              Math.min(
                                  initialPosition.current + gestureState.dx,
                                  otherPos - minTrimGap,
                              ),
                          )
                        : Math.min(
                              timelineWidth,
                              Math.max(
                                  initialPosition.current + gestureState.dx,
                                  otherPos + minTrimGap,
                              ),
                          )
                    position.setValue(newPos)
                    setCurrentPos(newPos)

                    // If this is the left handle, update the playhead position
                    if (isLeft) {
                        playheadAnim.setValue(newPos)
                    }
                },
                onPanResponderRelease: () => {
                    setIsDragging(false)
                    onDragEnd()
                },
            }),
        [
            position,
            isLeft,
            duration,
            timelineWidth,
            otherHandlePosition,
            onDragStart,
            onDragEnd,
            playheadAnim,
        ],
    )

    const handleTime = (pos: number) => {
        return (pos / timelineWidth) * duration
    }

    return (
        <Animated.View
            style={[
                styles.trimHandle,
                isLeft ? styles.leftTrimHandle : styles.rightTrimHandle,
                { transform: [{ translateX: position }] },
            ]}
            {...panResponder.panHandlers}
        >
            <View style={styles.trimHandleBar} />
            <View style={styles.trimHandleKnob} />
            {isDragging && (
                <View
                    style={[
                        styles.timeTextContainer,
                        isLeft
                            ? styles.leftTimeTextContainer
                            : styles.rightTimeTextContainer,
                    ]}
                >
                    <Text style={styles.timeText}>
                        {formatTime(handleTime(currentPos))}
                    </Text>
                </View>
            )}
        </Animated.View>
    )
}

export function CodeScrubber({
    events,
    currentTime,
    duration,
    isPlaying,
    onSeek,
    onPlayPause,
    trimStart,
    trimEnd,
    onTrimChange,
    onTrimDragStart,
    onTrimDragEnd,
}: CodeScrubberProps) {
    const [timelineWidth, setTimelineWidth] = React.useState(0)
    const [isScrubbing, setIsScrubbing] = React.useState(false)
    const [isDraggingTrim, setIsDraggingTrim] = React.useState(false)
    const playheadAnim = React.useRef(new Animated.Value(0)).current
    const leftHandleAnim = React.useRef(new Animated.Value(0)).current
    const rightHandleAnim = React.useRef(new Animated.Value(0)).current
    const timelineRef = React.useRef<View>(null)
    const timelineLayout = React.useRef<{ x: number; width: number }>({
        x: 0,
        width: 0,
    })
    const lastCommittedTrim = React.useRef({ start: trimStart, end: trimEnd })

    // Handle timeline layout
    const handleTimelineLayout = React.useCallback(
        (_event: LayoutChangeEvent) => {
            timelineRef.current?.measure(
                (_x, _y, measuredWidth, _height, pageX) => {
                    const oldWidth = timelineLayout.current.width
                    timelineLayout.current = { x: pageX, width: measuredWidth }
                    setTimelineWidth(measuredWidth)

                    // Update handle positions on width change
                    if (oldWidth !== measuredWidth && oldWidth > 0) {
                        const ratio = measuredWidth / oldWidth
                        leftHandleAnim.setValue(
                            getAnimatedValue(leftHandleAnim) * ratio,
                        )
                        rightHandleAnim.setValue(
                            getAnimatedValue(rightHandleAnim) * ratio,
                        )
                    } else if (oldWidth === 0) {
                        // Initial layout
                        const leftPosition =
                            (trimStart / duration) * measuredWidth
                        const rightPosition =
                            (trimEnd / duration) * measuredWidth
                        leftHandleAnim.setValue(leftPosition)
                        rightHandleAnim.setValue(rightPosition)
                    }

                    // Set initial playhead position
                    const position = (currentTime / duration) * measuredWidth
                    playheadAnim.setValue(position)
                },
            )
        },
        [
            currentTime,
            duration,
            playheadAnim,
            trimStart,
            trimEnd,
            leftHandleAnim,
            rightHandleAnim,
        ],
    )

    const commitTrimChanges = React.useCallback(() => {
        const timelineWidth = timelineLayout.current.width
        if (!timelineWidth) return

        const leftPos = getAnimatedValue(leftHandleAnim)
        const rightPos = getAnimatedValue(rightHandleAnim)

        const rawStartTime = (leftPos / timelineWidth) * duration
        const rawEndTime = (rightPos / timelineWidth) * duration

        const newTrimStart = Math.max(0, Math.min(rawStartTime, duration - 1))
        const newTrimEnd = Math.min(
            duration,
            Math.max(rawEndTime, newTrimStart + 1),
        )

        if (
            newTrimStart !== lastCommittedTrim.current.start ||
            newTrimEnd !== lastCommittedTrim.current.end
        ) {
            lastCommittedTrim.current = { start: newTrimStart, end: newTrimEnd }
            onTrimChange(newTrimStart, newTrimEnd)

            // Only move playhead if the left handle was dragged
            if (newTrimStart !== lastCommittedTrim.current.start) {
                onSeek(newTrimStart)
                playheadAnim.setValue(leftPos)
            }
        }
    }, [duration, onTrimChange, onSeek, playheadAnim])

    const calculateTimelinePosition = (pageX: number): number => {
        if (!timelineLayout.current.width || !duration) return 0

        const relativeX = pageX - timelineLayout.current.x
        const rawPosition = Math.max(
            0,
            Math.min(relativeX, timelineLayout.current.width),
        )

        // Convert position to time to check against trim bounds
        const timeAtPosition =
            (rawPosition / timelineLayout.current.width) * duration

        // If we're outside trim bounds, constrain to nearest trim point
        if (timeAtPosition < trimStart) {
            return (trimStart / duration) * timelineLayout.current.width
        }
        if (timeAtPosition > trimEnd) {
            return (trimEnd / duration) * timelineLayout.current.width
        }

        return rawPosition
    }

    const updateScrubPosition = (position: number) => {
        if (!duration || !timelineLayout.current.width) return

        const newTime = (position / timelineLayout.current.width) * duration
        playheadAnim.setValue(position)
        onSeek(newTime)
    }

    // Pan responder for scrubbing
    const panResponder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => {
                    if (
                        isDraggingTrim ||
                        !duration ||
                        !timelineLayout.current.width
                    )
                        return false
                    setIsScrubbing(true)
                    return true
                },
                onMoveShouldSetPanResponder: () => !isDraggingTrim,
                onPanResponderGrant: evt => {
                    const position = calculateTimelinePosition(
                        evt.nativeEvent.pageX,
                    )
                    updateScrubPosition(position)
                },
                onPanResponderMove: evt => {
                    const position = calculateTimelinePosition(
                        evt.nativeEvent.pageX,
                    )
                    updateScrubPosition(position)
                },
                onPanResponderRelease: evt => {
                    const position = calculateTimelinePosition(
                        evt.nativeEvent.pageX,
                    )
                    updateScrubPosition(position)
                    setIsScrubbing(false)
                },
            }),
        [duration, isDraggingTrim],
    )

    // Update playhead position when time changes (if not scrubbing)
    React.useEffect(() => {
        if (!isScrubbing && timelineLayout.current.width > 0) {
            const position =
                (currentTime / duration) * timelineLayout.current.width
            playheadAnim.setValue(position)
        }
    }, [currentTime, duration, isScrubbing, playheadAnim])

    return (
        <View style={styles.wrapper}>
            <View style={styles.container}>
                <Pressable style={styles.playButton} onPress={onPlayPause}>
                    <MaterialCommunityIcons
                        name={isPlaying ? 'pause' : 'play'}
                        size={24}
                        color="#FFFFFF"
                    />
                </Pressable>

                <View
                    ref={timelineRef}
                    style={styles.timeline}
                    onLayout={handleTimelineLayout}
                    {...panResponder.panHandlers}
                >
                    {/* Event markers */}
                    {events.map((event, index) => {
                        const position =
                            ((event.timestamp - (events[0]?.timestamp || 0)) /
                                1000 /
                                duration) *
                            timelineWidth
                        return (
                            <View
                                key={index}
                                style={[styles.eventMarker, { left: position }]}
                            />
                        )
                    })}

                    {/* Trim overlays */}
                    <Animated.View
                        style={[
                            styles.trimOverlay,
                            {
                                right: undefined,
                                width: leftHandleAnim,
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.trimOverlay,
                            {
                                left: rightHandleAnim,
                                right: 0,
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.selectedRegion,
                            {
                                position: 'absolute',
                                left: leftHandleAnim,
                                width: Animated.subtract(
                                    rightHandleAnim,
                                    leftHandleAnim,
                                ),
                            },
                        ]}
                    />

                    {/* Trim handles */}
                    <TrimHandle
                        position={leftHandleAnim}
                        isLeft={true}
                        duration={duration}
                        timelineWidth={timelineLayout.current.width}
                        otherHandlePosition={rightHandleAnim}
                        onDragStart={() => {
                            setIsDraggingTrim(true)
                            onTrimDragStart()
                        }}
                        onDragEnd={() => {
                            commitTrimChanges()
                            setIsDraggingTrim(false)
                            onTrimDragEnd()
                        }}
                        currentTime={currentTime}
                        playheadAnim={playheadAnim}
                    />
                    <TrimHandle
                        position={rightHandleAnim}
                        isLeft={false}
                        duration={duration}
                        timelineWidth={timelineLayout.current.width}
                        otherHandlePosition={leftHandleAnim}
                        onDragStart={() => {
                            setIsDraggingTrim(true)
                            onTrimDragStart()
                        }}
                        onDragEnd={() => {
                            commitTrimChanges()
                            setIsDraggingTrim(false)
                            onTrimDragEnd()
                        }}
                        currentTime={currentTime}
                        playheadAnim={playheadAnim}
                    />

                    {/* Playhead */}
                    {!isDraggingTrim && (
                        <Animated.View
                            style={[
                                styles.playhead,
                                {
                                    transform: [{ translateX: playheadAnim }],
                                },
                            ]}
                        >
                            <View style={styles.playheadKnob} />
                            {isScrubbing && (
                                <View style={styles.timeTextContainer}>
                                    <Text style={styles.timeText}>
                                        {formatTime(currentTime)}
                                    </Text>
                                </View>
                            )}
                        </Animated.View>
                    )}
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 0,
        minHeight: 72,
        marginHorizontal: 32,
    },
    container: {
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        borderRadius: 8,
    },
    playButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginLeft: 8,
    },
    timeline: {
        flex: 1,
        height: 40,
        backgroundColor: '#2C2C2E',
        borderRadius: 4,
        overflow: 'visible',
        position: 'relative',
        marginRight: 8,
    },
    playhead: {
        position: 'absolute',
        top: 0,
        height: '100%',
        width: 2,
        backgroundColor: '#FFB800',
        alignItems: 'center',
        zIndex: 3,
    },
    playheadKnob: {
        position: 'absolute',
        top: -8,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#FFB800',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
        marginLeft: -6,
    },
    timeTextContainer: {
        position: 'absolute',
        top: -36,
        backgroundColor: '#FFB800',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
        minWidth: 75,
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
        transform: [{ translateX: -28 }],
    },
    timeText: {
        color: '#000000',
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
        fontFamily: 'System',
        lineHeight: 16,
    },
    eventMarker: {
        position: 'absolute',
        top: '50%',
        width: 2,
        height: 16,
        marginTop: -8,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 1,
    },
    trimHandle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 20,
        zIndex: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    leftTrimHandle: {
        left: -10, // Center the handle on the position
    },
    rightTrimHandle: {
        left: -10, // Center the handle on the position
    },
    trimHandleBar: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: '#FFB800',
    },
    trimHandleKnob: {
        position: 'absolute',
        top: '50%',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFB800',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
        transform: [{ translateY: -10 }], // Center vertically
    },
    trimOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1,
    },
    selectedRegion: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        borderWidth: 2,
        borderColor: '#FFB800',
        backgroundColor: 'rgba(255, 184, 0, 0.1)',
        zIndex: 1,
    },
    leftTimeTextContainer: {
        transform: [{ translateX: -28 }],
    },
    rightTimeTextContainer: {
        transform: [{ translateX: -28 }],
    },
})
