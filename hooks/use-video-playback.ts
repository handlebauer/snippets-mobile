import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'

import type { AVPlaybackStatus, Video } from 'expo-av'

interface UseVideoPlaybackOptions {
    duration: number
    trimStart: number
    trimEnd: number
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

export function useVideoPlayback({ trimEnd }: UseVideoPlaybackOptions) {
    const [currentTime, setCurrentTime] = useState(0)
    const currentTimeRef = useRef(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const isPlayingRef = useRef(false)
    const videoRef = useRef<Video>(null)
    const playheadAnim = useRef(new Animated.Value(0)).current
    const animationFrameRef = useRef<number>()

    // Update both ref and state when setting time
    const updateCurrentTime = useCallback((time: number) => {
        currentTimeRef.current = time
        setCurrentTime(time)
    }, [])

    // Create throttled video position update function
    const updateVideoPosition = useCallback(
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
    const updatePlayingState = useCallback((playing: boolean) => {
        isPlayingRef.current = playing
        setIsPlaying(playing)
    }, [])

    // Handle play/pause
    const togglePlayback = useCallback(async () => {
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
    }, [])

    // Animate playhead smoothly
    const startPlayheadAnimation = useCallback(() => {
        let lastTime = performance.now()

        const animate = () => {
            if (!videoRef.current || !isPlayingRef.current) return

            const now = performance.now()
            const deltaTime = (now - lastTime) / 1000 // Convert to seconds
            lastTime = now

            // Use the ref for accurate frame-by-frame updates
            const newTime = currentTimeRef.current + deltaTime
            if (newTime >= trimEnd) {
                // Video ended
                videoRef.current.pauseAsync()
                updatePlayingState(false)
                return
            }

            // Update both ref and state
            updateCurrentTime(newTime)

            animationFrameRef.current = requestAnimationFrame(animate)
        }

        lastTime = performance.now()
        animate()
    }, [trimEnd, updateCurrentTime, updatePlayingState])

    // Handle video status update
    const handleVideoStatus = useCallback(
        (status: AVPlaybackStatus) => {
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
            if (status.positionMillis !== undefined) {
                const videoTime = status.positionMillis / 1000
                // Only update if the difference is significant
                if (Math.abs(videoTime - currentTimeRef.current) > 0.1) {
                    updateCurrentTime(videoTime)
                }
            }
        },
        [updateCurrentTime, updatePlayingState, startPlayheadAnimation],
    )

    // Clean up animation frame on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [])

    return {
        currentTime,
        isPlaying,
        videoRef,
        playheadAnim,
        updateCurrentTime,
        updateVideoPosition,
        togglePlayback,
        handleVideoStatus,
    }
}
