import { useCallback, useEffect, useRef, useState } from 'react'

import * as Speech from 'expo-speech'

import { useChannel } from '@/contexts/channel.context'

import { generateNarration } from '@/lib/api'

import type { RealtimeChannel } from '@supabase/supabase-js'

interface EditorEvent {
    type: 'insert' | 'delete' | 'replace'
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

// Types for narration payload
export interface CodeContext {
    before: string
    after: string
    changes: {
        added: string[]
        removed: string[]
    }
}

export interface EventGroup {
    events: EditorEvent[]
    timestamp_start: number
    timestamp_end: number
    characterChanges: number
    context: CodeContext
    metadata?: {
        isSignificant?: boolean
        description?: string
        type?: 'insertion' | 'deletion' | 'modification' | 'mixed'
    }
}

export interface NarrationPayload {
    timestamp: number
    eventGroup: EventGroup
}

interface NarrationState {
    isNarrating: boolean
    eventBuffer: EditorEvent[]
    lastProcessedTime: number | null
    sessionStartTime: number | null
    characterChangeCount: number // Track total character changes
    lastEventTime: number | null // Track last event time for pause detection
    processingTimeoutId: NodeJS.Timeout | null // Track debounce timeout
    currentContent: string // Track current content state
    isProcessing: boolean // Track if we're currently processing
}

// Constants for narration thresholds
const NARRATION_THRESHOLDS = {
    MIN_CHAR_CHANGES: 20, // Minimum character changes to consider a pause significant
    SIGNIFICANT_CHAR_CHANGES: 200, // Significantly increased to avoid interrupting active typing
    TYPING_PAUSE_MS: 2_000, // Increased pause detection to ensure user has actually stopped typing
    MAX_TIME_GAP_MS: 5_000, // Force narration after 5s regardless of changes
    DEBOUNCE_MS: 2_000, // Wait for 2s of inactivity before processing
} as const

const INITIAL_STATE: NarrationState = {
    isNarrating: false,
    eventBuffer: [],
    lastProcessedTime: null,
    sessionStartTime: null,
    characterChangeCount: 0,
    lastEventTime: null,
    processingTimeoutId: null,
    currentContent: '',
    isProcessing: false,
}

// Calculate character changes for an event
function calculateCharChanges(event: EditorEvent): number {
    const insertedLength = event.text?.length || 0
    const removedLength = event.removed?.length || 0
    return Math.abs(insertedLength - removedLength)
}

// Helper to determine event group type
function determineEventGroupType(
    events: EditorEvent[],
): NonNullable<EventGroup['metadata']>['type'] {
    const hasInsertions = events.some(
        e => e.type === 'insert' || (e.type === 'replace' && e.text.length > 0),
    )
    const hasDeletions = events.some(
        e => e.type === 'delete' || (e.type === 'replace' && e.removed?.length),
    )

    if (hasInsertions && !hasDeletions) return 'insertion'
    if (!hasInsertions && hasDeletions) return 'deletion'
    if (hasInsertions && hasDeletions) return 'mixed'
    return 'modification'
}

// Helper to extract relevant code context
function extractCodeContext(
    events: EditorEvent[],
    currentContent: string,
): CodeContext {
    // Extract before state by undoing the events in reverse order
    let beforeContent = currentContent
    const reversedEvents = [...events].reverse()
    for (const event of reversedEvents) {
        switch (event.type) {
            case 'insert':
                // Remove inserted text
                beforeContent =
                    beforeContent.slice(0, event.from) +
                    beforeContent.slice(event.from + event.text.length)
                break
            case 'delete':
                // Restore deleted text
                beforeContent =
                    beforeContent.slice(0, event.from) +
                    (event.removed || '') +
                    beforeContent.slice(event.from)
                break
            case 'replace':
                // Restore replaced text
                beforeContent =
                    beforeContent.slice(0, event.from) +
                    (event.removed || '') +
                    beforeContent.slice(event.from + event.text.length)
                break
        }
    }

    // Extract added/removed content
    const changes = {
        added: events
            .filter(
                e => e.type === 'insert' || (e.type === 'replace' && e.text),
            )
            .map(e => e.text)
            .filter(Boolean),
        removed: events
            .filter(
                e => e.type === 'delete' || (e.type === 'replace' && e.removed),
            )
            .map(e => e.removed!)
            .filter(Boolean),
    }

    return {
        before: beforeContent,
        after: currentContent,
        changes,
    }
}

// Prepare narration payload
function prepareNarrationPayload(
    events: EditorEvent[],
    currentContent: string,
): NarrationPayload {
    const eventGroup: EventGroup = {
        events,
        timestamp_start: events[0].timestamp,
        timestamp_end: events[events.length - 1].timestamp,
        characterChanges: events.reduce(
            (sum, event) => sum + calculateCharChanges(event),
            0,
        ),
        context: extractCodeContext(events, currentContent),
        metadata: {
            type: determineEventGroupType(events),
            isSignificant: events.some(e => e.metadata?.isSignificant),
            description: events.find(e => e.metadata?.description)?.metadata
                ?.description,
        },
    }

    return {
        timestamp: Date.now(),
        eventGroup,
    }
}

export function useNarration(channel: RealtimeChannel | null) {
    const stateRef = useRef<NarrationState>(INITIAL_STATE)
    const [lastNarration, setLastNarration] = useState<string | null>(null)
    const [error, setError] = useState<Error | null>(null)
    const {
        state: { recordingStartTime },
    } = useChannel()

    // Update session start time when recording starts
    useEffect(() => {
        if (recordingStartTime && !stateRef.current.sessionStartTime) {
            stateRef.current.sessionStartTime = recordingStartTime
            console.log(
                '🎙️ [useNarration] Set session start time:',
                recordingStartTime,
            )
        }
    }, [recordingStartTime])

    // Normalize event timestamps relative to session start
    const normalizeEvents = useCallback(
        (events: EditorEvent[]): EditorEvent[] => {
            if (!stateRef.current.sessionStartTime) {
                console.warn(
                    '⚠️ [useNarration] No session start time available for normalization',
                )
                return events
            }

            return events.map(event => ({
                ...event,
                timestamp: event.timestamp - stateRef.current.sessionStartTime!,
            }))
        },
        [],
    )

    // Process events in the buffer
    const processEventBuffer = useCallback(async () => {
        const state = stateRef.current
        if (
            !state.isNarrating ||
            state.eventBuffer.length === 0 ||
            state.isProcessing
        )
            return

        const now = Date.now() - (state.sessionStartTime || 0)

        // Check if we have enough meaningful content
        if (
            state.characterChangeCount < NARRATION_THRESHOLDS.MIN_CHAR_CHANGES
        ) {
            return
        }

        try {
            // Mark as processing to prevent duplicate calls
            state.isProcessing = true

            // Prepare narration payload
            const payload = prepareNarrationPayload(
                state.eventBuffer,
                state.currentContent,
            )

            console.log('🎙️ [useNarration] Sending events for narration:', {
                eventCount: state.eventBuffer.length,
                characterChanges: state.characterChangeCount,
                timeSinceLastProcess: state.lastProcessedTime
                    ? now - state.lastProcessedTime
                    : 'initial',
            })

            // Generate narration
            const response = await generateNarration(payload)

            console.log('🎙️ [useNarration] Received narration:', {
                confidence: response.confidence,
                tone: response.metadata?.tone,
                complexity: response.metadata?.complexity,
            })

            // Speak the narration
            Speech.speak(response.narration, {
                language: 'en',
                pitch: 1.0,
                rate: 0.9,
            })

            // Update state with new narration
            setLastNarration(response.narration)
            setError(null)
        } catch (err) {
            console.error('Failed to generate narration:', err)
            setError(
                err instanceof Error
                    ? err
                    : new Error('Failed to generate narration'),
            )
        } finally {
            // Update state and cleanup
            state.lastProcessedTime = now
            state.characterChangeCount = 0
            state.eventBuffer = []
            state.processingTimeoutId = null
            state.isProcessing = false
        }
    }, [channel])

    // Schedule processing with debounce
    const scheduleProcessing = useCallback(() => {
        const state = stateRef.current

        // Clear any existing timeout
        if (state.processingTimeoutId) {
            clearTimeout(state.processingTimeoutId)
        }

        // Force processing if we have significant changes
        if (
            state.characterChangeCount >=
            NARRATION_THRESHOLDS.SIGNIFICANT_CHAR_CHANGES
        ) {
            console.log(
                '🎙️ [useNarration] Processing due to significant changes',
            )
            processEventBuffer()
            return
        }

        // Schedule normal debounced processing
        state.processingTimeoutId = setTimeout(() => {
            console.log('🎙️ [useNarration] Processing due to typing pause')
            processEventBuffer()
        }, NARRATION_THRESHOLDS.DEBOUNCE_MS)
    }, [processEventBuffer])

    // Add events to the buffer
    const addEvents = useCallback(
        (events: EditorEvent[]) => {
            if (!stateRef.current.isNarrating) return

            // Normalize timestamps
            const normalizedEvents = normalizeEvents(events)

            // Calculate character changes
            const charChanges = normalizedEvents.reduce(
                (sum, event) => sum + calculateCharChanges(event),
                0,
            )

            // Update state
            stateRef.current.characterChangeCount += charChanges
            stateRef.current.lastEventTime =
                Date.now() - (stateRef.current.sessionStartTime || 0)

            // Update current content state by applying events
            normalizedEvents.forEach(event => {
                switch (event.type) {
                    case 'insert':
                        stateRef.current.currentContent =
                            stateRef.current.currentContent.slice(
                                0,
                                event.from,
                            ) +
                            event.text +
                            stateRef.current.currentContent.slice(event.from)
                        break
                    case 'delete':
                        stateRef.current.currentContent =
                            stateRef.current.currentContent.slice(
                                0,
                                event.from,
                            ) + stateRef.current.currentContent.slice(event.to)
                        break
                    case 'replace':
                        stateRef.current.currentContent =
                            stateRef.current.currentContent.slice(
                                0,
                                event.from,
                            ) +
                            event.text +
                            stateRef.current.currentContent.slice(event.to)
                        break
                }
            })

            // Add to buffer and sort by timestamp
            stateRef.current.eventBuffer.push(...normalizedEvents)
            stateRef.current.eventBuffer.sort(
                (a, b) => a.timestamp - b.timestamp,
            )

            console.log('🎙️ [useNarration] Added events to buffer:', {
                newEvents: events.length,
                totalEvents: stateRef.current.eventBuffer.length,
                characterChanges: charChanges,
                totalCharacterChanges: stateRef.current.characterChangeCount,
            })

            // Schedule processing
            scheduleProcessing()
        },
        [normalizeEvents, scheduleProcessing],
    )

    // Clean up on unmount or channel change
    useEffect(() => {
        return () => {
            if (stateRef.current.processingTimeoutId) {
                clearTimeout(stateRef.current.processingTimeoutId)
            }
        }
    }, [])

    // Handle narration state changes
    const handleNarrationStarted = useCallback(() => {
        console.log('🎙️ [useNarration] Narration started')
        // Clear any existing timeout before resetting state
        if (stateRef.current.processingTimeoutId) {
            clearTimeout(stateRef.current.processingTimeoutId)
        }
        stateRef.current = {
            ...INITIAL_STATE,
            isNarrating: true,
            sessionStartTime: stateRef.current.sessionStartTime,
        }
    }, [])

    const handleNarrationStopped = useCallback(() => {
        console.log('🎙️ [useNarration] Narration stopped')
        // Clear any existing timeout before resetting state
        if (stateRef.current.processingTimeoutId) {
            clearTimeout(stateRef.current.processingTimeoutId)
        }
        stateRef.current = {
            ...INITIAL_STATE,
            sessionStartTime: stateRef.current.sessionStartTime,
        }
    }, [])

    // Set up channel subscriptions
    useEffect(() => {
        if (!channel) return

        console.log('🎙️ [useNarration] Setting up channel subscriptions')

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

        return () => {
            // Clean up subscriptions and any pending timeout
            narrationStartSubscription.unsubscribe()
            narrationStopSubscription.unsubscribe()
            if (stateRef.current.processingTimeoutId) {
                clearTimeout(stateRef.current.processingTimeoutId)
            }
        }
    }, [channel, handleNarrationStarted, handleNarrationStopped])

    return {
        addEvents,
        isNarrating: stateRef.current.isNarrating,
        lastNarration,
        error,
        isProcessing: stateRef.current.isProcessing,
    }
}
