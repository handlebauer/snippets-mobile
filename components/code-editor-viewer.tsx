import React from 'react'
import {
    Animated,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native'
import CodeHighlighter from 'react-native-code-highlighter'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { RecordingTimer } from '@/components/recording-timer'
import { useChannel } from '@/contexts/channel.context'

import { PairingView } from '@/components/session/pairing-view'
import { useRecordButton } from '@/hooks/use-record-button'
import { useScreenOrientation } from '@/hooks/use-screen-orientation'

import type { RealtimeChannel } from '@supabase/supabase-js'

type ChangeType = 'insert' | 'delete' | 'replace'

interface EditorEvent {
    type: ChangeType
    timestamp: number
    from: number
    to: number
    text: string
    removed?: string
    metadata?: {
        isSignificant?: boolean
        changeSize?: number
        description?: string
    }
}

interface EditorBatch {
    timestamp_start: number
    timestamp_end: number
    events: EditorEvent[]
}

interface RecordingState {
    isRecording: boolean
    isNarrating: boolean
    recordingStartTime: number | null
    initialContent: string | null
}

interface CodeEditorViewerProps {
    sessionCode: string | null
    statusMessage: string | null
    onReset: () => void
    channel: RealtimeChannel | null
    lastEventTime?: number
    eventCount?: number
    isEditorInitialized?: boolean
}

interface CodePreviewProps {
    content: string
    channel: RealtimeChannel | null
    sessionCode: string | null
}

interface EditorRecordingStartedPayload {
    timestamp: number
    content: string
    initialContent: string
}

interface EditorRecordingFinishedPayload {
    timestamp: number
    content: string
    initialContent: string
    events: EditorEvent[]
}

interface EditorBatchPayload {
    events: EditorEvent[]
}

// Constants
const INITIAL_RECORDING_STATE: RecordingState = {
    isRecording: false,
    isNarrating: false,
    recordingStartTime: null,
    initialContent: null,
}

function CodePreview({ content, channel, sessionCode }: CodePreviewProps) {
    const {
        setIsEditing,
        setRecordingStartTime,
        state: { isRecording, recordingStartTime, isNarrating },
        setIsRecording,
        setIsNarrating,
    } = useChannel()
    const { isLandscape } = useScreenOrientation()
    const [recordedEvents, setRecordedEvents] = React.useState<EditorEvent[]>(
        [],
    )
    const router = useRouter()

    // Keep recording state in a ref to avoid effect recreation
    const recordingStateRef = React.useRef<RecordingState>(
        INITIAL_RECORDING_STATE,
    )

    // Update ref when recording state changes
    React.useEffect(() => {
        recordingStateRef.current = {
            isRecording,
            recordingStartTime,
            initialContent: recordingStateRef.current.initialContent,
            isNarrating: recordingStateRef.current.isNarrating,
        }
    }, [isRecording, recordingStartTime])

    // Debug all channel messages
    React.useEffect(() => {
        if (!channel) return

        console.log('🎥 Setting up channel debug logging')
        const debugSubscription = channel.on(
            'broadcast',
            { event: '*' },
            payload => {
                console.log('📡 Channel message:', {
                    event: payload.event,
                    type: payload.type,
                    payload: payload.payload,
                })
            },
        )

        return () => {
            console.log('🎬 Cleaning up debug subscription')
            debugSubscription.unsubscribe()
        }
    }, [channel])

    // Channel event handlers
    const handleRecordingStarted = React.useCallback(
        ({ payload }: { payload: EditorRecordingStartedPayload }) => {
            console.log('📱 [CodePreview] Recording started from web app')
            setIsRecording(true)
            setRecordingStartTime(payload.timestamp)
            recordingStateRef.current.initialContent = payload.initialContent
        },
        [setIsRecording, setRecordingStartTime],
    )

    const handleRecordingFinished = React.useCallback(
        ({ payload }: { payload: EditorRecordingFinishedPayload }) => {
            console.log('📱 [CodePreview] Recording finished from web app')
            setIsRecording(false)
            setRecordingStartTime(null)
            // Process recorded events
            if (payload.events) {
                const relativeEvents = payload.events.map(event => ({
                    ...event,
                    timestamp:
                        event.timestamp -
                        (recordingStateRef.current.recordingStartTime || 0),
                }))
                setRecordedEvents(prev => [...prev, ...relativeEvents])
            }
        },
        [setIsRecording, setRecordingStartTime],
    )

    const handleNarrationStarted = React.useCallback(() => {
        console.log('🎙️ [CodePreview] Narration started from web app')
        setIsNarrating(true)
        // TODO: Start the narration service here
    }, [setIsNarrating])

    const handleNarrationStopped = React.useCallback(() => {
        console.log('🎙️ [CodePreview] Narration stopped from web app')
        setIsNarrating(false)
        // TODO: Stop the narration service here
    }, [setIsNarrating])

    const handleEditorBatch = React.useCallback(
        ({ payload }: { payload: EditorBatchPayload }) => {
            if (payload.events) {
                const relativeEvents = payload.events.map(event => ({
                    ...event,
                    timestamp:
                        event.timestamp -
                        (recordingStateRef.current.recordingStartTime || 0),
                }))
                setRecordedEvents(prev => [...prev, ...relativeEvents])
            }
        },
        [],
    )

    // Set up channel subscriptions
    React.useEffect(() => {
        if (!channel) {
            console.log('⚠️ [CodePreview] No channel available')
            return
        }

        console.log('🔄 [CodePreview] Setting up channel event handlers')

        // Subscribe to events
        const recordingStartSubscription = channel.on(
            'broadcast',
            { event: 'editor_recording_started' },
            handleRecordingStarted,
        )

        const recordingFinishSubscription = channel.on(
            'broadcast',
            { event: 'editor_recording_finished' },
            handleRecordingFinished,
        )

        const batchSubscription = channel.on(
            'broadcast',
            { event: 'editor_batch' },
            handleEditorBatch,
        )

        const narrationStartSubscription = channel.on(
            'broadcast',
            { event: 'narration_started' },
            handleNarrationStarted,
        )

        const narrationStopSubscription = channel.on(
            'broadcast',
            { event: 'narration_stopped' },
            handleNarrationStopped,
        )

        // Cleanup function
        return () => {
            console.log(
                '🎬 Cleaning up event recording subscription (channel changed)',
            )
            recordingStartSubscription.unsubscribe()
            recordingFinishSubscription.unsubscribe()
            batchSubscription.unsubscribe()
            narrationStartSubscription.unsubscribe()
            narrationStopSubscription.unsubscribe()
        }
    }, [
        channel,
        handleRecordingStarted,
        handleRecordingFinished,
        handleEditorBatch,
        handleNarrationStarted,
        handleNarrationStopped,
    ])

    const { innerStyle, handleRecordPress: onRecordButtonPress } =
        useRecordButton({
            isRecording,
            onRecordPress: (_recording: boolean) => {
                if (!channel) {
                    console.error('Cannot record: no active channel')
                    return
                }

                // Toggle recording state
                const newIsRecording = !isRecording
                setIsRecording(newIsRecording)

                if (newIsRecording) {
                    // Start recording
                    const startTime = Date.now()
                    console.log('🎬 Starting recording at:', startTime)
                    setRecordingStartTime(startTime)
                    setRecordedEvents([]) // Clear previous events
                    // Don't update initialContent here - we already have it from initialization
                } else {
                    // Stop recording and transition to edit view
                    setRecordingStartTime(null)
                    console.log('📼 Recorded events:', {
                        count: recordedEvents.length,
                        events: recordedEvents,
                        firstEvent: recordedEvents[0],
                        lastEvent: recordedEvents[recordedEvents.length - 1],
                        initialContent:
                            recordingStateRef.current.initialContent,
                    })

                    // Only navigate if we have events
                    if (recordedEvents.length > 0) {
                        console.log('🎬 Navigating to edit view with:', {
                            eventCount: recordedEvents.length,
                            finalContent: content.slice(0, 100) + '...',
                            initialState:
                                (
                                    recordingStateRef.current.initialContent ||
                                    ''
                                ).slice(0, 100) + '...',
                            recordingState: recordingStateRef.current,
                        })
                        router.push({
                            pathname: '/(protected)/editor-edit',
                            params: {
                                events: JSON.stringify(recordedEvents),
                                finalContent: content,
                                initialState:
                                    recordingStateRef.current.initialContent ||
                                    '',
                                isFromRecordingSession: 'true',
                                code: sessionCode || '',
                            },
                        })
                    } else {
                        console.warn(
                            '⚠️ No events recorded, skipping navigation',
                        )
                    }
                }

                // Send recording control signal through the channel
                console.log('📤 Sending recording control signal:', {
                    action: newIsRecording ? 'start' : 'stop',
                    sessionCode,
                })

                channel
                    .send({
                        type: 'broadcast',
                        event: newIsRecording
                            ? 'editor_recording_started'
                            : 'editor_recording_finished',
                        payload: {
                            timestamp: Date.now(),
                            content: content,
                            sessionCode: sessionCode,
                        },
                    })
                    .then(() =>
                        console.log(
                            '✅ Recording control signal sent successfully',
                        ),
                    )
                    .catch(error =>
                        console.error(
                            '❌ Failed to send recording control signal:',
                            error,
                        ),
                    )
            },
        })

    // Set isEditing to true when component mounts, false when unmounts
    React.useEffect(() => {
        setIsEditing(true)
        return () => setIsEditing(false)
    }, [setIsEditing])

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <View style={styles.timerContainer}>
                    <View style={styles.placeholder} />
                    <RecordingTimer />
                    <View style={styles.placeholder}>
                        {isNarrating && (
                            <MaterialCommunityIcons
                                name="microphone"
                                size={20}
                                color="#A855F7"
                            />
                        )}
                    </View>
                </View>
            </View>
            <ScrollView
                style={styles.codeContainer}
                contentContainerStyle={styles.codeContent}
            >
                {content ? (
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
                ) : (
                    <Text style={[styles.codeText, { fontFamily: 'FiraCode' }]}>
                        {''}
                    </Text>
                )}
            </ScrollView>
            <View
                style={[
                    styles.recordButtonContainer,
                    isLandscape && styles.recordButtonContainerLandscape,
                ]}
            >
                <View style={styles.recordButton}>
                    <Animated.View style={innerStyle}>
                        <Pressable
                            onPress={onRecordButtonPress}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                </View>
            </View>
        </SafeAreaView>
    )
}

export function CodeEditorViewer({
    sessionCode,
    statusMessage,
    onReset,
    channel,
    lastEventTime,
    eventCount,
    isEditorInitialized,
}: CodeEditorViewerProps) {
    const [content, setContent] = React.useState('')

    // Handle incoming editor events
    React.useEffect(() => {
        if (!channel) return

        const handleEditorBatch = (payload: { payload: EditorBatch }) => {
            const batch = payload.payload

            // Apply each event in the batch to our content
            batch.events.forEach(event => {
                setContent(prevContent => {
                    switch (event.type) {
                        case 'insert':
                            return (
                                prevContent.slice(0, event.from) +
                                event.text +
                                prevContent.slice(event.from)
                            )
                        case 'delete':
                            return (
                                prevContent.slice(0, event.from) +
                                prevContent.slice(event.to)
                            )
                        case 'replace':
                            return (
                                prevContent.slice(0, event.from) +
                                event.text +
                                prevContent.slice(event.to)
                            )
                        default:
                            return prevContent
                    }
                })
            })
        }

        const handleEditorInitialized = (payload: {
            payload: { content: string; timestamp: number }
        }) => {
            // Just set the current content, don't capture as initial
            setContent(payload.payload.content)
        }

        // Listen for editor events and initialization
        const eventSubscription = channel.on(
            'broadcast',
            { event: 'editor_batch' },
            handleEditorBatch,
        )

        const initSubscription = channel.on(
            'broadcast',
            { event: 'editor_initialized' },
            handleEditorInitialized,
        )

        return () => {
            eventSubscription.unsubscribe()
            initSubscription.unsubscribe()
        }
    }, [channel])

    // Show code preview if editor is initialized or we've received events
    if (isEditorInitialized || lastEventTime) {
        return (
            <CodePreview
                content={content}
                channel={channel}
                sessionCode={sessionCode}
            />
        )
    }

    // Otherwise show the pairing view
    const description = lastEventTime
        ? `Last event: ${new Date(lastEventTime).toLocaleTimeString()}\nTotal events: ${eventCount}`
        : undefined

    return (
        <PairingView
            sessionCode={sessionCode}
            statusMessage={statusMessage}
            onReset={onReset}
            icon="code-tags"
            title="Connect to Editor"
            description={description}
        />
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#1A1A1A',
    },
    header: {
        backgroundColor: '#1A1A1A',
        height: Platform.OS === 'ios' ? 40 : 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: 120,
    },
    placeholder: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    codeContainer: {
        flex: 1,
        backgroundColor: '#1A1A1A',
    },
    codeContent: {
        paddingHorizontal: 16,
        paddingTop: 6,
    },
    codeText: {
        color: '#CCCCCC',
    },
    recordButtonContainer: {
        position: 'absolute',
        bottom: 24,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordButtonContainerLandscape: {
        bottom: 'auto',
        left: 24,
        width: 'auto',
        height: '100%',
        justifyContent: 'center',
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
})
