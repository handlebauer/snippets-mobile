import { useCallback, useEffect, useRef, useState } from 'react'
import { RTCIceCandidate, RTCPeerConnection } from 'react-native-webrtc'

import { STATUS_MESSAGES } from '@/constants/webrtc'
import { useSupabase } from '@/contexts/supabase.context'

import { useSessionCreator } from '@/hooks/use-session-creator'

import { cleanupChannel, setupChannel } from './session/channel'
import { createPeerConnection, setupPeerConnection } from './webrtc/connection'

import type { Database } from '@/lib/supabase.types'
import type { VideoProcessingSignal } from '@/types/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

type RecordingSessionType =
    Database['public']['Enums']['recording_session_type']

// Generate a random 6-character code
const generatePairingCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

interface SessionState {
    isPairing: boolean
    sessionCode: string | null
    error: string | null
    streamURL: string | null
    statusMessage: string | null
    sessionType: RecordingSessionType | null
    // Screen recording specific
    videoProcessing?: VideoProcessingSignal
    // Editor specific
    lastEditorEventTime?: number
    editorEventCount?: number
}

interface SessionContext {
    peerConnection: RTCPeerConnection | null
    stream: MediaStream | null
    mediaRecorder: MediaRecorder | null
    candidateQueue: RTCIceCandidate[]
}

export function useSession() {
    const { supabase } = useSupabase()
    const { createSession } = useSessionCreator()
    const [state, setState] = useState<SessionState>({
        isPairing: false,
        sessionCode: null,
        error: null,
        streamURL: null,
        statusMessage: null,
        sessionType: null,
    })

    const context = useRef<SessionContext>({
        peerConnection: null,
        stream: null,
        mediaRecorder: null,
        candidateQueue: [],
    })
    const channel = useRef<RealtimeChannel | null>(null)

    // Add setSessionType function
    const setSessionType = useCallback((type: RecordingSessionType) => {
        console.log('🔄 Setting session type:', type)
        setState(prev => ({ ...prev, sessionType: type }))
    }, [])

    const handleVideoProcessing = useCallback(
        (signal: VideoProcessingSignal) => {
            console.log('📹 Received video processing signal:', signal)
            setState(prev => ({
                ...prev,
                videoProcessing: signal,
                statusMessage:
                    signal.status === 'completed'
                        ? 'Video processing complete'
                        : 'Processing video...',
                isPairing: signal.status !== 'completed',
            }))
        },
        [],
    )

    // const handleEditorContent = useCallback((content: string) => {
    //     setState(prev => ({
    //         ...prev,
    //         content,
    //         isInitialContentSet: true,
    //     }))
    // }, [])

    // Add editor event handling to channel setup
    const setupEditorEvents = useCallback((channel: RealtimeChannel) => {
        console.log('📝 Setting up editor event handling in useSession')

        channel.on('broadcast', { event: 'editor_batch' }, payload => {
            const now = Date.now()
            console.log('📝 Received editor batch:', {
                timestamp_start: new Date(
                    payload.payload.timestamp_start,
                ).toISOString(),
                timestamp_end: new Date(
                    payload.payload.timestamp_end,
                ).toISOString(),
                received_at: new Date(now).toISOString(),
                event_count: payload.payload.events.length,
                first_event_type: payload.payload.events[0]?.type,
            })

            setState(prev => ({
                ...prev,
                lastEditorEventTime: now,
                editorEventCount: (prev.editorEventCount || 0) + 1,
            }))
        })
    }, [])

    const handlePairDevice = useCallback(
        async (pairingCode?: string) => {
            try {
                const code = pairingCode || generatePairingCode()
                setState(prev => ({
                    ...prev,
                    isPairing: true,
                    error: null,
                    sessionCode: code,
                    statusMessage: STATUS_MESSAGES.WAITING,
                }))

                // Create a new recording session in the database first
                if (!state.sessionType) {
                    throw new Error('Session type must be set before pairing')
                }
                if (!(await createSession(code, state.sessionType))) {
                    throw new Error('Failed to create recording session')
                }

                // Create and store peer connection for screen recording
                context.current.peerConnection = createPeerConnection()

                // Setup channel with handlers
                channel.current = await setupChannel(
                    supabase,
                    code,
                    handleVideoProcessing,
                )

                // Set up editor events if needed
                if (state.sessionType === 'code_editor') {
                    setupEditorEvents(channel.current)
                }

                // Update state to reflect successful connection
                setState(prev => ({
                    ...prev,
                    isPairing: false,
                    statusMessage: 'Web client connected',
                }))

                // Send session type AFTER successful pairing
                if (state.sessionType) {
                    console.log(
                        '📝 Sending session type after pairing:',
                        state.sessionType,
                    )
                    channel.current?.send({
                        type: 'broadcast',
                        event: 'session_type',
                        payload: { type: state.sessionType },
                    })
                } else {
                    console.log('⚠️ No session type set after pairing')
                }

                // For screen recording, set up WebRTC
                if (context.current.peerConnection) {
                    await setupPeerConnection(
                        context.current.peerConnection,
                        channel.current,
                        context.current.candidateQueue,
                        (url: string) =>
                            setState(prev => ({
                                ...prev,
                                streamURL: url,
                                statusMessage: null,
                            })),
                    )
                }
            } catch (error) {
                console.error('Error pairing device:', error)
                setState(prev => ({
                    ...prev,
                    isPairing: false,
                    sessionCode: null,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to pair device',
                }))
            }
        },
        [
            supabase,
            handleVideoProcessing,
            createSession,
            state.sessionType,
            setupEditorEvents,
        ],
    )

    const cleanup = useCallback(() => {
        if (context.current.peerConnection) {
            context.current.peerConnection.close()
            context.current.peerConnection = null
        }

        if (context.current.stream) {
            const tracks = context.current.stream.getTracks()
            tracks.forEach(track => track.stop())
            context.current.stream = null
        }

        if (channel.current) {
            cleanupChannel(supabase, channel.current)
            channel.current = null
        }

        context.current.candidateQueue = []

        setState(prev => ({
            ...prev,
            isPairing: false,
            streamURL: null,
            error: null,
            sessionCode: null,
            statusMessage: null,
            videoProcessing: undefined,
            lastEditorEventTime: undefined,
            editorEventCount: undefined,
            sessionType: null,
        }))
    }, [supabase])

    useEffect(() => {
        return () => {
            cleanup()
        }
    }, [cleanup])

    // For backward compatibility with existing components
    const screenSession = {
        state: {
            ...state,
            isSharing: !!state.streamURL,
        },
        startSession: handlePairDevice,
        resetState: cleanup,
        channel,
    }

    return {
        state,
        startSession: handlePairDevice,
        cleanup,
        channel,
        setSessionType, // Expose setSessionType
        // For compatibility with existing components
        screen: screenSession,
        // Editor specific functionality
        editor:
            state.sessionType === 'code_editor'
                ? {
                      lastEditorEventTime: state.lastEditorEventTime,
                      editorEventCount: state.editorEventCount,
                  }
                : null,
    }
}
