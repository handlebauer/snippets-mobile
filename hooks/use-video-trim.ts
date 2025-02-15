import { useCallback, useEffect, useRef, useState } from 'react'

interface UseVideoTrimOptions {
    duration: number
    isFromPostRecording?: boolean
}

export function useVideoTrim({
    duration,
    isFromPostRecording,
}: UseVideoTrimOptions) {
    const [trimStart, setTrimStart] = useState(0)
    const [trimEnd, setTrimEnd] = useState(duration)
    const [originalTrimStart, setOriginalTrimStart] = useState(0)
    const [originalTrimEnd, setOriginalTrimEnd] = useState(duration)
    const [hasChanges, setHasChanges] = useState(isFromPostRecording)
    const [isTrimming, setIsTrimming] = useState(false)
    const trimChangeTimeoutRef = useRef<NodeJS.Timer | null>(null)
    const isInitializedRef = useRef(false)

    // Handle duration updates
    useEffect(() => {
        if (duration > 0) {
            if (!isInitializedRef.current) {
                setTrimEnd(duration)
                setOriginalTrimEnd(duration)
                isInitializedRef.current = true
            }
        }
    }, [duration])

    const handleTrimChange = useCallback(
        (start: number, end: number) => {
            // Ensure values are within valid bounds
            const validStart = Math.max(0, Math.min(start, duration - 1))
            const validEnd = Math.min(duration, Math.max(end, validStart + 1))

            // Only update if values have actually changed
            if (validStart !== trimStart || validEnd !== trimEnd) {
                console.log('Trim values changed:', {
                    validStart,
                    validEnd,
                    originalStart: originalTrimStart,
                    originalEnd: originalTrimEnd,
                })

                setTrimStart(validStart)
                setTrimEnd(validEnd)

                // Clear any existing timeout
                if (trimChangeTimeoutRef.current) {
                    clearTimeout(trimChangeTimeoutRef.current)
                }

                // Immediately check if the values are different from original
                const isCloseToOriginal =
                    Math.abs(validStart - originalTrimStart) < 0.01 &&
                    Math.abs(validEnd - originalTrimEnd) < 0.01

                // Set hasChanges immediately if values are significantly different
                if (!isCloseToOriginal) {
                    setHasChanges(true)
                } else {
                    // Only set to false after a delay to avoid flickering
                    trimChangeTimeoutRef.current = setTimeout(() => {
                        setHasChanges(false)
                    }, 100)
                }
            }
        },
        [duration, trimStart, trimEnd, originalTrimStart, originalTrimEnd],
    )

    const handleTrimDragStart = useCallback(() => {
        setIsTrimming(true)
    }, [])

    const handleTrimDragEnd = useCallback(() => {
        setIsTrimming(false)

        // Check for changes on drag end
        const isCloseToOriginal =
            Math.abs(trimStart - originalTrimStart) < 0.01 &&
            Math.abs(trimEnd - originalTrimEnd) < 0.01
        setHasChanges(!isCloseToOriginal)
    }, [trimStart, trimEnd, originalTrimStart, originalTrimEnd])

    return {
        trimStart,
        trimEnd,
        originalTrimStart,
        originalTrimEnd,
        hasChanges,
        isTrimming,
        handleTrimChange,
        handleTrimDragStart,
        handleTrimDragEnd,
        setOriginalTrimStart,
        setOriginalTrimEnd,
    }
}
