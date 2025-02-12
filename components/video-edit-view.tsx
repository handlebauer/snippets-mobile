import { Buffer } from 'buffer'
import React from 'react'
import {
    ActivityIndicator,
    Animated,
    Platform,
    Pressable,
    Share,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ResizeMode, Video } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { useChannel } from '@/contexts/channel.context'
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native'

import { supabase } from '@/lib/supabase.client'
import { useScreenOrientation } from '@/hooks/use-screen-orientation'

import { FloatingMenu } from './floating-menu'
import { GitHubBadge } from './github-badge'
import { VideoBookmarksModal } from './video-bookmarks-modal'
import { VideoMetadataModal } from './video-metadata-modal'
import { VideoScrubber } from './video-scrubber'
import { VideoThumbnailSelectorModal } from './video-thumbnail-selector-modal'

import type { VideoMetadata } from '@/types/webrtc'
import type { AVPlaybackStatus } from 'expo-av'

interface VideoEditViewProps {
    videoId: string
}

interface Bookmark {
    id: string
    timestamp: number
    label?: string
    createdAt: string
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

export function VideoEditView({ videoId }: VideoEditViewProps) {
    const router = useRouter()
    const { referrer } = useLocalSearchParams<{ referrer?: string }>()
    const isFromPostRecording = referrer === 'post-recording'
    const { setIsStreaming } = useChannel()
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [video, setVideo] = React.useState<VideoMetadata | null>(null)
    const [videoUrl, setVideoUrl] = React.useState<string | null>(null)
    const [, setCurrentTime] = React.useState(0)
    const currentTimeRef = React.useRef(0)
    const [duration, setDuration] = React.useState(0)
    const [trimStart, setTrimStart] = React.useState(0)
    const [trimEnd, setTrimEnd] = React.useState(0)
    const [originalTrimStart, setOriginalTrimStart] = React.useState(0)
    const [originalTrimEnd, setOriginalTrimEnd] = React.useState(0)
    const [hasChanges, setHasChanges] = React.useState(isFromPostRecording)
    const trimChangeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
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
    const { isLandscape } = useScreenOrientation()
    const [activeTab, setActiveTab] = React.useState<
        'video' | 'adjust' | 'crop'
    >('video')
    const mainContainerRef = React.useRef<View>(null)
    const [showMetadataModal, setShowMetadataModal] = React.useState(false)
    const [bookmarks, setBookmarks] = React.useState<Bookmark[]>([])
    const [showBookmarksModal, setShowBookmarksModal] = React.useState(false)
    const [showMenu, setShowMenu] = React.useState(false)
    const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 })
    const moreButtonRef = React.useRef<View>(null)
    const [showThumbnailModal, setShowThumbnailModal] = React.useState(false)
    const [, setThumbnailLoading] = React.useState(false)

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
                setOriginalTrimStart(0)
                setOriginalTrimEnd(data.duration)
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
            // If thumbnails are already generated or loading, skip
            if (thumbnailsLoading || thumbnails.length > 0) {
                return
            }

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
        [duration, thumbnailsLoading, thumbnails.length], // Include necessary dependencies
    )

    // Effect to trigger thumbnail generation when video URL and duration are available
    React.useEffect(() => {
        const shouldGenerateThumbnails =
            videoUrl &&
            duration > 0 &&
            !thumbnailsLoading &&
            thumbnails.length === 0

        if (shouldGenerateThumbnails) {
            console.log('Generating thumbnails', {
                existingThumbnails: thumbnails.length,
                isLoading: thumbnailsLoading,
                duration,
            })
            generateThumbnails(videoUrl)
        }
    }, [videoUrl, duration, generateThumbnails]) // Include generateThumbnails since it now depends on state

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
            setTrimEnd(videoDuration)
            setOriginalTrimStart(0)
            setOriginalTrimEnd(videoDuration)

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

                // Clear any existing timeout
                if (trimChangeTimeoutRef.current) {
                    clearTimeout(trimChangeTimeoutRef.current)
                }

                // Set a new timeout to check if the trim points are close to original
                trimChangeTimeoutRef.current = setTimeout(() => {
                    const isCloseToOriginal =
                        Math.abs(validStart - originalTrimStart) < 0.1 &&
                        Math.abs(validEnd - originalTrimEnd) < 0.1
                    setHasChanges(!isCloseToOriginal)
                }, 100)

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
        [
            duration,
            trimStart,
            trimEnd,
            originalTrimStart,
            originalTrimEnd,
            updateVideoPosition,
            updateCurrentTime,
        ],
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

    // Handle delete video
    const handleDelete = async () => {
        if (!video) return

        try {
            setLoading(true)

            // Delete video file and thumbnail from storage
            const { error: storageError } = await supabase.storage
                .from('videos')
                .remove([`${videoId}/*`])

            if (storageError) throw storageError

            // Delete video record from database
            const { error: dbError } = await supabase
                .from('videos')
                .delete()
                .eq('id', videoId)

            if (dbError) throw dbError

            setIsStreaming(false) // Reset streaming state
            router.push('/(protected)/(tabs)/videos')
        } catch (err) {
            console.error('Failed to delete video:', err)
            setError(
                err instanceof Error ? err.message : 'Failed to delete video',
            )
        } finally {
            setLoading(false)
        }
    }

    // Replace onClose with router.back()
    const handleCancel = () => {
        setIsStreaming(false) // Reset streaming state
        router.back()
    }

    // Add share handler
    const handleShare = React.useCallback(async () => {
        if (!videoUrl) return

        try {
            const result = await Share.share({
                url: videoUrl,
                title: 'Share Recording',
                message: video?.linked_repo
                    ? `Check out my coding recording for ${video.linked_repo}`
                    : 'Check out my coding recording',
            })

            if (result.action === Share.sharedAction) {
                console.log('Shared successfully')
            }
        } catch (error) {
            console.error('Error sharing:', error)
        }
    }, [videoUrl, video?.linked_repo])

    const addBookmark = async () => {
        if (!videoRef.current) return

        try {
            const status = await videoRef.current.getStatusAsync()
            if (!status.isLoaded) return

            const timestamp = status.positionMillis / 1000

            // Check if bookmark already exists at this timestamp (using smaller threshold)
            if (bookmarks.some(b => Math.abs(b.timestamp - timestamp) < 0.1)) {
                return // Prevent duplicates within 0.1s instead of 0.5s
            }

            const newBookmark: Bookmark = {
                id: Math.random().toString(36).slice(2, 9),
                timestamp,
                createdAt: new Date().toISOString(),
            }

            setBookmarks(prev =>
                [...prev, newBookmark].sort(
                    (a, b) => a.timestamp - b.timestamp,
                ),
            )
        } catch (err) {
            console.error('Failed to add bookmark:', err)
        }
    }

    // Seek to bookmark timestamp
    const seekToBookmark = (timestamp: number) => {
        if (!videoRef.current) return

        // Update current time and seek
        updateCurrentTime(timestamp)
        updateVideoPosition(timestamp)

        // Update visual playhead
        if (timelineLayout.current.width > 0) {
            const position =
                (timestamp / duration) * timelineLayout.current.width
            playheadAnim.setValue(position)
        }
        setShowBookmarksModal(false) // Close modal after seeking
    }

    // Delete bookmark
    const deleteBookmark = (id: string) => {
        setBookmarks(prev => prev.filter(b => b.id !== id))
    }

    // Add thumbnail selection handler
    const handleThumbnailSelect = async (thumbnailUri: string) => {
        if (!video) return

        setThumbnailLoading(true)
        try {
            // Read the thumbnail file as base64
            const base64Data = await FileSystem.readAsStringAsync(
                thumbnailUri,
                {
                    encoding: FileSystem.EncodingType.Base64,
                },
            )

            // Convert base64 to binary data
            const binaryData = Buffer.from(base64Data, 'base64')

            // Generate consistent filename based on timestamp
            const fileName = `video_${Date.now()}`
            const thumbnailPath = `${videoId}/${fileName}_thumb.jpg`

            // Upload thumbnail to storage
            const { error: uploadError } = await supabase.storage
                .from('videos')
                .upload(thumbnailPath, binaryData, {
                    contentType: 'image/jpeg',
                    upsert: true,
                })

            if (uploadError) throw uploadError

            // Get public URL for the thumbnail
            const { data: publicUrlData } = supabase.storage
                .from('videos')
                .getPublicUrl(thumbnailPath)

            if (!publicUrlData?.publicUrl) {
                throw new Error('Failed to get public URL for thumbnail')
            }

            // Update video metadata
            const { error: updateError } = await supabase
                .from('videos')
                .update({
                    thumbnail_url: publicUrlData.publicUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', videoId)

            if (updateError) throw updateError

            // Update local video state
            setVideo(prev =>
                prev
                    ? {
                          ...prev,
                          thumbnail_url: publicUrlData.publicUrl,
                      }
                    : null,
            )
        } catch (err) {
            console.error('Failed to update thumbnail:', err)
        } finally {
            setThumbnailLoading(false)
        }
    }

    const handleUpdateBookmark = async (id: string, label: string) => {
        setBookmarks(prev =>
            prev.map(bookmark =>
                bookmark.id === id ? { ...bookmark, label } : bookmark,
            ),
        )
    }

    if (error) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable onPress={handleCancel} style={styles.button}>
                        <Text style={styles.buttonText}>Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        )
    }

    if (!video || !videoUrl) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <Text style={styles.loadingText}>Loading video...</Text>
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
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            )}
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
                    {isFromPostRecording ? (
                        <>
                            <Pressable onPress={handleDelete}>
                                <Text
                                    style={[
                                        styles.navButton,
                                        styles.deleteButton,
                                    ]}
                                >
                                    Delete
                                </Text>
                            </Pressable>
                            <View style={styles.titleContainer}>
                                <Text style={styles.navTitle}>Video</Text>
                                <Pressable
                                    onPress={_event => {
                                        if (moreButtonRef.current) {
                                            moreButtonRef.current.measure(
                                                (
                                                    _x,
                                                    _y,
                                                    _width,
                                                    _height,
                                                    pageX,
                                                    pageY,
                                                ) => {
                                                    setMenuPosition({
                                                        x: pageX,
                                                        y: pageY,
                                                    })
                                                    setShowMenu(true)
                                                },
                                            )
                                        }
                                    }}
                                    style={styles.moreButton}
                                    ref={moreButtonRef}
                                >
                                    <MaterialCommunityIcons
                                        name="dots-horizontal"
                                        size={24}
                                        color="#FFFFFF"
                                    />
                                </Pressable>
                            </View>
                            <Pressable
                                onPress={async () => {
                                    try {
                                        // Only proceed with trim if there are actual trim changes
                                        if (
                                            trimStart !== originalTrimStart ||
                                            trimEnd !== originalTrimEnd
                                        ) {
                                            // Create a temporary directory for the trimmed video
                                            const tempDir = `${FileSystem.cacheDirectory}video-trim-${videoId}/`
                                            await FileSystem.makeDirectoryAsync(
                                                tempDir,
                                                {
                                                    intermediates: true,
                                                },
                                            )

                                            // Generate output path for trimmed video
                                            const outputPath = `${tempDir}trimmed.mp4`

                                            // Show loading state
                                            setLoading(true)

                                            // Construct FFmpeg command for trimming
                                            // -ss: start time in seconds
                                            // -t: duration in seconds
                                            // -c copy: copy streams without re-encoding (fast)
                                            // -y: automatically overwrite output file
                                            const command = `-y -ss ${trimStart} -t ${trimEnd - trimStart} -i ${videoUrl} -c copy ${outputPath}`

                                            console.log(
                                                'Starting video trim:',
                                                {
                                                    command,
                                                    trimStart,
                                                    trimEnd,
                                                    duration:
                                                        trimEnd - trimStart,
                                                },
                                            )

                                            // Execute FFmpeg command
                                            const session =
                                                await FFmpegKit.execute(command)
                                            const returnCode =
                                                await session.getReturnCode()

                                            if (
                                                ReturnCode.isSuccess(returnCode)
                                            ) {
                                                console.log(
                                                    'Video trimmed successfully',
                                                )

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
                                                                FileSystem
                                                                    .EncodingType
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
                                                    binaryLength:
                                                        binaryData.length,
                                                    base64Length:
                                                        binaryFile.length,
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
                                                                contentType:
                                                                    'video/mp4',
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
                                                const {
                                                    data: files,
                                                    error: listError,
                                                } = await supabase.storage
                                                    .from('videos')
                                                    .list(videoId)

                                                if (listError) {
                                                    throw listError
                                                }

                                                const uploadedFile = files.find(
                                                    f =>
                                                        f.name ===
                                                        'trimmed.mp4',
                                                )
                                                if (!uploadedFile) {
                                                    throw new Error(
                                                        'Failed to verify uploaded file',
                                                    )
                                                }

                                                console.log(
                                                    '✅ Upload verified:',
                                                    {
                                                        name: uploadedFile.name,
                                                        size:
                                                            uploadedFile
                                                                .metadata
                                                                ?.size || 0,
                                                    },
                                                )

                                                // Update video metadata in database
                                                const { error: updateError } =
                                                    await supabase
                                                        .from('videos')
                                                        .update({
                                                            storage_path:
                                                                newStoragePath,
                                                            duration:
                                                                trimEnd -
                                                                trimStart,
                                                            trim_start:
                                                                trimStart,
                                                            trim_end: trimEnd,
                                                            updated_at:
                                                                new Date().toISOString(),
                                                        })
                                                        .eq('id', videoId)

                                                if (updateError)
                                                    throw updateError

                                                // Clean up temporary files
                                                await FileSystem.deleteAsync(
                                                    tempDir,
                                                    {
                                                        idempotent: true,
                                                    },
                                                )

                                                console.log(
                                                    'Video update complete',
                                                )
                                            } else {
                                                throw new Error(
                                                    'Failed to trim video',
                                                )
                                            }
                                        }
                                    } catch (err) {
                                        console.error(
                                            'Error trimming video:',
                                            err,
                                        )
                                        setError(
                                            err instanceof Error
                                                ? err.message
                                                : 'Failed to trim video',
                                        )
                                        return // Don't proceed with navigation if there was an error
                                    } finally {
                                        setLoading(false)
                                    }

                                    // Always navigate back to videos screen when coming from post-recording
                                    setIsStreaming(false) // Reset streaming state
                                    router.push('/(protected)/(tabs)/videos')
                                }}
                                disabled={false} // Always enabled for post-recording
                                style={({ pressed }) => [
                                    styles.saveButton,
                                    pressed && styles.saveButtonPressed,
                                ]}
                            >
                                <Text style={styles.navButton}>Save</Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <Pressable onPress={handleCancel}>
                                <Text style={styles.navButton}>Close</Text>
                            </Pressable>
                            <View style={styles.titleContainer}>
                                <Text style={styles.navTitle}>Video</Text>
                                <Pressable
                                    onPress={_event => {
                                        if (moreButtonRef.current) {
                                            moreButtonRef.current.measure(
                                                (
                                                    _x,
                                                    _y,
                                                    _width,
                                                    _height,
                                                    pageX,
                                                    pageY,
                                                ) => {
                                                    setMenuPosition({
                                                        x: pageX,
                                                        y: pageY,
                                                    })
                                                    setShowMenu(true)
                                                },
                                            )
                                        }
                                    }}
                                    style={styles.moreButton}
                                    ref={moreButtonRef}
                                >
                                    <MaterialCommunityIcons
                                        name="dots-horizontal"
                                        size={24}
                                        color="#FFFFFF"
                                    />
                                </Pressable>
                            </View>
                            <Pressable
                                onPress={async () => {
                                    try {
                                        // Only proceed with trim if there are actual trim changes
                                        if (
                                            trimStart !== originalTrimStart ||
                                            trimEnd !== originalTrimEnd
                                        ) {
                                            // Create a temporary directory for the trimmed video
                                            const tempDir = `${FileSystem.cacheDirectory}video-trim-${videoId}/`
                                            await FileSystem.makeDirectoryAsync(
                                                tempDir,
                                                {
                                                    intermediates: true,
                                                },
                                            )

                                            // Generate output path for trimmed video
                                            const outputPath = `${tempDir}trimmed.mp4`

                                            // Show loading state
                                            setLoading(true)

                                            // Construct FFmpeg command for trimming
                                            // -ss: start time in seconds
                                            // -t: duration in seconds
                                            // -c copy: copy streams without re-encoding (fast)
                                            // -y: automatically overwrite output file
                                            const command = `-y -ss ${trimStart} -t ${trimEnd - trimStart} -i ${videoUrl} -c copy ${outputPath}`

                                            console.log(
                                                'Starting video trim:',
                                                {
                                                    command,
                                                    trimStart,
                                                    trimEnd,
                                                    duration:
                                                        trimEnd - trimStart,
                                                },
                                            )

                                            // Execute FFmpeg command
                                            const session =
                                                await FFmpegKit.execute(command)
                                            const returnCode =
                                                await session.getReturnCode()

                                            if (
                                                ReturnCode.isSuccess(returnCode)
                                            ) {
                                                console.log(
                                                    'Video trimmed successfully',
                                                )

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
                                                                FileSystem
                                                                    .EncodingType
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
                                                    binaryLength:
                                                        binaryData.length,
                                                    base64Length:
                                                        binaryFile.length,
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
                                                                contentType:
                                                                    'video/mp4',
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
                                                const {
                                                    data: files,
                                                    error: listError,
                                                } = await supabase.storage
                                                    .from('videos')
                                                    .list(videoId)

                                                if (listError) {
                                                    throw listError
                                                }

                                                const uploadedFile = files.find(
                                                    f =>
                                                        f.name ===
                                                        'trimmed.mp4',
                                                )
                                                if (!uploadedFile) {
                                                    throw new Error(
                                                        'Failed to verify uploaded file',
                                                    )
                                                }

                                                console.log(
                                                    '✅ Upload verified:',
                                                    {
                                                        name: uploadedFile.name,
                                                        size:
                                                            uploadedFile
                                                                .metadata
                                                                ?.size || 0,
                                                    },
                                                )

                                                // Update video metadata in database
                                                const { error: updateError } =
                                                    await supabase
                                                        .from('videos')
                                                        .update({
                                                            storage_path:
                                                                newStoragePath,
                                                            duration:
                                                                trimEnd -
                                                                trimStart,
                                                            trim_start:
                                                                trimStart,
                                                            trim_end: trimEnd,
                                                            updated_at:
                                                                new Date().toISOString(),
                                                        })
                                                        .eq('id', videoId)

                                                if (updateError)
                                                    throw updateError

                                                // Clean up temporary files
                                                await FileSystem.deleteAsync(
                                                    tempDir,
                                                    {
                                                        idempotent: true,
                                                    },
                                                )

                                                console.log(
                                                    'Video update complete',
                                                )
                                            } else {
                                                throw new Error(
                                                    'Failed to trim video',
                                                )
                                            }
                                        }
                                    } catch (err) {
                                        console.error(
                                            'Error trimming video:',
                                            err,
                                        )
                                        setError(
                                            err instanceof Error
                                                ? err.message
                                                : 'Failed to trim video',
                                        )
                                        return // Don't proceed with navigation if there was an error
                                    } finally {
                                        setLoading(false)
                                    }

                                    // Always navigate back to videos screen when coming from post-recording
                                    setIsStreaming(false) // Reset streaming state
                                    router.push('/(protected)/(tabs)/videos')
                                }}
                                disabled={!hasChanges} // Disabled when no changes in normal editing
                                style={({ pressed }) => [
                                    styles.saveButton,
                                    !hasChanges && styles.saveButtonDisabled,
                                    pressed && styles.saveButtonPressed,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.navButton,
                                        !hasChanges && styles.navButtonDisabled,
                                    ]}
                                >
                                    Save
                                </Text>
                            </Pressable>
                        </>
                    )}
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
                                        showBookmarksModal &&
                                            styles.toolButtonActive,
                                    ]}
                                    onPress={() => setShowBookmarksModal(true)}
                                >
                                    <MaterialCommunityIcons
                                        name="bookmark-outline"
                                        size={24}
                                        color={
                                            showBookmarksModal
                                                ? '#0A84FF'
                                                : '#FFFFFF'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.toolButtonText,
                                            showBookmarksModal &&
                                                styles.toolButtonTextActive,
                                        ]}
                                    >
                                        Bookmarks
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={styles.toolButton}
                                    onPress={handleShare}
                                >
                                    <MaterialCommunityIcons
                                        name={
                                            Platform.OS === 'ios'
                                                ? 'export-variant'
                                                : 'share-variant'
                                        }
                                        size={24}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.toolButtonText}>
                                        Share
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    {/* Main Container */}
                    <View
                        ref={mainContainerRef}
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
                            {video?.linked_repo && (
                                <GitHubBadge repoName={video.linked_repo} />
                            )}
                        </View>

                        {/* Scrubber - simplified layout */}
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
                                        showBookmarksModal &&
                                            styles.toolButtonActive,
                                    ]}
                                    onPress={() => setShowBookmarksModal(true)}
                                >
                                    <MaterialCommunityIcons
                                        name="bookmark-outline"
                                        size={24}
                                        color={
                                            showBookmarksModal
                                                ? '#0A84FF'
                                                : '#FFFFFF'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.toolButtonText,
                                            showBookmarksModal &&
                                                styles.toolButtonTextActive,
                                        ]}
                                    >
                                        Bookmarks
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={styles.toolButton}
                                    onPress={handleShare}
                                >
                                    <MaterialCommunityIcons
                                        name={
                                            Platform.OS === 'ios'
                                                ? 'export-variant'
                                                : 'share-variant'
                                        }
                                        size={24}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.toolButtonText}>
                                        Share
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
            </SafeAreaView>
            <FloatingMenu
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                anchorPosition={menuPosition}
                items={[
                    {
                        title: 'Video Details',
                        icon: 'information',
                        onPress: () => setShowMetadataModal(true),
                    },
                    {
                        title: 'Choose Thumbnail',
                        icon: 'image',
                        onPress: () => {
                            setShowMenu(false)
                            setShowThumbnailModal(true)
                        },
                    },
                ]}
            />
            {video && (
                <VideoMetadataModal
                    visible={showMetadataModal}
                    onClose={() => setShowMetadataModal(false)}
                    video={video}
                />
            )}
            <VideoBookmarksModal
                visible={showBookmarksModal}
                onClose={() => setShowBookmarksModal(false)}
                bookmarks={bookmarks}
                onAddBookmark={addBookmark}
                onDeleteBookmark={deleteBookmark}
                onSeekToBookmark={seekToBookmark}
                onUpdateBookmark={handleUpdateBookmark}
            />
            {videoUrl && (
                <VideoThumbnailSelectorModal
                    visible={showThumbnailModal}
                    onClose={() => setShowThumbnailModal(false)}
                    videoUri={videoUrl}
                    duration={duration}
                    onSelectThumbnail={handleThumbnailSelect}
                />
            )}
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
        marginTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
    },
    navBarLandscape: {
        marginTop: 0,
        paddingHorizontal: Platform.OS === 'ios' ? 64 : 32, // Extra padding for notch area
    },
    navButton: {
        fontSize: 16,
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
        flex: 1,
    },
    mainContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    mainContainerLandscape: {
        flex: 1,
        paddingVertical: 20,
        paddingHorizontal: Platform.OS === 'ios' ? 44 : 32,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    videoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
        overflow: 'hidden',
        width: '100%',
        marginBottom: 8,
    },
    videoContainerLandscape: {
        flex: 1,
        marginBottom: 16,
        width: '100%',
        maxHeight: '70%', // Ensure video doesn't take too much vertical space
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
        flex: 0,
        minHeight: 100,
    },
    controlsContainer: {
        paddingBottom: 8,
    },
    controlsContainerLandscape: {
        width: 100,
        backgroundColor: '#121212',
        paddingVertical: 20,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: '#333333',
        marginLeft: 16, // Add spacing between main content and toolbar
    },
    toolbarContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingBottom: 16,
        backgroundColor: '#121212',
    },
    toolbarContainerLandscape: {
        flexDirection: 'column',
        paddingVertical: 0,
        paddingHorizontal: 0,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    toolButton: {
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 12,
        marginVertical: 12,
        width: 64,
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
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    moreButton: {
        padding: 4,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    saveButton: {
        opacity: 1,
        padding: 8,
        borderRadius: 8,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonPressed: {
        opacity: 0.8,
    },
    navButtonDisabled: {
        color: '#999999',
    },
    repoBadgeLink: {
        position: 'absolute',
        bottom: 16,
        alignSelf: 'center',
    },
    repoBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    repoBadgeIcon: {
        marginRight: 6,
    },
    repoBadgeText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    bookmarkList: {
        flex: 1,
    },
    bookmarkListContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    bookmarkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        marginBottom: 8,
    },
    bookmarkItemPressed: {
        opacity: 0.7,
    },
    bookmarkInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bookmarkTimestamp: {
        color: '#FFFFFF',
        fontSize: 17,
    },
    deleteButton: {
        color: '#FF3B30',
    },
    emptyBookmarkList: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyBookmarkText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyBookmarkSubtext: {
        color: '#8E8E93',
        fontSize: 15,
        textAlign: 'center',
    },
})
