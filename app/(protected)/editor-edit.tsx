import React from 'react'

import { useLocalSearchParams, useRouter } from 'expo-router'

import { EditorEditView } from '@/components/editor-edit-view'

export default function EditorEditScreen() {
    const router = useRouter()
    const {
        events: eventsJson,
        finalContent,
        initialState,
        isFromRecordingSession,
        code,
    } = useLocalSearchParams<{
        events: string
        finalContent: string
        initialState: string
        isFromRecordingSession?: string
        code: string
    }>()

    // Parse events from JSON
    const events = React.useMemo(() => {
        try {
            return JSON.parse(eventsJson || '[]')
        } catch (err) {
            console.error('Failed to parse events:', err)
            return []
        }
    }, [eventsJson])

    console.log('📝 Editor Edit Screen received:', {
        eventCount: events.length,
        finalContent: finalContent?.slice(0, 100) + '...',
        initialState: initialState?.slice(0, 100) + '...',
        isFromRecordingSession,
        code,
    })

    return (
        <EditorEditView
            events={events}
            finalContent={finalContent || ''}
            initialState={initialState || ''}
            onClose={() => router.back()}
            isFromRecordingSession={isFromRecordingSession === 'true'}
            code={code}
        />
    )
}
