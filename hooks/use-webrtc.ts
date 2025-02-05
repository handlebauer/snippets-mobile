import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import {
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
} from 'react-native-webrtc'

import {
    CHANNEL_CONFIG,
    STATUS_MESSAGES,
    WEBRTC_CONFIG,
} from '@/constants/webrtc'

import { supabase } from '@/lib/supabase.client'

import type { ScreenShareState, WebRTCSignal } from '@/types/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useWebRTC() {
    const [state, setState] = useState<ScreenShareState>({
        sessionCode: null,
        streamURL: null,
        statusMessage: null,
    })
    const peerConnection = useRef<RTCPeerConnection | null>(null)
    const channel = useRef<RealtimeChannel | null>(null)

    const resetState = useCallback(() => {
        setState({
            sessionCode: null,
            streamURL: null,
            statusMessage: null,
        })
        if (peerConnection.current) {
            peerConnection.current.close()
            peerConnection.current = null
        }
        if (channel.current) {
            supabase.removeChannel(channel.current)
            channel.current = null
        }
    }, [])

    const handleStreamSetup = useCallback(
        (pc: RTCPeerConnection) => {
            pc.addEventListener('track', (event: any) => {
                if (event.streams && event.streams[0]) {
                    console.log('🎥 Received remote stream')
                    setState(prev => ({
                        ...prev,
                        streamURL: event.streams[0].toURL(),
                        statusMessage: null,
                    }))
                }
            })

            pc.addEventListener('connectionstatechange', () => {
                console.log('📡 WebRTC Connection State:', pc.connectionState)
                switch (pc.connectionState) {
                    case 'disconnected':
                    case 'failed':
                        resetState()
                        break
                    case 'connecting':
                        setState(prev => ({
                            ...prev,
                            statusMessage: STATUS_MESSAGES.CONNECTING,
                        }))
                        break
                    case 'connected':
                        setState(prev => ({ ...prev, statusMessage: null }))
                        break
                }
            })
        },
        [resetState],
    )

    const handleWebRTCSignal = useCallback(
        async (
            signal: WebRTCSignal,
            pc: RTCPeerConnection,
            signalingChannel: RealtimeChannel,
        ) => {
            try {
                switch (signal.type) {
                    case 'offer':
                        if (!signal.payload.offer?.sdp) break
                        console.log('📥 Received offer, creating answer')
                        await pc.setRemoteDescription(
                            new RTCSessionDescription({
                                type: signal.payload.offer.type,
                                sdp: signal.payload.offer.sdp,
                            }),
                        )
                        const answer = await pc.createAnswer()
                        await pc.setLocalDescription(answer)
                        console.log('📤 Sending answer')
                        await signalingChannel.send({
                            type: 'broadcast',
                            event: 'webrtc',
                            payload: {
                                type: 'answer',
                                payload: {
                                    answer: {
                                        type: answer.type,
                                        sdp: answer.sdp,
                                    },
                                },
                            },
                        })
                        break

                    case 'ice-candidate':
                        if (!signal.payload.candidate) break
                        console.log('🧊 Received ICE candidate')
                        await pc.addIceCandidate(
                            new RTCIceCandidate(signal.payload.candidate),
                        )
                        break
                }
            } catch (err) {
                const error = err as Error
                console.error('❌ WebRTC Error:', error)
                Alert.alert('WebRTC Error', error.message)
            }
        },
        [],
    )

    const startSession = useCallback(() => {
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        console.log('🎯 Generated session code:', code)
        setState(prev => ({ ...prev, sessionCode: code }))
    }, [])

    // Combined useEffect to ensure channel is set up before creating RTCPeerConnection
    useEffect(() => {
        if (!state.sessionCode) return

        console.log('🔄 Setting up signaling for session:', state.sessionCode)
        setState(prev => ({ ...prev, statusMessage: STATUS_MESSAGES.WAITING }))

        // Create and subscribe to the signaling channel first
        const newChannel = supabase.channel(`webrtc:${state.sessionCode}`, {
            config: CHANNEL_CONFIG,
        })

        newChannel.on('broadcast', { event: 'webrtc' }, async ({ payload }) => {
            if (!peerConnection.current) return
            await handleWebRTCSignal(
                payload as WebRTCSignal,
                peerConnection.current,
                newChannel,
            )
        })

        newChannel.subscribe(async status => {
            if (status === 'SUBSCRIBED') {
                console.log('👋 Connected to signaling channel')
                try {
                    const {
                        data: { user },
                    } = await supabase.auth.getUser()
                    if (!user) {
                        console.error('❌ No authenticated user found')
                        return
                    }

                    await newChannel.track({
                        online_at: new Date().toISOString(),
                        client_type: 'mobile',
                        user_id: user.id,
                    })
                    console.log('✅ Presence tracked:', {
                        userId: user.id,
                        clientType: 'mobile',
                    })
                } catch (error) {
                    console.error('❌ Error tracking presence:', error)
                }
            }
        })

        channel.current = newChannel

        // Now create the RTCPeerConnection after the channel is ready.
        const config = {
            ...WEBRTC_CONFIG,
            iceServers: [...WEBRTC_CONFIG.iceServers],
        }
        const pc = new RTCPeerConnection(config)
        peerConnection.current = pc

        handleStreamSetup(pc)

        pc.addEventListener(
            'icecandidate',
            (event: { candidate: RTCIceCandidate | null }) => {
                if (!event.candidate) return
                const candidate = event.candidate.toJSON()
                console.log('🧊 Sending ICE candidate', candidate)
                newChannel.send({
                    type: 'broadcast',
                    event: 'webrtc',
                    payload: {
                        type: 'ice-candidate',
                        payload: { candidate },
                    },
                })
            },
        )

        return () => {
            pc.close()
            supabase.removeChannel(newChannel)
        }
    }, [state.sessionCode, handleWebRTCSignal, handleStreamSetup])

    return {
        state,
        startSession,
        resetState,
        channel,
    }
}
