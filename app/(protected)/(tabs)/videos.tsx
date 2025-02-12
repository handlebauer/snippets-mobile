import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

import { useRouter } from 'expo-router'

import { RecordingList } from '@/components/video-list'
import { isEditorRecording, isVideoRecording } from '@/types/recordings'

import { useVideos } from '@/hooks/use-videos'

import type { RecordingMetadata } from '@/types/recordings'

export default function VideosScreen() {
    const router = useRouter()
    const { videos: recordings, loading, error, refetch } = useVideos()

    // Add debug logging
    React.useEffect(() => {
        if (recordings.length > 0) {
            // console.log('🎥 All recordings:', recordings)

            // Log editor recordings specifically
            const editorRecordings = recordings.filter(isEditorRecording)
            const videoRecordings = recordings.filter(isVideoRecording)

            // console.log('📝 Editor recordings:', editorRecordings)
            console.log('🎥 Video recordings:', videoRecordings)

            if (editorRecordings.length > 0) {
                const firstEditor = editorRecordings[0]
                console.log('First editor recording details:', {
                    thumbnail_code: firstEditor.thumbnail_code,
                    initial_content: firstEditor.initial_content,
                    type: firstEditor.type,
                })
            }
        }
    }, [recordings])

    const handleEditRecording = (recording: RecordingMetadata) => {
        if (isVideoRecording(recording)) {
            router.push(`/video-editor/${recording.id}`)
        } else {
            // Navigate to editor view with necessary params
            router.push({
                pathname: '/editor-edit',
                params: {
                    code: recording.session_code,
                    initialState: recording.initial_content,
                    finalContent: recording.final_content,
                    isFromRecordingSession: 'false',
                },
            })
        }
    }

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading recordings...</Text>
            </View>
        )
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text>Error loading recordings: {error.toString()}</Text>
            </View>
        )
    }

    // Show only saved recordings
    const filteredRecordings = recordings.filter(r => r.status === 'saved')

    return (
        <View style={styles.container}>
            <RecordingList
                recordings={filteredRecordings}
                onRefresh={refetch}
                onEditRecording={handleEditRecording}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
})
