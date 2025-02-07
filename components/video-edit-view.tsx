import { Buffer } from 'buffer'
import React from 'react'
import {
    Animated,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ResizeMode, Video } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native'

import { supabase } from '@/lib/supabase.client'
import { useScreenOrientation } from '@/hooks/use-screen-orientation'

import { VideoScrubber } from './video-scrubber'

import type { VideoMetadata } from '@/types/webrtc'
import type { AVPlaybackStatus } from 'expo-av'

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
    const { isLandscape, unlockOrientation, lockToPortrait } =
        useScreenOrientation()
    const [activeTab, setActiveTab] = React.useState<
        'video' | 'adjust' | 'crop'
    >('video')

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
        if (!status.isLoaded) {
            // Only log a warning if this isn't an initial load state
            if ('target' in status) {
                console.debug('Video not ready yet:', status)
            }
            return
        }

        console.log('🎥 Video status update:', {
            isPlaying: status.isPlaying,
            positionMillis: status.positionMillis,
            durationMillis: status.durationMillis,
            shouldPlay: status.shouldPlay,
            isBuffering: status.isBuffering,
        })

        // Update playing state from video status
        const wasPlaying = isPlayingRef.current
        const isVideoPlaying = status.isPlaying || false

        if (wasPlaying !== isVideoPlaying) {
            console.log('🔄 Playing state changed:', {
                wasPlaying,
                isVideoPlaying,
            })
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
                console.log('⏰ Updating time:', {
                    videoTime,
                    currentTime: currentTimeRef.current,
                    timelineWidth: timelineWidth,
                })
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
                console.log('🔍 Fetching video details for:', videoId)
                const { data, error } = await supabase
                    .from('videos')
                    .select('*')
                    .eq('id', videoId)
                    .single()

                if (error) throw error
                console.log('📝 Video data:', data)

                // Check if the video file exists in storage
                const { data: fileData, error: fileError } =
                    await supabase.storage.from('videos').list(videoId)

                if (fileError) {
                    console.error('❌ Error checking video file:', fileError)
                    throw fileError
                }

                console.log('📁 Storage files:', fileData)

                // Try to find trimmed version first, fall back to most recent video file
                const videoFile =
                    fileData.find(f => f.name === 'trimmed.mp4') ||
                    fileData.find(
                        f =>
                            f.name.endsWith('.mp4') && f.name !== 'trimmed.mp4',
                    )

                if (!videoFile) {
                    throw new Error('No video file found in storage')
                }

                console.log('📊 Video file details:', {
                    name: videoFile.name,
                    size: videoFile.metadata?.size || 0,
                    mimeType: videoFile.metadata?.mimetype,
                })

                setVideo(data)

                // Get signed URL for video
                const { data: signedUrlData, error: signedUrlError } =
                    await supabase.storage
                        .from('videos')
                        .createSignedUrl(data.storage_path, 3600)

                if (signedUrlError) throw signedUrlError
                if (signedUrlData?.signedUrl) {
                    console.log('🔗 Got signed URL:', {
                        url: signedUrlData.signedUrl,
                        storagePath: data.storage_path,
                    })
                    setVideoUrl(signedUrlData.signedUrl)
                }

                // We'll set the actual duration when the video loads
                console.log('⚡ Initial duration setup:', {
                    duration: data.duration,
                    trimStart: 0,
                    trimEnd: data.duration,
                })
                setDuration(data.duration)
                setTrimStart(0)
                setTrimEnd(data.duration)
            } catch (err) {
                console.error('❌ Error fetching video:', err)
                setError(
                    err instanceof Error ? err.message : 'Failed to load video',
                )
            } finally {
                setLoading(false)
            }
        }

        fetchVideo()
    }, [videoId])

    // Generate thumbnails
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
                    const time = Math.round(i * interval * 1000) // Convert to milliseconds and round to integer
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

                if (newThumbnails.length > 0) {
                    console.log(
                        `🎯 Generated ${newThumbnails.length} thumbnails successfully`,
                    )
                    setThumbnails(newThumbnails)
                }
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
        const shouldGenerateThumbnails =
            videoUrl &&
            duration > 0 &&
            thumbnails.length === 0 &&
            !thumbnailsLoading

        if (shouldGenerateThumbnails) {
            console.log(
                '🎯 Video URL and duration available, generating thumbnails:',
                {
                    videoUrl,
                    duration,
                    existingThumbnails: thumbnails.length,
                    isLoading: thumbnailsLoading,
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
        console.log('📼 Video loaded:', {
            status,
            hasVideo: videoRef.current !== null,
            currentDuration: duration,
        })

        // Ensure video is paused initially
        videoRef.current?.pauseAsync()

        if (status.durationMillis) {
            const videoDuration = status.durationMillis / 1000
            console.log('⏱️ Setting video duration:', {
                videoDuration,
                previousDuration: duration,
                hasTimelineWidth: timelineWidth > 0,
            })
            setDuration(videoDuration)
            setTrimEnd(videoDuration) // Initialize trimEnd to full duration

            // Set initial playhead position
            if (timelineWidth > 0) {
                const initialPosition =
                    (status.positionMillis / 1000 / videoDuration) *
                    timelineWidth
                console.log('🎯 Setting initial playhead:', {
                    initialPosition,
                    timelineWidth,
                    positionMillis: status.positionMillis,
                })
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

    // Add error boundary for video loading
    const handleError = (error: string) => {
        console.error('🚨 Video loading error:', error)
    }

    // Handle orientation on mount/unmount
    React.useEffect(() => {
        // Unlock orientation when component mounts
        unlockOrientation()

        // Lock back to portrait when component unmounts
        return () => {
            lockToPortrait()
        }
    }, [unlockOrientation, lockToPortrait])

    if (loading || !video || !videoUrl) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <Text style={styles.loadingText}>
                        {loading && video
                            ? 'Trimming video...'
                            : 'Loading video...'}
                    </Text>
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
            <StatusBar
                translucent={true}
                backgroundColor="transparent"
                barStyle="light-content"
                hidden={isLandscape}
            />
            <SafeAreaView
                style={styles.safeArea}
                edges={isLandscape ? ['left', 'right'] : ['top']}
            >
                {/* Header */}
                <View
                    style={[
                        styles.navBar,
                        isLandscape && styles.navBarLandscape,
                    ]}
                >
                    <Pressable onPress={onClose}>
                        <Text style={styles.navButton}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.navTitle}>Video</Text>
                    <Pressable
                        onPress={async () => {
                            try {
                                // Create a temporary directory for the trimmed video
                                const tempDir = `${FileSystem.cacheDirectory}video-trim-${videoId}/`
                                await FileSystem.makeDirectoryAsync(tempDir, {
                                    intermediates: true,
                                })

                                // Generate output path for trimmed video
                                const outputPath = `${tempDir}trimmed.mp4`

                                // Show loading state
                                setLoading(true)

                                // Construct FFmpeg command for trimming
                                // -ss: start time in seconds
                                // -t: duration in seconds
                                // -c copy: copy streams without re-encoding (fast)
                                const command = `-ss ${trimStart} -t ${trimEnd - trimStart} -i ${videoUrl} -c copy ${outputPath}`

                                console.log('Starting video trim:', {
                                    command,
                                    trimStart,
                                    trimEnd,
                                    duration: trimEnd - trimStart,
                                })

                                // Execute FFmpeg command
                                const session = await FFmpegKit.execute(command)
                                const returnCode = await session.getReturnCode()

                                if (ReturnCode.isSuccess(returnCode)) {
                                    console.log('Video trimmed successfully')

                                    // Verify the output file exists and has content
                                    const fileInfo =
                                        await FileSystem.getInfoAsync(
                                            outputPath,
                                        )
                                    if (!fileInfo.exists) {
                                        throw new Error(
                                            'Trimmed video file not created',
                                        )
                                    }

                                    // Read the file as binary data
                                    const binaryFile =
                                        await FileSystem.readAsStringAsync(
                                            outputPath,
                                            {
                                                encoding:
                                                    FileSystem.EncodingType
                                                        .Base64,
                                            },
                                        )

                                    // Convert base64 to Uint8Array for upload
                                    const binaryData = Buffer.from(
                                        binaryFile,
                                        'base64',
                                    )

                                    console.log('📊 File info:', {
                                        exists: fileInfo.exists,
                                        uri: fileInfo.uri,
                                        binaryLength: binaryData.length,
                                        base64Length: binaryFile.length,
                                    })

                                    if (
                                        !binaryData ||
                                        binaryData.length === 0
                                    ) {
                                        throw new Error(
                                            'Failed to read trimmed video file',
                                        )
                                    }

                                    const newStoragePath = `${videoId}/trimmed.mp4`

                                    // Upload the binary data
                                    const { error: uploadError } =
                                        await supabase.storage
                                            .from('videos')
                                            .upload(
                                                newStoragePath,
                                                binaryData,
                                                {
                                                    contentType: 'video/mp4',
                                                    upsert: true,
                                                },
                                            )

                                    if (uploadError) {
                                        console.error(
                                            'Upload error:',
                                            uploadError,
                                        )
                                        throw uploadError
                                    }

                                    // Verify the upload by checking the file exists
                                    const { data: files, error: listError } =
                                        await supabase.storage
                                            .from('videos')
                                            .list(videoId)

                                    if (listError) {
                                        throw listError
                                    }

                                    const uploadedFile = files.find(
                                        f => f.name === 'trimmed.mp4',
                                    )
                                    if (!uploadedFile) {
                                        throw new Error(
                                            'Failed to verify uploaded file',
                                        )
                                    }

                                    console.log('✅ Upload verified:', {
                                        name: uploadedFile.name,
                                        size: uploadedFile.metadata?.size || 0,
                                    })

                                    // Update video metadata in database
                                    const { error: updateError } =
                                        await supabase
                                            .from('videos')
                                            .update({
                                                storage_path: newStoragePath,
                                                duration: trimEnd - trimStart,
                                                trim_start: trimStart,
                                                trim_end: trimEnd,
                                                updated_at:
                                                    new Date().toISOString(),
                                            })
                                            .eq('id', videoId)

                                    if (updateError) throw updateError

                                    // Clean up temporary files
                                    await FileSystem.deleteAsync(tempDir, {
                                        idempotent: true,
                                    })

                                    console.log('Video update complete')
                                } else {
                                    throw new Error('Failed to trim video')
                                }
                            } catch (err) {
                                console.error('Error trimming video:', err)
                                setError(
                                    err instanceof Error
                                        ? err.message
                                        : 'Failed to trim video',
                                )
                            } finally {
                                setLoading(false)
                                onClose()
                            }
                        }}
                    >
                        <Text style={styles.navButton}>Done</Text>
                    </Pressable>
                </View>

                {/* Main Content */}
                <View
                    style={[
                        styles.content,
                        isLandscape && styles.contentLandscape,
                    ]}
                >
                    {/* Toolbar Container - Moved to be first in landscape */}
                    {isLandscape && (
                        <View
                            style={[
                                styles.controlsContainer,
                                styles.controlsContainerLandscape,
                            ]}
                        >
                            <View
                                style={[
                                    styles.toolbarContainer,
                                    styles.toolbarContainerLandscape,
                                ]}
                            >
                                <Pressable
                                    style={[
                                        styles.toolButton,
                                        activeTab === 'video' &&
                                            styles.toolButtonActive,
                                    ]}
                                    onPress={() => setActiveTab('video')}
                                >
                                    <MaterialCommunityIcons
                                        name="video"
                                        size={24}
                                        color={
                                            activeTab === 'video'
                                                ? '#0A84FF'
                                                : '#FFFFFF'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.toolButtonText,
                                            activeTab === 'video' &&
                                                styles.toolButtonTextActive,
                                        ]}
                                    >
                                        Video
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.toolButton,
                                        activeTab === 'adjust' &&
                                            styles.toolButtonActive,
                                    ]}
                                    onPress={() => setActiveTab('adjust')}
                                >
                                    <MaterialCommunityIcons
                                        name="tune"
                                        size={24}
                                        color={
                                            activeTab === 'adjust'
                                                ? '#0A84FF'
                                                : '#FFFFFF'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.toolButtonText,
                                            activeTab === 'adjust' &&
                                                styles.toolButtonTextActive,
                                        ]}
                                    >
                                        Adjust
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.toolButton,
                                        activeTab === 'crop' &&
                                            styles.toolButtonActive,
                                    ]}
                                    onPress={() => setActiveTab('crop')}
                                >
                                    <MaterialCommunityIcons
                                        name="crop"
                                        size={24}
                                        color={
                                            activeTab === 'crop'
                                                ? '#0A84FF'
                                                : '#FFFFFF'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.toolButtonText,
                                            activeTab === 'crop' &&
                                                styles.toolButtonTextActive,
                                        ]}
                                    >
                                        Crop
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    {/* Main Container */}
                    <View
                        style={[
                            styles.mainContainer,
                            isLandscape && styles.mainContainerLandscape,
                        ]}
                    >
                        {/* Video Preview */}
                        <View
                            style={[
                                styles.videoContainer,
                                isLandscape && styles.videoContainerLandscape,
                            ]}
                        >
                            <Video
                                ref={videoRef}
                                source={{ uri: videoUrl }}
                                style={[
                                    styles.video,
                                    isLandscape && styles.videoLandscape,
                                ]}
                                resizeMode={ResizeMode.CONTAIN}
                                onLoad={handleVideoLoad}
                                onPlaybackStatusUpdate={handleVideoStatus}
                                onError={handleError}
                                useNativeControls={false}
                                shouldPlay={false}
                                isLooping={false}
                                volume={1.0}
                            />
                        </View>

                        {/* Scrubber - Only show for video tab */}
                        {isLandscape ? (
                            <View style={styles.scrubberContainerLandscape}>
                                {activeTab === 'video' && (
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
                                )}
                            </View>
                        ) : (
                            activeTab === 'video' && (
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
                            )
                        )}
                    </View>

                    {/* Toolbar Container - Portrait mode */}
                    {!isLandscape && (
                        <View style={styles.controlsContainer}>
                            <View style={styles.toolbarContainer}>
                                <Pressable
                                    style={[
                                        styles.toolButton,
                                        activeTab === 'video' &&
                                            styles.toolButtonActive,
                                    ]}
                                    onPress={() => setActiveTab('video')}
                                >
                                    <MaterialCommunityIcons
                                        name="video"
                                        size={24}
                                        color={
                                            activeTab === 'video'
                                                ? '#0A84FF'
                                                : '#FFFFFF'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.toolButtonText,
                                            activeTab === 'video' &&
                                                styles.toolButtonTextActive,
                                        ]}
                                    >
                                        Video
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.toolButton,
                                        activeTab === 'adjust' &&
                                            styles.toolButtonActive,
                                    ]}
                                    onPress={() => setActiveTab('adjust')}
                                >
                                    <MaterialCommunityIcons
                                        name="tune"
                                        size={24}
                                        color={
                                            activeTab === 'adjust'
                                                ? '#0A84FF'
                                                : '#FFFFFF'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.toolButtonText,
                                            activeTab === 'adjust' &&
                                                styles.toolButtonTextActive,
                                        ]}
                                    >
                                        Adjust
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.toolButton,
                                        activeTab === 'crop' &&
                                            styles.toolButtonActive,
                                    ]}
                                    onPress={() => setActiveTab('crop')}
                                >
                                    <MaterialCommunityIcons
                                        name="crop"
                                        size={24}
                                        color={
                                            activeTab === 'crop'
                                                ? '#0A84FF'
                                                : '#FFFFFF'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.toolButtonText,
                                            activeTab === 'crop' &&
                                                styles.toolButtonTextActive,
                                        ]}
                                    >
                                        Crop
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
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
        paddingHorizontal: 32,
        backgroundColor: '#121212',
        marginTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
    },
    navBarLandscape: {
        marginTop: 0,
        paddingHorizontal: Platform.OS === 'ios' ? 64 : 32, // Extra padding for notch area
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
    contentLandscape: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    mainContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    mainContainerLandscape: {
        flex: 1,
        paddingVertical: 20,
        alignItems: 'center',
        marginLeft: Platform.OS === 'ios' ? 64 : 32, // Less margin on the left
        marginRight: 80, // Just enough space for the toolbar
    },
    videoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
        overflow: 'hidden',
        width: '100%',
    },
    videoContainerLandscape: {
        flex: 1,
        marginBottom: 20,
        width: '100%',
    },
    video: {
        flex: 1,
        aspectRatio: 16 / 9,
        backgroundColor: '#121212',
    },
    videoLandscape: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    scrubberContainerLandscape: {
        width: '100%',
        paddingHorizontal: 32,
        marginBottom: 20,
        overflow: 'hidden',
    },
    controlsContainer: {
        paddingBottom: 20,
    },
    controlsContainerLandscape: {
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: [{ translateY: -100 }], // Adjusted to better center the container
        zIndex: 1,
        height: 200, // Fixed height to help with centering
        justifyContent: 'center', // Center content vertically
    },
    toolbarContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingBottom: 32,
        backgroundColor: '#121212',
    },
    toolbarContainerLandscape: {
        flexDirection: 'column',
        paddingVertical: 16,
        paddingHorizontal: 16,
        width: 80,
        alignItems: 'center',
    },
    toolButton: {
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginVertical: 12,
    },
    toolButtonActive: {
        opacity: 1,
    },
    toolButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        opacity: 0.8,
    },
    toolButtonTextActive: {
        color: '#0A84FF',
        opacity: 1,
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
