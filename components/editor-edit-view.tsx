import React from 'react'
import {
    ActivityIndicator,
    Platform,
    Pressable,
    Share,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native'
import CodeHighlighter from 'react-native-code-highlighter'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { InsightsModal } from '@/components/insights-modal'
import { useChannel } from '@/contexts/channel.context'
import { useSupabase } from '@/contexts/supabase.context'

import { generateInsights } from '@/lib/api'
import { useScreenOrientation } from '@/hooks/use-screen-orientation'

import { CodeMetadataModal } from './code-metadata-modal'
import { CodeScrubber } from './code-scrubber'
import { FloatingMenu } from './floating-menu'
import { VideoBookmarksModal } from './video-bookmarks-modal'

import type { CodeInsights } from '@/lib/api'

interface EditorEvent {
    type: 'insert' | 'delete' | 'replace'
    timestamp: number
    from: number
    to: number
    text: string
    removed?: string
}

interface Bookmark {
    id: string
    timestamp: number
    label?: string
    createdAt: string
}

interface EditorEditViewProps {
    events: EditorEvent[]
    finalContent: string
    initialState: string
    onClose: () => void
    isFromRecordingSession?: boolean
    code: string
}

export function EditorEditView({
    events: initialEvents,
    finalContent,
    initialState,
    onClose,
    isFromRecordingSession = false,
    code,
}: EditorEditViewProps) {
    console.log('📝 EditorEditView mounted with props:', {
        hasEvents: Array.isArray(initialEvents) && initialEvents.length > 0,
        eventCount: initialEvents?.length,
        hasFinalContent: !!finalContent,
        hasInitialState: !!initialState,
        code,
    })

    const router = useRouter()
    const { isLandscape } = useScreenOrientation()
    const { setIsStreaming, setIsEditing } = useChannel()
    const { supabase } = useSupabase()
    const [events, setEvents] = React.useState<EditorEvent[]>(
        initialEvents || [],
    )
    const [content, setContent] = React.useState('')
    const [currentTime, setCurrentTime] = React.useState(0)
    const [isPlaying, setIsPlaying] = React.useState(false)
    const [duration, setDuration] = React.useState(0)
    const [durationMs, setDurationMs] = React.useState(0)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const playbackRef = React.useRef<NodeJS.Timer | null>(null)
    const [activeTab, setActiveTab] = React.useState<'code' | 'adjust'>('code')
    const [showMenu, setShowMenu] = React.useState(false)
    const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 })
    const [showMetadataModal, setShowMetadataModal] = React.useState(false)
    const moreButtonRef = React.useRef<View>(null)
    const mainContainerRef = React.useRef<View>(null)
    const [bookmarks, setBookmarks] = React.useState<Bookmark[]>([])
    const [showBookmarksModal, setShowBookmarksModal] = React.useState(false)
    const [trimStart, setTrimStart] = React.useState(0)
    const [trimEnd, setTrimEnd] = React.useState(0)
    const [originalTrimStart, setOriginalTrimStart] = React.useState(0)
    const [originalTrimEnd, setOriginalTrimEnd] = React.useState(0)
    const [hasChanges, setHasChanges] = React.useState(false)
    const [isTrimming, setIsTrimming] = React.useState(false)
    const trimChangeTimeoutRef = React.useRef<NodeJS.Timer | null>(null)
    const [showInsightsModal, setShowInsightsModal] = React.useState(false)
    const [insightsLoading, setInsightsLoading] = React.useState(false)
    const [insights, setInsights] = React.useState<CodeInsights | undefined>(
        undefined,
    )

    // Fetch events when component mounts
    React.useEffect(() => {
        async function fetchEvents() {
            if (!code) return

            try {
                console.log('🔄 Fetching events for session:', { code })
                setLoading(true)

                // First get the session ID
                const { data: sessionData, error: sessionError } =
                    await supabase
                        .from('recording_sessions')
                        .select('id')
                        .eq('code', code)
                        .single()

                if (sessionError) throw sessionError
                if (!sessionData) throw new Error('Session not found')

                // Then fetch events using session ID
                const { data, error } = await supabase
                    .from('editor_event_batches')
                    .select('events')
                    .eq('session_id', sessionData.id)
                    .order('created_at', { ascending: true })

                if (error) throw error

                if (data && data.length > 0) {
                    // Combine all event batches into a single array
                    const allEvents = data.flatMap(batch => batch.events)
                    console.log('✅ Fetched events:', {
                        batchCount: data.length,
                        totalEvents: allEvents.length,
                    })
                    setEvents(allEvents)
                }
            } catch (err) {
                console.error('❌ Failed to fetch events:', err)
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Failed to fetch events',
                )
            } finally {
                setLoading(false)
            }
        }

        // Only fetch if we don't have events already
        if (events.length === 0) {
            fetchEvents()
        }
    }, [code, supabase, events.length])

    // Initialize with initial state on mount
    React.useEffect(() => {
        console.log('🎬 Setting initial content:', {
            initialState: initialState.slice(0, 100) + '...',
            currentContent: content.slice(0, 100) + '...',
        })
        setContent(initialState)
    }, [initialState])

    // Log initial events and timing
    React.useEffect(() => {
        console.log('📝 EditorEditView initialized:', {
            eventCount: events.length,
            events: events,
            finalContent: finalContent.slice(0, 100) + '...', // First 100 chars
            initialState: initialState.slice(0, 100) + '...', // First 100 chars
            currentContent: content.slice(0, 100) + '...',
        })
    }, [events, finalContent, initialState, content])

    // Calculate total duration from events
    React.useEffect(() => {
        if (events.length > 0) {
            const firstEvent = events[0]
            const lastEvent = events[events.length - 1]
            const rawDurationMs = lastEvent.timestamp - firstEvent.timestamp
            const calculatedDuration = rawDurationMs / 1000 // Convert to seconds for UI
            console.log('⏱️ Calculating duration:', {
                firstEventTime: firstEvent.timestamp,
                lastEventTime: lastEvent.timestamp,
                rawDurationMs,
                calculatedDuration,
                eventCount: events.length,
            })
            setDurationMs(rawDurationMs)
            setDuration(calculatedDuration)
            setTrimEnd(calculatedDuration)
            setOriginalTrimStart(0)
            setOriginalTrimEnd(calculatedDuration)
        } else {
            console.log('⚠️ No events to calculate duration')
        }
    }, [events])

    // Handle playback
    const togglePlayback = () => {
        if (isPlaying) {
            if (playbackRef.current) {
                clearInterval(playbackRef.current)
                playbackRef.current = null
            }
            setIsPlaying(false)
        } else {
            // Start playback from current time
            const startTime = Date.now() - currentTime * 1000
            playbackRef.current = setInterval(() => {
                const newTime = (Date.now() - startTime) / 1000
                if (newTime >= trimEnd) {
                    if (playbackRef.current) {
                        clearInterval(playbackRef.current)
                        playbackRef.current = null
                    }
                    setIsPlaying(false)
                    return
                }
                setCurrentTime(newTime)
                applyEventsUpToTime(newTime)
            }, 16) // ~60fps
            setIsPlaying(true)
        }
    }

    // Apply events up to current time
    const applyEventsUpToTime = (time: number) => {
        // Start from initial state
        let newContent = initialState
        const startTime = events.length > 0 ? events[0].timestamp : 0

        // If we're at time 0, show initial state
        if (time <= 0) {
            setContent(initialState)
            return
        }

        for (const event of events) {
            // Skip events that happened before our first event's timestamp
            if (event.timestamp < startTime) continue
            // Break if we've reached events beyond our current time
            if ((event.timestamp - startTime) / 1000 > time) break
            // Skip events outside trim bounds
            const eventTime = (event.timestamp - startTime) / 1000
            if (eventTime < trimStart || eventTime > trimEnd) continue

            switch (event.type) {
                case 'insert':
                    newContent =
                        newContent.slice(0, event.from) +
                        event.text +
                        newContent.slice(event.from)
                    break
                case 'delete':
                    newContent =
                        newContent.slice(0, event.from) +
                        newContent.slice(event.to)
                    break
                case 'replace':
                    newContent =
                        newContent.slice(0, event.from) +
                        event.text +
                        newContent.slice(event.to)
                    break
            }
        }
        setContent(newContent)
    }

    // Handle seeking
    const handleSeek = (time: number) => {
        // Constrain seek position to trim boundaries
        const constrainedTime = Math.max(trimStart, Math.min(time, trimEnd))
        setCurrentTime(constrainedTime)
        applyEventsUpToTime(constrainedTime)
    }

    // Handle trim changes
    const handleTrimChange = (start: number, end: number) => {
        // Ensure values are within valid bounds
        const validStart = Math.max(0, Math.min(start, duration - 1))
        const validEnd = Math.min(duration, Math.max(end, validStart + 1))

        // Only update if values have actually changed
        if (validStart !== trimStart || validEnd !== trimEnd) {
            console.log('Updating trim points:', {
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
            if (currentTime < validStart) {
                // Update the playhead position to the new trim start
                setCurrentTime(validStart)
                applyEventsUpToTime(validStart)
            }
        }
    }

    // Handle trim drag state
    const handleTrimDragStart = () => {
        setIsTrimming(true)
    }

    const handleTrimDragEnd = () => {
        setIsTrimming(false)
    }

    // Cleanup
    React.useEffect(() => {
        return () => {
            if (playbackRef.current) {
                clearInterval(playbackRef.current)
            }
        }
    }, [])

    // Calculate interesting stats
    const stats = React.useMemo(() => {
        if (events.length === 0) return null

        const insertEvents = events.filter(e => e.type === 'insert')
        const deleteEvents = events.filter(e => e.type === 'delete')
        const replaceEvents = events.filter(e => e.type === 'replace')

        const totalCharsAdded = insertEvents.reduce(
            (sum, e) => sum + e.text.length,
            0,
        )
        const totalCharsDeleted = deleteEvents.reduce(
            (sum, e) => sum + (e.removed?.length || 0),
            0,
        )
        const totalEdits = events.length

        // Calculate typing speed (chars per minute)
        const timeSpan =
            (events[events.length - 1].timestamp - events[0].timestamp) /
            1000 /
            60 // minutes
        const typingSpeed = Math.round(totalCharsAdded / timeSpan)

        // Find longest pause between events
        let longestPause = 0
        for (let i = 1; i < events.length; i++) {
            const pause = (events[i].timestamp - events[i - 1].timestamp) / 1000
            longestPause = Math.max(longestPause, pause)
        }

        return {
            totalEdits,
            insertCount: insertEvents.length,
            deleteCount: deleteEvents.length,
            replaceCount: replaceEvents.length,
            charsAdded: totalCharsAdded,
            charsDeleted: totalCharsDeleted,
            typingSpeed,
            longestPause: Math.round(longestPause),
            duration: Math.round(duration),
        }
    }, [events, duration])

    // Add share handler
    const handleShare = React.useCallback(async () => {
        try {
            const result = await Share.share({
                title: 'Share Code Recording',
                message: 'Check out my code recording',
            })

            if (result.action === Share.sharedAction) {
                console.log('Shared successfully')
            }
        } catch (error) {
            console.error('Error sharing:', error)
        }
    }, [])

    // Add bookmark handlers
    const addBookmark = async () => {
        try {
            const timestamp = currentTime

            // Check if bookmark already exists at this timestamp (using smaller threshold)
            if (bookmarks.some(b => Math.abs(b.timestamp - timestamp) < 0.1)) {
                return // Prevent duplicates within 0.1s
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
        // Update current time and seek
        setCurrentTime(timestamp)
        applyEventsUpToTime(timestamp)
        setShowBookmarksModal(false) // Close modal after seeking
    }

    // Delete bookmark
    const deleteBookmark = (id: string) => {
        setBookmarks(prev => prev.filter(b => b.id !== id))
    }

    // Update bookmark label
    const handleUpdateBookmark = async (id: string, label: string) => {
        setBookmarks(prev =>
            prev.map(bookmark =>
                bookmark.id === id ? { ...bookmark, label } : bookmark,
            ),
        )
    }

    // Filter events based on trim bounds
    const getTrimmedEvents = React.useCallback(() => {
        if (events.length === 0) return []

        const startTime = events[0].timestamp
        const trimmedEvents = events.filter(event => {
            const eventTime = (event.timestamp - startTime) / 1000
            return eventTime >= trimStart && eventTime <= trimEnd
        })

        // Adjust timestamps relative to new start time
        const firstEventTime = trimmedEvents[0]?.timestamp || 0
        return trimmedEvents.map(event => ({
            ...event,
            timestamp: event.timestamp - firstEventTime,
        }))
    }, [events, trimStart, trimEnd])

    // Add delete handler
    const handleDelete = React.useCallback(async () => {
        try {
            setLoading(true)

            // Update the session status to 'deleted'
            const { error } = await supabase.rpc('update_session_status', {
                pairing_code: code,
                new_status: 'deleted',
            })

            if (error) {
                throw error
            }

            if (isFromRecordingSession) {
                setIsStreaming(false) // Reset streaming state
                setIsEditing(false) // Reset editing state
                router.push('/(protected)/(tabs)')
            } else {
                onClose()
            }
        } catch (err) {
            console.error('Failed to delete session:', err)
            setError(
                err instanceof Error ? err.message : 'Failed to delete session',
            )
        } finally {
            setLoading(false)
        }
    }, [
        isFromRecordingSession,
        router,
        onClose,
        setIsStreaming,
        setIsEditing,
        code,
    ])

    // Update handleSave
    const handleSave = React.useCallback(async () => {
        try {
            setLoading(true)

            // Finalize the recording session with duration
            const { error: finalizeError } = await supabase.rpc(
                'finalize_recording_session',
                {
                    pairing_code: code,
                    duration_ms: durationMs,
                },
            )

            if (finalizeError) {
                throw finalizeError
            }

            // Only process event changes if there are actual changes
            if (hasChanges) {
                const trimmedEvents = getTrimmedEvents()
                console.log('Saving trimmed events:', {
                    originalCount: events.length,
                    trimmedCount: trimmedEvents.length,
                    trimStart,
                    trimEnd,
                })

                // TODO: Save trimmed events to backend
                // const { error: eventsError } = await supabase.rpc('store_editor_event_batch', {
                //     pairing_code: code,
                //     events: trimmedEvents,
                //     timestamp_start: trimStart,
                //     timestamp_end: trimEnd,
                //     event_count: trimmedEvents.length
                // })

                // if (eventsError) {
                //     throw eventsError
                // }
            }

            // Navigate regardless of changes
            if (isFromRecordingSession) {
                setIsStreaming(false) // Reset streaming state
                setIsEditing(false) // Reset editing state
                router.push('/(protected)/(tabs)/videos')
            } else {
                onClose()
            }
        } catch (err) {
            console.error('Failed to save session:', err)
            setError(
                err instanceof Error ? err.message : 'Failed to save changes',
            )
        } finally {
            setLoading(false)
        }
    }, [
        events,
        hasChanges,
        trimStart,
        trimEnd,
        onClose,
        isFromRecordingSession,
        router,
        setIsStreaming,
        setIsEditing,
        code,
        getTrimmedEvents,
        durationMs,
    ])

    // Add function to fetch insights
    const fetchInsights = React.useCallback(async () => {
        if (!code || !events.length) return

        try {
            setInsightsLoading(true)
            const generatedInsights = await generateInsights({
                pairingCode: code,
                data: {
                    events,
                    initialState,
                    finalContent,
                },
            })
            setInsights(generatedInsights)
        } catch (error) {
            console.error('Failed to fetch insights:', error)
            setError(
                error instanceof Error
                    ? error.message
                    : 'Failed to fetch insights',
            )
        } finally {
            setInsightsLoading(false)
        }
    }, [code, events, initialState, finalContent])

    // Handle insights button click
    const handleInsightsClick = React.useCallback(async () => {
        setShowInsightsModal(true)
        if (!insights) {
            await fetchInsights()
        }
    }, [insights, fetchInsights])

    if (error) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable onPress={onClose} style={styles.button}>
                        <Text style={styles.buttonText}>Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        )
    }

    // Render loading state with header
    if (loading || events.length === 0) {
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
                            <Text style={styles.navButton}>Close</Text>
                        </Pressable>
                        <View style={styles.titleContainer}>
                            <Text style={styles.navTitle}>Code</Text>
                        </View>
                        <View style={styles.placeholderButton} />
                    </View>

                    {/* Loading State */}
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                        <Text style={styles.loadingText}>
                            Loading recording...
                        </Text>
                    </View>
                </SafeAreaView>
            </View>
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
                    {isFromRecordingSession ? (
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
                                <Text style={styles.navTitle}>Code</Text>
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
                                onPress={handleSave}
                                disabled={
                                    isFromRecordingSession ? false : !hasChanges
                                }
                                style={({ pressed }) => [
                                    styles.editorSaveButton,
                                    !isFromRecordingSession &&
                                        !hasChanges &&
                                        styles.editorSaveButtonDisabled,
                                    pressed && styles.editorSaveButtonPressed,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.navButton,
                                        !isFromRecordingSession &&
                                            !hasChanges &&
                                            styles.navButtonDisabled,
                                    ]}
                                >
                                    Save
                                </Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <Pressable onPress={onClose}>
                                <Text style={styles.navButton}>Close</Text>
                            </Pressable>
                            <View style={styles.titleContainer}>
                                <Text style={styles.navTitle}>Code</Text>
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
                                onPress={handleSave}
                                disabled={
                                    isFromRecordingSession ? false : !hasChanges
                                }
                                style={({ pressed }) => [
                                    styles.editorSaveButton,
                                    !isFromRecordingSession &&
                                        !hasChanges &&
                                        styles.editorSaveButtonDisabled,
                                    pressed && styles.editorSaveButtonPressed,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.navButton,
                                        !isFromRecordingSession &&
                                            !hasChanges &&
                                            styles.navButtonDisabled,
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
                    {/* Main Container */}
                    <View
                        style={[
                            styles.mainContainer,
                            isLandscape && styles.mainContainerLandscape,
                        ]}
                        ref={mainContainerRef}
                    >
                        {/* Code Display */}
                        <View
                            style={[
                                styles.codeContainer,
                                isLandscape && styles.codeContainerLandscape,
                            ]}
                        >
                            <CodeHighlighter
                                language="typescript"
                                customStyle={{
                                    backgroundColor: 'transparent',
                                    fontFamily: 'FiraCode',
                                    fontSize: 14,
                                    lineHeight: 20,
                                }}
                                textStyle={{
                                    fontFamily: 'FiraCode',
                                    fontSize: 14,
                                    lineHeight: 20,
                                }}
                                hljsStyle={{
                                    ...atomOneDarkReasonable,
                                    hljs: {
                                        ...atomOneDarkReasonable.hljs,
                                        background: 'transparent',
                                    },
                                }}
                            >
                                {content}
                            </CodeHighlighter>
                        </View>

                        {/* Scrubber */}
                        {isLandscape ? (
                            <View style={styles.scrubberContainerLandscape}>
                                {activeTab === 'code' && (
                                    <CodeScrubber
                                        events={events}
                                        currentTime={currentTime}
                                        duration={duration}
                                        isPlaying={isPlaying}
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
                            activeTab === 'code' && (
                                <CodeScrubber
                                    events={events}
                                    currentTime={currentTime}
                                    duration={duration}
                                    isPlaying={isPlaying}
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

                    {/* Toolbar Container */}
                    <View style={styles.controlsContainer}>
                        <View style={styles.toolbarContainer}>
                            <Pressable
                                style={[
                                    styles.toolButton,
                                    activeTab === 'code' &&
                                        styles.toolButtonActive,
                                ]}
                                onPress={() => setActiveTab('code')}
                            >
                                <MaterialCommunityIcons
                                    name="code-braces"
                                    size={24}
                                    color={
                                        activeTab === 'code'
                                            ? '#0A84FF'
                                            : '#FFFFFF'
                                    }
                                />
                                <Text
                                    style={[
                                        styles.toolButtonText,
                                        activeTab === 'code' &&
                                            styles.toolButtonTextActive,
                                    ]}
                                >
                                    Code
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
                                style={[
                                    styles.toolButton,
                                    showInsightsModal &&
                                        styles.toolButtonActive,
                                ]}
                                onPress={handleInsightsClick}
                            >
                                <MaterialCommunityIcons
                                    name={
                                        showInsightsModal
                                            ? 'lightbulb'
                                            : 'lightbulb-outline'
                                    }
                                    size={24}
                                    color={
                                        showInsightsModal
                                            ? '#0A84FF'
                                            : '#FFFFFF'
                                    }
                                />
                                <Text
                                    style={[
                                        styles.toolButtonText,
                                        showInsightsModal &&
                                            styles.toolButtonTextActive,
                                    ]}
                                >
                                    Insights
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
                                <Text style={styles.toolButtonText}>Share</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            <FloatingMenu
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                anchorPosition={menuPosition}
                items={[
                    {
                        title: 'Code Details',
                        icon: 'information',
                        onPress: () => {
                            setShowMenu(false)
                            setShowMetadataModal(true)
                        },
                    },
                ]}
            />

            {/* Metadata Modal */}
            {stats && (
                <CodeMetadataModal
                    visible={showMetadataModal}
                    onClose={() => setShowMetadataModal(false)}
                    stats={stats}
                />
            )}

            {/* Add VideoBookmarksModal */}
            <VideoBookmarksModal
                visible={showBookmarksModal}
                onClose={() => setShowBookmarksModal(false)}
                bookmarks={bookmarks}
                onAddBookmark={addBookmark}
                onDeleteBookmark={deleteBookmark}
                onSeekToBookmark={seekToBookmark}
                onUpdateBookmark={handleUpdateBookmark}
            />

            {/* Add InsightsModal */}
            <InsightsModal
                visible={showInsightsModal}
                onClose={() => setShowInsightsModal(false)}
                isLoading={insightsLoading}
                insights={insights}
            />
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
        paddingHorizontal: Platform.OS === 'ios' ? 64 : 32,
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
    codeContainer: {
        flex: 1,
        padding: 16,
        backgroundColor: '#121212',
        marginBottom: 8,
    },
    codeContainerLandscape: {
        flex: 1,
        marginBottom: 16,
        width: '100%',
        maxHeight: '70%',
    },
    scrubberContainerLandscape: {
        flex: 0,
        minHeight: 100,
    },
    controlsContainer: {
        paddingBottom: 8,
        backgroundColor: '#121212',
        borderRadius: 8,
        marginHorizontal: 32,
    },
    toolbarContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingBottom: 16,
        backgroundColor: 'transparent',
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
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    moreButton: {
        padding: 4,
    },
    editorSaveButton: {
        opacity: 1,
        padding: 8,
        borderRadius: 8,
    },
    editorSaveButtonDisabled: {
        opacity: 0.5,
    },
    editorSaveButtonPressed: {
        opacity: 0.8,
    },
    navButtonDisabled: {
        color: '#999999',
    },
    deleteButton: {
        color: '#FF3B30',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
    placeholderButton: {
        width: 60, // Match the width of the Save button
    },
})
