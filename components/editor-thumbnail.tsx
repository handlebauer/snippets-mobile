import React from 'react'
import { StyleSheet, View } from 'react-native'
import CodeHighlighter from 'react-native-code-highlighter'
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { MaterialCommunityIcons } from '@expo/vector-icons'

interface EditorThumbnailProps {
    thumbnailCode?: string
    style?: any
}

export function EditorThumbnail({
    thumbnailCode,
    style,
}: EditorThumbnailProps) {
    if (!thumbnailCode) {
        return (
            <View style={[styles.container, style]}>
                <MaterialCommunityIcons
                    name="code-braces"
                    size={32}
                    color="#666666"
                />
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
                        fontSize: 10,
                        lineHeight: 14,
                        padding: 8,
                    }}
                    textStyle={{
                        fontFamily: 'FiraCode',
                        fontSize: 10,
                        lineHeight: 14,
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
                <MaterialCommunityIcons
                    name="code-braces"
                    size={24}
                    color="#FFFFFF"
                    style={styles.icon}
                />
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
    codeContainer: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.6,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
})
