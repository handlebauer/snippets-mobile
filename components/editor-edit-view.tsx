import React from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import CodeHighlighter from 'react-native-code-highlighter'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { useScreenOrientation } from '@/hooks/use-screen-orientation'

import { CodeScrubber } from './code-scrubber'

interface EditorEvent {
    type: 'insert' | 'delete' | 'replace'
    timestamp: number
    from: number
    to: number
    text: string
    removed?: string
}

interface EditorEditViewProps {
    events: EditorEvent[]
    initialContent: string
    onClose: () => void
}

export function EditorEditView({
    events,
    initialContent,
    onClose,
}: EditorEditViewProps) {
    const { isLandscape } = useScreenOrientation()
    const [content, setContent] = React.useState(initialContent)
    const [currentTime, setCurrentTime] = React.useState(0)
    const [isPlaying, setIsPlaying] = React.useState(false)
    const [duration, setDuration] = React.useState(0)
    const playbackRef = React.useRef<NodeJS.Timeout | null>(null)

    // Log initial events and timing
    React.useEffect(() => {
        console.log('📝 EditorEditView initialized:', {
            eventCount: events.length,
            events: events,
            initialContent: initialContent.slice(0, 100) + '...', // First 100 chars
        })
    }, [events, initialContent])

    // Calculate total duration from events
    React.useEffect(() => {
        if (events.length > 0) {
            const firstEvent = events[0]
            const lastEvent = events[events.length - 1]
            const calculatedDuration =
                (lastEvent.timestamp - firstEvent.timestamp) / 1000 // Convert to seconds
            console.log('⏱️ Calculating duration:', {
                firstEventTime: firstEvent.timestamp,
                lastEventTime: lastEvent.timestamp,
                calculatedDuration,
                eventCount: events.length,
            })
            setDuration(calculatedDuration)
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
                if (newTime >= duration) {
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
        let newContent = initialContent
        for (const event of events) {
            if (event.timestamp / 1000 > time) break

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
        setCurrentTime(time)
        applyEventsUpToTime(time)
    }

    // Cleanup
    React.useEffect(() => {
        return () => {
            if (playbackRef.current) {
                clearInterval(playbackRef.current)
            }
        }
    }, [])

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
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
                    <Text style={styles.navTitle}>Edit Recording</Text>
                    <Pressable onPress={onClose}>
                        <Text style={styles.navButton}>Save</Text>
                    </Pressable>
                </View>

                {/* Main Content */}
                <View
                    style={[
                        styles.content,
                        isLandscape && styles.contentLandscape,
                    ]}
                >
                    {/* Code Display */}
                    <View style={styles.codeContainer}>
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

                    {/* Playback Controls */}
                    <View style={styles.controlsContainer}>
                        <CodeScrubber
                            events={events}
                            currentTime={currentTime}
                            duration={duration}
                            isPlaying={isPlaying}
                            onSeek={handleSeek}
                            onPlayPause={togglePlayback}
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#121212',
    },
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    navBar: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginTop: Platform.OS === 'ios' ? 0 : 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
    },
    navBarLandscape: {
        marginTop: 0,
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
        backgroundColor: '#121212',
    },
    contentLandscape: {
        flexDirection: 'row',
    },
    codeContainer: {
        flex: 1,
        padding: 16,
        backgroundColor: '#1A1A1A',
    },
    controlsContainer: {
        padding: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#333333',
    },
})
