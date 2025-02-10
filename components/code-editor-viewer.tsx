import React from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import CodeHighlighter from 'react-native-code-highlighter'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { RecordingTimer } from '@/components/recording-timer'
import { useStream } from '@/contexts/recording.context'

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
    metadabta?: {
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
}

function CodePreview({ content, channel }: CodePreviewProps) {
    const { setIsEditing, setRecordingStartTime, isRecording, setIsRecording } =
        useStream()
    const { isLandscape } = useScreenOrientation()
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

                // Update recording start time
                setRecordingStartTime(newIsRecording ? Date.now() : null)

                // Send recording control signal through the channel
                console.log('📤 Sending recording control signal:', {
                    action: newIsRecording ? 'start' : 'stop',
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
                        },
                    })
                    .then(() => {
                        console.log(
                            '✅ Recording control signal sent successfully',
                        )
                    })
                    .catch(error => {
                        console.error(
                            '❌ Failed to send recording control signal:',
                            error,
                        )
                    })
            },
        })

    // Listen for recording events from the web app
    React.useEffect(() => {
        if (!channel) return

        const handleRecordingStarted = (payload: {
            payload: { timestamp: number; content: string }
        }) => {
            console.log('📥 Received recording started signal')
            setIsRecording(true)
            setRecordingStartTime(payload.payload.timestamp)
        }

        const handleRecordingFinished = (_payload: {
            payload: { timestamp: number; content: string }
        }) => {
            console.log('📥 Received recording finished signal')
            setIsRecording(false)
            setRecordingStartTime(null)
        }

        // Subscribe to both start and finish events
        const startSubscription = channel.on(
            'broadcast',
            { event: 'editor_recording_started' },
            handleRecordingStarted,
        )

        const finishSubscription = channel.on(
            'broadcast',
            { event: 'editor_recording_finished' },
            handleRecordingFinished,
        )

        return () => {
            startSubscription.unsubscribe()
            finishSubscription.unsubscribe()
        }
    }, [channel, setRecordingStartTime, setIsRecording])

    // Set isEditing to true when component mounts, false when unmounts
    React.useEffect(() => {
        setIsEditing(true)
        return () => setIsEditing(false)
    }, [setIsEditing])

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <RecordingTimer />
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
                        // Waiting for code changes...
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
        return <CodePreview content={content} channel={channel} />
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
            icon="code-braces"
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
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#1A1A1A',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        gap: 12,
    },
    headerText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    codeContainer: {
        flex: 1,
        backgroundColor: '#1A1A1A',
    },
    codeContent: {
        padding: 16,
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
