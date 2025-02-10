import React from 'react'

import { PairingView } from '@/components/session/pairing-view'

import type { RealtimeChannel } from '@supabase/supabase-js'

interface CodeEditorViewerProps {
    sessionCode: string | null
    statusMessage: string | null
    onReset: () => void
    channel: RealtimeChannel | null
    lastEventTime?: number
    eventCount?: number
}

export function CodeEditorViewer({
    sessionCode,
    statusMessage,
    onReset,
    lastEventTime,
    eventCount,
}: CodeEditorViewerProps) {
    // Only render event info if we have received events
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
