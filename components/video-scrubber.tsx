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

// Format time helper (e.g., 65.3 -> "1:05")
const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
}

function TrimHandle({
    position,
    isLeft,
    duration,
    timelineWidth,
    otherHandlePosition,
    onDragStart,
    onDragEnd,
}: TrimHandleProps) {
    const initialPosition = React.useRef(0)

    const panResponder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: () => {
                    onDragStart()
                    initialPosition.current = getAnimatedValue(position)
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
                },
                onPanResponderRelease: () => {
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
        ],
    )

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
        </Animated.View>
    )
}

interface VideoScrubberProps {
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
    const timelineLayout = React.useRef<{ x: number; width: number }>({
        x: 0,
        width: 0,
    })
    const playheadAnim = React.useRef(new Animated.Value(0)).current
    const leftHandleAnim = React.useRef(new Animated.Value(0)).current
    const rightHandleAnim = React.useRef(new Animated.Value(0)).current
    const lastCommittedTrim = React.useRef({ start: trimStart, end: trimEnd })

    // Update handle positions when trim times change from props
    React.useEffect(() => {
        if (isDraggingTrim) return

        if (timelineLayout.current.width > 0) {
            const leftPosition =
                (trimStart / duration) * timelineLayout.current.width
            const rightPosition =
                (trimEnd / duration) * timelineLayout.current.width
            leftHandleAnim.setValue(leftPosition)
            rightHandleAnim.setValue(rightPosition)
            lastCommittedTrim.current = { start: trimStart, end: trimEnd }
        }
    }, [trimStart, trimEnd, duration, isDraggingTrim])

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
            // We can determine this by checking if the start time changed
            if (newTrimStart !== lastCommittedTrim.current.start) {
                onSeek(newTrimStart)
                playheadAnim.setValue(leftPos)
            }
        }
    }, [duration, onTrimChange, onSeek, playheadAnim])

    const calculateTimelinePosition = (pageX: number): number => {
        const relativeX = pageX - timelineLayout.current.x
        return Math.max(0, Math.min(relativeX, timelineLayout.current.width))
    }

    const updateScrubPosition = (position: number) => {
        if (!duration || !timelineLayout.current.width) return

        const newTime = (position / timelineLayout.current.width) * duration
        playheadAnim.setValue(position)
        onSeek(newTime)
    }

    React.useEffect(() => {
        if (!isScrubbing && timelineLayout.current.width > 0) {
            const position =
                (currentTime / duration) * timelineLayout.current.width
            playheadAnim.setValue(position)
        }
    }, [currentTime, duration, isScrubbing, playheadAnim])

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

    const handleTimelineLayout = React.useCallback(
        (_: LayoutChangeEvent) => {
            timelineRef.current?.measure(
                (_x, _y, measuredWidth, _height, pageX) => {
                    const oldWidth = timelineLayout.current.width
                    timelineLayout.current = { x: pageX, width: measuredWidth }

                    if (oldWidth !== measuredWidth && oldWidth > 0) {
                        const ratio = measuredWidth / oldWidth
                        const newLeftPos =
                            getAnimatedValue(leftHandleAnim) * ratio
                        const newRightPos =
                            getAnimatedValue(rightHandleAnim) * ratio
                        leftHandleAnim.setValue(newLeftPos)
                        rightHandleAnim.setValue(newRightPos)
                    } else if (oldWidth === 0) {
                        if (trimStart === 0 && trimEnd === duration) {
                            leftHandleAnim.setValue(0)
                            rightHandleAnim.setValue(measuredWidth)
                        } else {
                            const leftPosition =
                                (trimStart / duration) * measuredWidth
                            const rightPosition =
                                (trimEnd / duration) * measuredWidth
                            leftHandleAnim.setValue(leftPosition)
                            rightHandleAnim.setValue(rightPosition)
                        }
                    }
                },
            )
        },
        [duration, trimStart, trimEnd, leftHandleAnim, rightHandleAnim],
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
                                left: leftHandleAnim,
                                right: Animated.subtract(
                                    timelineLayout.current.width,
                                    rightHandleAnim,
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
                    />

                    {/* Playhead */}
                    {!isTrimming && (
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
                                <Text style={styles.timeText}>
                                    {formatTime(currentTime)}
                                </Text>
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
        paddingHorizontal: 32,
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
    timeText: {
        position: 'absolute',
        top: -30,
        backgroundColor: '#FFB800',
        color: '#000000',
        fontSize: 12,
        fontWeight: '600',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
        minWidth: 45,
        textAlign: 'center',
        transform: [{ translateX: -22 }],
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
})
