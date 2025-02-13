import React from 'react'
import {
    Animated,
    Image,
    LayoutChangeEvent,
    PanResponder,
    PanResponderGestureState,
    Pressable,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'

import { Video } from 'expo-av'
import { MaterialCommunityIcons } from '@expo/vector-icons'

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
    currentTime,
    playheadAnim,
}: TrimHandleProps) {
    const [isDragging, setIsDragging] = React.useState(false)
    const initialPosition = React.useRef(0)
    const [currentPos, setCurrentPos] = React.useState(0)

    // Log initial position value
    React.useEffect(() => {
        console.log(`${isLeft ? 'Left' : 'Right'} handle position:`, {
            initial: getAnimatedValue(position),
            timelineWidth,
        })
    }, [isLeft, position, timelineWidth])

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
                onPanResponderMove: (
                    _,
                    gestureState: PanResponderGestureState,
                ) => {
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

export interface VideoScrubberProps {
    videoRef: React.RefObject<Video>
    duration: number
    currentTime: number
    isPlaying: boolean
    thumbnails: string[]
    thumbnailsLoading: boolean
    onSeek: (time: number) => void
    onPlayPause: () => void
    trimStart: number
    trimEnd: number
    onTrimChange: (start: number, end: number) => void
    onTrimDragStart: () => void
    onTrimDragEnd: () => void
    isTrimming: boolean
}

export function VideoScrubber({
    videoRef,
    duration,
    currentTime,
    isPlaying,
    thumbnails,
    thumbnailsLoading,
    onSeek,
    onPlayPause,
    trimStart,
    trimEnd,
    onTrimChange,
    onTrimDragStart,
    onTrimDragEnd,
    isTrimming,
}: VideoScrubberProps) {
    const [isScrubbing, setIsScrubbing] = React.useState(false)
    const [isDraggingTrim, setIsDraggingTrim] = React.useState(false)
    const timelineRef = React.useRef<View>(null)
    const [timelineLayout, setTimelineLayout] = React.useState<{
        x: number
        width: number
    }>({
        x: 0,
        width: 0,
    })
    const playheadAnim = React.useRef(new Animated.Value(0)).current
    const leftHandleAnim = React.useRef(new Animated.Value(0)).current
    const rightHandleAnim = React.useRef(new Animated.Value(0)).current
    const lastCommittedTrim = React.useRef({ start: trimStart, end: trimEnd })

    // Initialize trimEnd if it's zero
    React.useEffect(() => {
        if (trimEnd === 0 && duration > 0) {
            console.log('Initializing trimEnd to duration:', duration)
            onTrimChange(trimStart, duration)
        }
    }, [duration, trimStart, trimEnd, onTrimChange])

    // FORCE THE FUCKING RIGHT HANDLE TO THE RIGHT POSITION
    React.useEffect(() => {
        if (timelineLayout.width > 0) {
            console.log('FORCING RIGHT HANDLE POSITION:', {
                trimEnd,
                duration,
                width: timelineLayout.width,
                position: (trimEnd / duration) * timelineLayout.width,
            })
            rightHandleAnim.setValue(
                (trimEnd / duration) * timelineLayout.width,
            )
        }
    }, [timelineLayout.width, duration, trimEnd])

    // Handle timeline layout changes
    const handleTimelineLayout = React.useCallback(
        (event: LayoutChangeEvent) => {
            timelineRef.current?.measure(
                (x, y, measuredWidth, height, pageX) => {
                    // First calculate positions using the direct measuredWidth
                    const leftPosition = (trimStart / duration) * measuredWidth
                    const rightPosition = (trimEnd / duration) * measuredWidth

                    console.log('MEASURE CALLBACK:', {
                        measuredWidth,
                        pageX,
                        leftPosition,
                        rightPosition,
                        trimStart,
                        trimEnd,
                        duration,
                    })

                    // Set the positions first
                    leftHandleAnim.setValue(leftPosition)
                    rightHandleAnim.setValue(rightPosition)

                    // Then update the layout state
                    setTimelineLayout({ x: pageX, width: measuredWidth })
                },
            )
        },
        [duration, trimStart, trimEnd, leftHandleAnim, rightHandleAnim],
    )

    const calculateTimelinePosition = (pageX: number): number => {
        const relativeX = pageX - timelineLayout.x
        const rawPosition = Math.max(
            0,
            Math.min(relativeX, timelineLayout.width),
        )

        // Convert position to time to check against trim bounds
        const timeAtPosition = (rawPosition / timelineLayout.width) * duration

        // If we're outside trim bounds, constrain to nearest trim point
        if (timeAtPosition < trimStart) {
            return (trimStart / duration) * timelineLayout.width
        }
        if (timeAtPosition > trimEnd) {
            return (trimEnd / duration) * timelineLayout.width
        }

        return rawPosition
    }

    const updateScrubPosition = (position: number) => {
        if (!duration || !timelineLayout.width) return

        const newTime = (position / timelineLayout.width) * duration
        // Ensure the time is within trim bounds
        const constrainedTime = Math.max(trimStart, Math.min(newTime, trimEnd))
        const constrainedPosition =
            (constrainedTime / duration) * timelineLayout.width

        playheadAnim.setValue(constrainedPosition)
        onSeek(constrainedTime)
    }

    React.useEffect(() => {
        if (!isScrubbing && timelineLayout.width > 0) {
            const position = (currentTime / duration) * timelineLayout.width
            playheadAnim.setValue(position)
        }
    }, [currentTime, duration, isScrubbing, playheadAnim])

    const commitTrimChanges = React.useCallback(() => {
        const timelineWidth = timelineLayout.width
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
            // We can determine this by checking if the start time changed
            if (newTrimStart !== lastCommittedTrim.current.start) {
                onSeek(newTrimStart)
                playheadAnim.setValue(leftPos)
            }
        }
    }, [duration, onTrimChange, onSeek, playheadAnim])

    const panResponder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => {
                    if (isDraggingTrim || !duration || !timelineLayout.width)
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
        [
            duration,
            isDraggingTrim,
            calculateTimelinePosition,
            updateScrubPosition,
        ],
    )

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
                    <View style={styles.thumbnailsContainer}>
                        {thumbnailsLoading
                            ? Array(5)
                                  .fill(null)
                                  .map((_, index) => (
                                      <View
                                          key={`placeholder-${index}`}
                                          style={styles.thumbnailPlaceholder}
                                      />
                                  ))
                            : thumbnails.map((uri, index) => (
                                  <Image
                                      key={`thumbnail-${index}`}
                                      source={{ uri }}
                                      style={styles.thumbnail}
                                      resizeMode="cover"
                                  />
                              ))}
                    </View>

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
                        timelineWidth={timelineLayout.width}
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
                        timelineWidth={timelineLayout.width}
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

                    {/* Playhead - only show when not dragging trim handles */}
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
        minHeight: 60,
        marginHorizontal: 32,
    },
    container: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        borderRadius: 8,
    },
    playButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginLeft: 8,
    },
    timeline: {
        flex: 1,
        height: 32,
        backgroundColor: '#2C2C2E',
        borderRadius: 4,
        overflow: 'visible',
        position: 'relative',
        marginVertical: 12,
        marginRight: 8,
    },
    thumbnailsContainer: {
        flexDirection: 'row',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 4,
    },
    thumbnailPlaceholder: {
        flex: 1,
        backgroundColor: '#3C3C3E',
        marginHorizontal: 1,
    },
    thumbnail: {
        flex: 1,
        height: '100%',
        marginHorizontal: 1,
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
        top: -6,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FFB800',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
        marginLeft: -5,
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
    leftTimeTextContainer: {
        transform: [{ translateX: -28 }],
    },
    rightTimeTextContainer: {
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
    trimHandle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 20,
        zIndex: 4,
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
})
