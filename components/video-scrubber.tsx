import React from 'react'
import {
    Animated,
    Image,
    PanResponder,
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

interface VideoScrubberProps {
    videoRef: React.RefObject<Video>
    duration: number
    currentTime: number
    isPlaying: boolean
    thumbnails: string[]
    thumbnailsLoading: boolean
    onSeek: (time: number) => void
    onPlayPause: () => void
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
}: VideoScrubberProps) {
    const [isScrubbing, setIsScrubbing] = React.useState(false)
    const timelineRef = React.useRef<View>(null)
    const timelineLayout = React.useRef<{ x: number; width: number }>({
        x: 0,
        width: 0,
    })
    const playheadAnim = React.useRef(new Animated.Value(0)).current

    // Calculate position relative to timeline
    const calculateTimelinePosition = (pageX: number): number => {
        const relativeX = pageX - timelineLayout.current.x
        return Math.max(0, Math.min(relativeX, timelineLayout.current.width))
    }

    // Update scrubbing position
    const updateScrubPosition = (position: number) => {
        if (!duration || !timelineLayout.current.width) return

        const newTime = (position / timelineLayout.current.width) * duration
        playheadAnim.setValue(position)
        onSeek(newTime)
    }

    // Update playhead position when currentTime changes
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
                    if (!duration || !timelineLayout.current.width) return false
                    setIsScrubbing(true)
                    return true
                },
                onMoveShouldSetPanResponder: () => true,
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
        [duration, updateScrubPosition],
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
                    onLayout={event => {
                        const { width } = event.nativeEvent.layout
                        if (width === timelineLayout.current.width) return

                        timelineRef.current?.measure(
                            (x, y, width, height, pageX) => {
                                timelineLayout.current = {
                                    x: pageX,
                                    width: width,
                                }
                            },
                        )
                    }}
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
})
