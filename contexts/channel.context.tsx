import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react'

import { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase.client'

import type { Enums } from '@/lib/supabase.types'

type RecordingSessionType = Enums<'recording_session_type'>

interface ChannelState {
    // Channel-related state
    isConnected: boolean
    error: string | null
    pairingCode: string | null
    sessionType: RecordingSessionType | null

    // Recording-related state (merged from recording context)
    isStreaming: boolean
    isEditing: boolean
    isRecording: boolean
    isScreenRecording: boolean
    recordingStartTime: number | null
    recordingDuration: string
}

interface ChannelContextType {
    state: ChannelState
    // Channel methods
    connect: (pairingCode: string) => Promise<void>
    disconnect: () => void
    getChannel: () => RealtimeChannel | null
    handlePairDevice: (code: string) => Promise<void>

    // Recording methods (merged from recording context)
    setIsStreaming: (isStreaming: boolean) => void
    setIsEditing: (isEditing: boolean) => void
    setIsRecording: (isRecording: boolean) => void
    setIsScreenRecording: (isRecording: boolean) => void
    setRecordingStartTime: (time: number | null) => void
}

const initialState: ChannelState = {
    // Channel initial state
    isConnected: false,
    error: null,
    pairingCode: null,
    sessionType: null,

    // Recording initial state
    isStreaming: false,
    isEditing: false,
    isRecording: false,
    isScreenRecording: false,
    recordingStartTime: null,
    recordingDuration: '00:00',
}

const ChannelContext = createContext<ChannelContextType | null>(null)

export function ChannelProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ChannelState>(initialState)
    const channelRef = useRef<RealtimeChannel | null>(null)

    const connect = useCallback(async (pairingCode: string) => {
        console.log('🔌 [Channel] Connecting:', { pairingCode })

        if (pairingCode.length !== 6) {
            console.error(
                '❌ [Channel] Invalid pairing code length:',
                pairingCode.length,
            )
            throw new Error('Please enter a complete pairing code')
        }

        if (channelRef.current) {
            console.log('📡 [Channel] Already connected')
            return
        }

        try {
            const channel = supabase.channel(pairingCode, {
                config: {
                    broadcast: {
                        self: true,
                    },
                },
            })

            channel
                .on('presence', { event: 'sync' }, () => {
                    console.log('🔄 [Channel] Presence sync')
                })
                .on('presence', { event: 'join' }, ({ newPresences }) => {
                    console.log('👋 [Channel] Presence join:', newPresences)
                })
                .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                    console.log('👋 [Channel] Presence leave:', leftPresences)
                })
                .on('broadcast', { event: 'session_type' }, ({ payload }) => {
                    console.log('📢 [Channel] Session type:', payload)
                    setState(prev => ({
                        ...prev,
                        sessionType: payload.type,
                    }))
                })

            channel.subscribe(status => {
                if (status === 'SUBSCRIBED') {
                    channelRef.current = channel
                    setState(prev => ({
                        ...prev,
                        isConnected: true,
                        pairingCode,
                        error: null,
                    }))
                }
            })

            console.log('✅ [Channel] Setup complete, waiting for session type')
        } catch (error) {
            console.error('❌ [Channel] Connection error:', error)
            setState(prev => ({
                ...prev,
                error: 'Failed to connect to channel',
                isConnected: false,
                sessionType: null,
            }))
            throw error
        }
    }, [])

    const disconnect = useCallback(() => {
        if (channelRef.current) {
            channelRef.current.unsubscribe()
            channelRef.current = null
            setState(prev => ({
                ...prev,
                isConnected: false,
                pairingCode: null,
                sessionType: null,
            }))
        }
    }, [])

    const getChannel = useCallback(() => channelRef.current, [])

    const handlePairDevice = useCallback(
        async (code: string) => {
            try {
                await connect(code)
            } catch (error) {
                console.error('❌ [Channel] Failed to pair device:', error)
                throw error
            }
        },
        [connect],
    )

    // Recording-related methods
    const setIsStreaming = useCallback((isStreaming: boolean) => {
        setState(prev => ({ ...prev, isStreaming }))
    }, [])

    const setIsEditing = useCallback((isEditing: boolean) => {
        setState(prev => ({ ...prev, isEditing }))
    }, [])

    const setIsRecording = useCallback((isRecording: boolean) => {
        setState(prev => ({ ...prev, isRecording }))
    }, [])

    const setIsScreenRecording = useCallback((isScreenRecording: boolean) => {
        setState(prev => ({ ...prev, isScreenRecording }))
    }, [])

    const setRecordingStartTime = useCallback(
        (recordingStartTime: number | null) => {
            setState(prev => ({ ...prev, recordingStartTime }))
        },
        [],
    )

    // Update recording duration timer
    useEffect(() => {
        if (!state.recordingStartTime) {
            setState(prev => ({ ...prev, recordingDuration: '00:00' }))
            return
        }

        const interval = setInterval(() => {
            const now = Date.now()
            const diff = now - (state.recordingStartTime || 0)
            const seconds = Math.floor(diff / 1000)
            const minutes = Math.floor(seconds / 60)
            const paddedSeconds = String(seconds % 60).padStart(2, '0')
            const paddedMinutes = String(minutes).padStart(2, '0')
            setState(prev => ({
                ...prev,
                recordingDuration: `${paddedMinutes}:${paddedSeconds}`,
            }))
        }, 1000)

        return () => clearInterval(interval)
    }, [state.recordingStartTime])

    return (
        <ChannelContext.Provider
            value={{
                state,
                connect,
                disconnect,
                getChannel,
                handlePairDevice,
                setIsStreaming,
                setIsEditing,
                setIsRecording,
                setIsScreenRecording,
                setRecordingStartTime,
            }}
        >
            {children}
        </ChannelContext.Provider>
    )
}

export const useChannel = () => {
    const context = useContext(ChannelContext)
    if (!context) {
        throw new Error('useChannel must be used within a ChannelProvider')
    }
    return context
}
