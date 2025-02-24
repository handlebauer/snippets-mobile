import { useCallback, useEffect, useRef, useState } from 'react'
import { RTCIceCandidate, RTCPeerConnection } from 'react-native-webrtc'

import { STATUS_MESSAGES } from '@/constants/webrtc'
import { useSupabase } from '@/contexts/supabase.context'

import { useSessionCreator } from '@/hooks/use-session-creator'

import { cleanupChannel, setupChannel } from './session/channel'
import { createPeerConnection, setupPeerConnection } from './webrtc/connection'

import type { VideoProcessingSignal } from '@/types/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Generate a random 6-character code
const generatePairingCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

interface WebRTCState {
    isPairing: boolean
    sessionCode: string | null
    error: string | null
    streamURL: string | null
    statusMessage: string | null
    videoProcessing?: VideoProcessingSignal
}

export const useWebRTC = () => {
    const { supabase } = useSupabase()
    const { createSession } = useSessionCreator()
    const [state, setState] = useState<WebRTCState>({
        isPairing: false,
        sessionCode: null,
        error: null,
        streamURL: null,
        statusMessage: null,
    })

    const peerConnection = useRef<RTCPeerConnection | null>(null)
    const channel = useRef<RealtimeChannel | null>(null)
    const candidateQueue = useRef<RTCIceCandidate[]>([])

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
                if (!(await createSession(code))) {
                    throw new Error('Failed to create recording session')
                }

                // Create and store peer connection
                peerConnection.current = createPeerConnection()

                // Setup channel with video processing handler
                channel.current = await setupChannel(
                    supabase,
                    code,
                    handleVideoProcessing,
                )

                // Update state to reflect successful connection
                setState(prev => ({
                    ...prev,
                    isPairing: false,
                    statusMessage: 'Web client connected',
                }))

                // Notify web client of session type
                channel.current.send({
                    type: 'broadcast',
                    event: 'session_type',
                    payload: { type: 'screen_recording' },
                })

                // Setup WebRTC handlers and ICE candidates
                await setupPeerConnection(
                    peerConnection.current,
                    channel.current,
                    candidateQueue.current,
                    (url: string) =>
                        setState(prev => ({
                            ...prev,
                            streamURL: url,
                            statusMessage: null,
                        })),
                )
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
        [supabase, handleVideoProcessing, createSession],
    )

    const cleanup = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close()
            peerConnection.current = null
        }

        if (channel.current) {
            cleanupChannel(supabase, channel.current)
            channel.current = null
        }

        candidateQueue.current = []

        setState(prev => ({
            ...prev,
            isPairing: false,
            streamURL: null,
            error: null,
            sessionCode: null,
            statusMessage: null,
            videoProcessing: undefined,
        }))
    }, [supabase])

    useEffect(() => {
        return () => {
            cleanup()
        }
    }, [cleanup])

    return {
        state,
        startSession: handlePairDevice,
        resetState: cleanup,
        channel,
    }
}
