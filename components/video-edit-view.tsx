import React from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { supabase } from '@/lib/supabase.client'

import { VideoScrubber } from './video-scrubber'

import type { VideoMetadata } from '@/types/webrtc'

interface VideoEditViewProps {
    videoId: string
    onClose: () => void
}

// Throttle helper function
function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number,
): (...args: Parameters<T>) => void {
    let inThrottle = false
    return function (this: any, ...args: Parameters<T>) {
        if (!inThrottle) {
            func.apply(this, args)
            inThrottle = true
            setTimeout(() => (inThrottle = false), limit)
        }
    }
}

export function VideoEditView({ videoId, onClose }: VideoEditViewProps) {
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [video, setVideo] = React.useState<VideoMetadata | null>(null)
    const [videoUrl, setVideoUrl] = React.useState<string | null>(null)
    const [, setCurrentTime] = React.useState(0)
    const currentTimeRef = React.useRef(0)
    const [duration, setDuration] = React.useState(0)
    const [trimStart, setTrimStart] = React.useState(0)
    const [trimEnd, setTrimEnd] = React.useState(0)
    const [thumbnailsLoading, setThumbnailsLoading] = React.useState(false)
    const [thumbnails, setThumbnails] = React.useState<string[]>([])
    const [timelineWidth] = React.useState(0)
    const [isScrubbing] = React.useState(false)
    const [isPlaying, setIsPlaying] = React.useState(false)
    const [isTrimming, setIsTrimming] = React.useState(false)
    const isPlayingRef = React.useRef(false)
    const videoRef = React.useRef<Video>(null)
    const playheadAnim = React.useRef(new Animated.Value(0)).current
    const timelineLayout = React.useRef<{ x: number; width: number }>({
        x: 0,
        width: 0,
    })
    const animationFrameRef = React.useRef<number>()

    // Update both ref and state when setting time
    const updateCurrentTime = React.useCallback((time: number) => {
        currentTimeRef.current = time
        setCurrentTime(time)
    }, [])

    // Create throttled video position update function with final update flag
    const updateVideoPosition = React.useCallback(
        throttle((newTime: number) => {
            if (!videoRef.current) return
            videoRef.current
                .setPositionAsync(newTime * 1000, {
                    toleranceMillisBefore: 0,
                    toleranceMillisAfter: 0,
                })
                .catch(err => {
                    console.warn('Failed to update video position:', err)
                })
        }, 16),
        [],
    )

    // Update playing state
    const updatePlayingState = React.useCallback((playing: boolean) => {
        isPlayingRef.current = playing
        setIsPlaying(playing)
    }, [])

    // Handle play/pause
    const togglePlayback = async () => {
        if (!videoRef.current) return

        if (isPlayingRef.current) {
            await videoRef.current.pauseAsync()
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        } else {
            await videoRef.current.playAsync()
            startPlayheadAnimation()
        }
        updatePlayingState(!isPlayingRef.current)
    }

    // Animate playhead smoothly
    const startPlayheadAnimation = () => {
        let lastTime = performance.now()

        const animate = () => {
            if (!videoRef.current || !isPlayingRef.current) return

            const now = performance.now()
            const deltaTime = (now - lastTime) / 1000 // Convert to seconds
            lastTime = now

            // Use the ref for accurate frame-by-frame updates
            const newTime = currentTimeRef.current + deltaTime
            if (newTime >= duration) {
                // Video ended
                videoRef.current.pauseAsync()
                updatePlayingState(false)
                return
            }

            // Update both ref and state
            updateCurrentTime(newTime)

            // Update playhead position
            if (timelineLayout.current.width > 0) {
                const position =
                    (newTime / duration) * timelineLayout.current.width
                playheadAnim.setValue(position)
            }

            animationFrameRef.current = requestAnimationFrame(animate)
        }

        lastTime = performance.now()
        animate()
    }

    // Clean up animation frame on unmount
    React.useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [])

    // Handle video status update with proper scrubbing check
    const handleVideoStatus = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return

        // Update playing state from video status
        const wasPlaying = isPlayingRef.current
        const isVideoPlaying = status.isPlaying || false

        if (wasPlaying !== isVideoPlaying) {
            updatePlayingState(isVideoPlaying)
            if (isVideoPlaying) {
                startPlayheadAnimation()
            } else if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }

        // Sync time with video when not scrubbing
        if (!isScrubbing && status.positionMillis !== undefined) {
            const videoTime = status.positionMillis / 1000
            // Only update if the difference is significant
            if (Math.abs(videoTime - currentTimeRef.current) > 0.1) {
                updateCurrentTime(videoTime)
                if (timelineLayout.current.width > 0) {
                    const position =
                        (videoTime / duration) * timelineLayout.current.width
                    playheadAnim.setValue(position)
                }
            }
        }
    }

    // Fetch video details and signed URL
    React.useEffect(() => {
        async function fetchVideo() {
            try {
                const { data, error } = await supabase
                    .from('videos')
                    .select('*')
                    .eq('id', videoId)
                    .single()

                if (error) throw error
                setVideo(data)
                setTrimEnd(data.duration)

                // Get signed URL for video
                const { data: signedUrlData, error: signedUrlError } =
                    await supabase.storage
                        .from('videos')
                        .createSignedUrl(data.storage_path, 3600)

                if (signedUrlError) throw signedUrlError
                if (signedUrlData?.signedUrl) {
                    setVideoUrl(signedUrlData.signedUrl)
                }
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : 'Failed to load video',
                )
            } finally {
                setLoading(false)
            }
        }

        fetchVideo()
    }, [videoId])

    // Generate thumbnails when video loads
    const generateThumbnails = React.useCallback(
        async (videoUri: string) => {
            if (!duration) {
                console.warn(
                    '❌ Cannot generate thumbnails: duration is not set',
                )
                return
            }

            console.log('🎬 Starting thumbnail generation for video:', videoUri)
            setThumbnailsLoading(true)
            try {
                const thumbnailCount = 5 // Number of thumbnails to generate
                const interval = duration / (thumbnailCount - 1) // Time between thumbnails
                const newThumbnails: string[] = []

                for (let i = 0; i < thumbnailCount; i++) {
                    const time = i * interval * 1000 // Convert to milliseconds
                    try {
                        console.log(
                            `📸 Generating thumbnail ${i + 1}/${thumbnailCount} at ${time}ms`,
                        )
                        const { uri } = await VideoThumbnails.getThumbnailAsync(
                            videoUri,
                            {
                                time,
                                quality: 0.5,
                            },
                        )
                        console.log(`✅ Generated thumbnail ${i + 1}:`, uri)
                        newThumbnails.push(uri)
                    } catch (err) {
                        console.warn(
                            `❌ Failed to generate thumbnail ${i + 1}:`,
                            err,
                        )
                    }
                }

                console.log(
                    `🎯 Generated ${newThumbnails.length} thumbnails successfully`,
                )
                setThumbnails(newThumbnails)
            } catch (err) {
                console.error('❌ Failed to generate thumbnails:', err)
            } finally {
                setThumbnailsLoading(false)
            }
        },
        [duration],
    )

    // Effect to trigger thumbnail generation when video URL and duration are available
    React.useEffect(() => {
        if (videoUrl && duration > 0) {
            console.log(
                '🎯 Video URL and duration available, generating thumbnails:',
                {
                    videoUrl,
                    duration,
                },
            )
            generateThumbnails(videoUrl)
        }
    }, [videoUrl, duration, generateThumbnails])

    // Handle video load
    const handleVideoLoad = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            console.warn('❌ Video load failed:', status)
            return
        }
        console.log('📼 Video loaded:', status)

        // Ensure video is paused initially
        videoRef.current?.pauseAsync()

        if (status.durationMillis) {
            const videoDuration = status.durationMillis / 1000
            console.log('⏱️ Video duration:', videoDuration)
            setDuration(videoDuration)
            setTrimEnd(videoDuration) // Initialize trimEnd to full duration

            // Set initial playhead position
            if (timelineWidth > 0) {
                const initialPosition =
                    (status.positionMillis / 1000 / videoDuration) *
                    timelineWidth
                playheadAnim.setValue(initialPosition)
            }
        } else {
            console.warn('❌ Video loaded but duration is not available')
        }
    }

    // Handle trim points update
    const handleTrimChange = React.useCallback(
        (start: number, end: number) => {
            // Ensure values are within valid bounds
            const validStart = Math.max(0, Math.min(start, duration - 1))
            const validEnd = Math.min(duration, Math.max(end, validStart + 1))

            // Only update if values have actually changed
            if (validStart !== trimStart || validEnd !== trimEnd) {
                console.log('Parent updating trim points:', {
                    start: validStart,
                    end: validEnd,
                    duration,
                })
                setTrimStart(validStart)
                setTrimEnd(validEnd)

                // Check if the current playhead position is before the new trim start
                if (currentTimeRef.current < validStart) {
                    // Update the playhead position to the new trim start
                    updateCurrentTime(validStart)
                    updateVideoPosition(validStart)

                    // Update the visual playhead position
                    if (timelineLayout.current.width > 0) {
                        const newPosition =
                            (validStart / duration) *
                            timelineLayout.current.width
                        playheadAnim.setValue(newPosition)
                    }
                }

                // If video is playing, ensure we're within trim bounds
                if (isPlayingRef.current && currentTimeRef.current) {
                    const constrainedTime = Math.max(
                        validStart,
                        Math.min(currentTimeRef.current, validEnd),
                    )
                    if (constrainedTime !== currentTimeRef.current) {
                        updateVideoPosition(constrainedTime)
                    }
                }
            }
        },
        [duration, trimStart, trimEnd, updateVideoPosition, updateCurrentTime],
    )

    // Handle trim drag state
    const handleTrimDragStart = React.useCallback(() => {
        setIsTrimming(true)
    }, [])

    const handleTrimDragEnd = React.useCallback(() => {
        setIsTrimming(false)
    }, [])

    // Handle seeking with trim boundaries
    const handleSeek = React.useCallback(
        (time: number) => {
            // Constrain seek position to trim boundaries
            const constrainedTime = Math.max(trimStart, Math.min(time, trimEnd))
            updateCurrentTime(constrainedTime)
            updateVideoPosition(constrainedTime)
        },
        [trimStart, trimEnd, updateCurrentTime, updateVideoPosition],
    )

    if (loading || !video || !videoUrl) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <Text style={styles.loadingText}>Loading video...</Text>
                </View>
            </SafeAreaView>
        )
    }

    if (error) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable onPress={onClose} style={styles.button}>
                        <Text style={styles.buttonText}>Close</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <View style={styles.root}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header */}
                <View style={styles.navBar}>
                    <Pressable onPress={onClose}>
                        <Text style={styles.navButton}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.navTitle}>Video</Text>
                    <Pressable
                        onPress={() => {
                            // Log trim values and metadata
                            const trimData = {
                                videoId,
                                trimStart,
                                trimEnd,
                                duration,
                                trimmedDuration: trimEnd - trimStart,
                            }
                            console.log('Video trim complete:', trimData)

                            // TODO: In the future, we'll want to:
                            // 1. Save the trim points to the database
                            // 2. Generate a new trimmed video
                            // 3. Update the video metadata
                            // For now, just close
                            onClose()
                        }}
                    >
                        <Text style={styles.navButton}>Done</Text>
                    </Pressable>
                </View>

                {/* Main Content */}
                <View style={styles.content}>
                    {/* Video Preview */}
                    <View style={styles.videoContainer}>
                        <Video
                            ref={videoRef}
                            source={{ uri: videoUrl }}
                            style={styles.video}
                            resizeMode={ResizeMode.CONTAIN}
                            onLoad={handleVideoLoad}
                            onPlaybackStatusUpdate={handleVideoStatus}
                            useNativeControls={false}
                            shouldPlay={false}
                        />
                    </View>

                    {/* Scrubber */}
                    <VideoScrubber
                        videoRef={videoRef}
                        duration={duration}
                        currentTime={currentTimeRef.current}
                        isPlaying={isPlaying}
                        thumbnails={thumbnails}
                        thumbnailsLoading={thumbnailsLoading}
                        onSeek={handleSeek}
                        onPlayPause={togglePlayback}
                        trimStart={trimStart}
                        trimEnd={trimEnd}
                        onTrimChange={handleTrimChange}
                        onTrimDragStart={handleTrimDragStart}
                        onTrimDragEnd={handleTrimDragEnd}
                        isTrimming={isTrimming}
                    />

                    {/* Bottom Toolbar */}
                    <View style={styles.toolbarContainer}>
                        <View style={styles.toolButton}>
                            <MaterialCommunityIcons
                                name="video"
                                size={24}
                                color="#FFFFFF"
                            />
                            <Text style={styles.toolButtonText}>Video</Text>
                        </View>
                        <View style={styles.toolButton}>
                            <MaterialCommunityIcons
                                name="crop"
                                size={24}
                                color="#FFFFFF"
                            />
                            <Text style={styles.toolButtonText}>Crop</Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#121212',
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#121212',
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
    navBar: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#121212',
    },
    navButton: {
        fontSize: 17,
        color: '#FFFFFF',
    },
    navTitle: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        backgroundColor: '#121212',
    },
    videoContainer: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: '#121212',
    },
    toolbarContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 20,
        paddingBottom: 40,
        backgroundColor: '#121212',
    },
    toolButton: {
        alignItems: 'center',
    },
    toolButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 17,
    },
    errorText: {
        color: '#FF453A',
        fontSize: 17,
        marginBottom: 16,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    buttonText: {
        color: '#0A84FF',
        fontSize: 17,
        fontWeight: '400',
    },
    handleContainer: {
        width: '100%',
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handle: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#424246',
    },
})
