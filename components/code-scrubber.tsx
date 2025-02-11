import React from 'react'
import {
    Animated,
    LayoutChangeEvent,
    PanResponder,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'

import { MaterialCommunityIcons } from '@expo/vector-icons'

// Constants for playback modes (inspired by web app)
const PLAYBACK_THRESHOLDS = {
    FRAME_MS: 100, // 10fps for smoother scrubbing
    EVENTS_PER_FRAME: 10,
} as const

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
}

export function CodeScrubber({
    events,
    currentTime,
    duration,
    isPlaying,
    onSeek,
    onPlayPause,
}: CodeScrubberProps) {
    const [timelineWidth, setTimelineWidth] = React.useState(0)
    const [isScrubbing, setIsScrubbing] = React.useState(false)
    const playheadAnim = React.useRef(new Animated.Value(0)).current
    const timelineLayout = React.useRef<{ x: number; width: number }>({
        x: 0,
        width: 0,
    })

    // Log events for debugging
    React.useEffect(() => {
        console.log('🎭 CodeScrubber events:', {
            count: events.length,
            events: events, // Log all events
            firstEvent: events[0],
            lastEvent: events[events.length - 1],
            duration,
            timelineWidth,
            currentTime,
            isPlaying,
        })

        if (events.length > 0) {
            const firstEvent = events[0]
            const lastEvent = events[events.length - 1]
            const calculatedDuration =
                (lastEvent.timestamp - firstEvent.timestamp) / 1000
            console.log('⏱️ CodeScrubber timing:', {
                firstEventTime: firstEvent.timestamp,
                lastEventTime: lastEvent.timestamp,
                calculatedDuration,
                providedDuration: duration,
                currentTime,
            })
        }

        // Group events into frames for analysis
        const frames = groupEventsIntoFrames(events)
        console.log('🎞️ Event frames:', {
            frameCount: frames.length,
            averageEventsPerFrame: events.length / frames.length,
            firstFrame: frames[0],
            lastFrame: frames[frames.length - 1],
            frames, // Log all frames
        })
    }, [events, duration, timelineWidth, currentTime, isPlaying])

    // Group events into frames for smoother scrubbing
    const groupEventsIntoFrames = React.useCallback((events: EditorEvent[]) => {
        if (events.length === 0) return []

        const frames: EditorEvent[][] = []
        let currentFrame: EditorEvent[] = []
        let lastTimestamp = events[0].timestamp

        events.forEach(event => {
            // Start new frame if we've exceeded the time threshold or event count
            if (
                currentFrame.length >= PLAYBACK_THRESHOLDS.EVENTS_PER_FRAME ||
                event.timestamp - lastTimestamp >= PLAYBACK_THRESHOLDS.FRAME_MS
            ) {
                if (currentFrame.length > 0) {
                    frames.push(currentFrame)
                    currentFrame = []
                }
            }

            currentFrame.push(event)
            lastTimestamp = event.timestamp
        })

        // Push the last frame if it has events
        if (currentFrame.length > 0) {
            frames.push(currentFrame)
        }

        return frames
    }, [])

    // Handle timeline layout
    const handleTimelineLayout = React.useCallback(
        (event: LayoutChangeEvent) => {
            const { width, x } = event.nativeEvent.layout
            timelineLayout.current = { width, x }
            setTimelineWidth(width)

            // Set initial playhead position
            const position = (currentTime / duration) * width
            playheadAnim.setValue(position)
        },
        [currentTime, duration, playheadAnim],
    )

    // Pan responder for scrubbing
    const panResponder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: () => {
                    setIsScrubbing(true)
                },
                onPanResponderMove: (_, gestureState) => {
                    const { x } = timelineLayout.current
                    const newPosition = Math.max(
                        0,
                        Math.min(timelineWidth, gestureState.moveX - x),
                    )
                    playheadAnim.setValue(newPosition)

                    // Calculate and update time
                    const time = (newPosition / timelineWidth) * duration
                    onSeek(time)
                },
                onPanResponderRelease: () => {
                    setIsScrubbing(false)
                },
            }),
        [duration, onSeek, playheadAnim, timelineWidth],
    )

    // Update playhead position when time changes (if not scrubbing)
    React.useEffect(() => {
        if (!isScrubbing && timelineWidth > 0) {
            const position = (currentTime / duration) * timelineWidth
            playheadAnim.setValue(position)
        }
    }, [currentTime, duration, isScrubbing, playheadAnim, timelineWidth])

    return (
        <View style={styles.container}>
            {/* Timeline */}
            <View
                style={styles.timeline}
                onLayout={handleTimelineLayout}
                {...panResponder.panHandlers}
            >
                {/* Event markers */}
                {events.map((event, index) => {
                    const position =
                        (event.timestamp / duration) * timelineWidth
                    return (
                        <View
                            key={index}
                            style={[styles.eventMarker, { left: position }]}
                        />
                    )
                })}

                {/* Playhead */}
                <Animated.View
                    style={[
                        styles.playhead,
                        {
                            transform: [
                                {
                                    translateX: playheadAnim.interpolate({
                                        inputRange: [0, timelineWidth],
                                        outputRange: [0, timelineWidth],
                                        extrapolate: 'clamp',
                                    }),
                                },
                            ],
                        },
                    ]}
                />
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <MaterialCommunityIcons
                    name={isPlaying ? 'pause' : 'play'}
                    size={24}
                    color="#FFFFFF"
                    onPress={onPlayPause}
                />
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
        </View>
    )
}

// Helper to format time as MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        padding: 16,
    },
    timeline: {
        height: 40,
        backgroundColor: '#2A2A2A',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    playhead: {
        position: 'absolute',
        top: 0,
        width: 2,
        height: '100%',
        backgroundColor: '#0A84FF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    eventMarker: {
        position: 'absolute',
        top: '50%',
        width: 2,
        height: 8,
        marginTop: -4,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingHorizontal: 8,
    },
    timeText: {
        color: '#FFFFFF',
        fontSize: 12,
        opacity: 0.7,
    },
})
