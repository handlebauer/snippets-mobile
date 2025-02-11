import React from 'react'

import { useLocalSearchParams, useRouter } from 'expo-router'

import { EditorEditView } from '@/components/editor-edit-view'

export default function EditorEditScreen() {
    const router = useRouter()
    const { events: eventsJson, initialContent } = useLocalSearchParams<{
        events: string
        initialContent: string
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

    return (
        <EditorEditView
            events={events}
            initialContent={initialContent || ''}
            onClose={() => router.back()}
        />
    )
}
