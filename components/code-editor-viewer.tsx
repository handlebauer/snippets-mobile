import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import CodeHighlighter from 'react-native-code-highlighter'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { useStream } from '@/contexts/recording.context'

import { PairingView } from '@/components/session/pairing-view'

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
}

interface CodePreviewProps {
    content: string
}

function CodePreview({ content }: CodePreviewProps) {
    const { setIsEditing } = useStream()

    // Set isEditing to true when component mounts, false when unmounts
    React.useEffect(() => {
        setIsEditing(true)
        return () => setIsEditing(false)
    }, [setIsEditing])

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <MaterialCommunityIcons
                    name="code-braces"
                    size={24}
                    color="#FFFFFF"
                />
                <Text variant="titleMedium" style={styles.headerText}>
                    Code Preview
                </Text>
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
                        // Waiting for code changes...
                    </Text>
                )}
            </ScrollView>
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

        // Listen for editor events but don't subscribe
        const subscription = channel.on(
            'broadcast',
            { event: 'editor_batch' },
            handleEditorBatch,
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [channel])

    // If we've received events, show the code preview
    if (lastEventTime) {
        return <CodePreview content={content} />
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
            title="Connect to Code Editor"
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
})
