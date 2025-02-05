import { useCallback, useEffect, useState } from 'react'

import * as ScreenOrientation from 'expo-screen-orientation'

export function useScreenOrientation() {
    const [isLandscape, setIsLandscape] = useState(false)
    const [orientation, setOrientation] =
        useState<ScreenOrientation.Orientation>(
            ScreenOrientation.Orientation.UNKNOWN,
        )

    const updateOrientation = useCallback(async () => {
        try {
            const currentOrientation =
                await ScreenOrientation.getOrientationAsync()
            setOrientation(currentOrientation)
            setIsLandscape(
                currentOrientation ===
                    ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                    currentOrientation ===
                        ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
            )
        } catch (error) {
            console.error('Failed to get orientation:', error)
        }
    }, [])

    const lockToPortrait = useCallback(async () => {
        try {
            await ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.PORTRAIT_UP,
            )
            await updateOrientation()
        } catch (error) {
            console.error('Failed to lock to portrait:', error)
        }
    }, [updateOrientation])

    const lockToLandscape = useCallback(async () => {
        try {
            await ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.LANDSCAPE,
            )
            await updateOrientation()
        } catch (error) {
            console.error('Failed to lock to landscape:', error)
        }
    }, [updateOrientation])

    const unlockOrientation = useCallback(async () => {
        try {
            await ScreenOrientation.unlockAsync()
            await updateOrientation()
        } catch (error) {
            console.error('Failed to unlock orientation:', error)
        }
    }, [updateOrientation])

    useEffect(() => {
        let isMounted = true
        let subscription: ScreenOrientation.Subscription | null = null

        const setupOrientation = async () => {
            try {
                // Get initial orientation
                await updateOrientation()

                // Subscribe to orientation changes
                subscription = ScreenOrientation.addOrientationChangeListener(
                    event => {
                        if (isMounted) {
                            const newOrientation =
                                event.orientationInfo.orientation
                            setOrientation(newOrientation)
                            setIsLandscape(
                                newOrientation ===
                                    ScreenOrientation.Orientation
                                        .LANDSCAPE_LEFT ||
                                    newOrientation ===
                                        ScreenOrientation.Orientation
                                            .LANDSCAPE_RIGHT,
                            )
                        }
                    },
                )
            } catch (error) {
                console.error('Failed to setup orientation:', error)
            }
        }

        setupOrientation()

        return () => {
            isMounted = false
            if (subscription) {
                ScreenOrientation.removeOrientationChangeListener(subscription)
            }
        }
    }, [updateOrientation])

    return {
        isLandscape,
        orientation,
        lockToPortrait,
        lockToLandscape,
        unlockOrientation,
        updateOrientation,
    }
}
