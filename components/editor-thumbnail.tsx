import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import CodeHighlighter from 'react-native-code-highlighter'
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs'

interface EditorThumbnailProps {
    thumbnailCode?: string
    style?: any
    duration_ms?: number | null
}

// Helper function to format duration
const formatDuration = (ms: number) => {
    const totalSeconds = Math.round(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function EditorThumbnail({
    thumbnailCode,
    style,
    duration_ms,
}: EditorThumbnailProps) {
    if (!thumbnailCode) {
        return (
            <View style={[styles.container, style]}>
                <View style={styles.emptyContainer} />
            </View>
        )
    }

    return (
        <View style={[styles.container, style]}>
            <View style={styles.codeContainer}>
                <CodeHighlighter
                    language="typescript"
                    customStyle={{
                        backgroundColor: 'transparent',
                        fontFamily: 'FiraCode',
                        fontSize: 11,
                        lineHeight: 16,
                        padding: 12,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}
                    textStyle={{
                        fontFamily: 'FiraCode',
                        fontSize: 11,
                        lineHeight: 16,
                    }}
                    hljsStyle={{
                        ...atomOneDarkReasonable,
                        hljs: {
                            ...atomOneDarkReasonable.hljs,
                            background: 'transparent',
                        },
                    }}
                >
                    {thumbnailCode}
                </CodeHighlighter>
            </View>
            <View style={styles.overlay}>
                {duration_ms && (
                    <Text style={styles.durationText}>
                        {formatDuration(duration_ms)}
                    </Text>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    emptyContainer: {
        flex: 1,
        backgroundColor: '#1C1C1E',
    },
    codeContainer: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.85,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    durationText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
})
