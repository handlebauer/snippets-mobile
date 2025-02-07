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

import type {
    ScreenShareState,
    VideoProcessingSignal,
    WebRTCSignal,
} from '@/types/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useWebRTC() {
    const [state, setState] = useState<ScreenShareState>({
        sessionCode: null,
        streamURL: null,
        statusMessage: null,
    })
    const peerConnection = useRef<RTCPeerConnection | null>(null)
    const channel = useRef<RealtimeChannel | null>(null)
    const videoChannel = useRef<RealtimeChannel | null>(null)
    // Candidate queue to buffer ICE candidates received before remoteDescription is set
    const candidateQueue = useRef<RTCIceCandidate[]>([])

    const resetState = useCallback(() => {
        console.log('🔄 Resetting WebRTC state')
        setState({
            sessionCode: null,
            streamURL: null,
            statusMessage: null,
        })
        if (peerConnection.current) {
            console.log('👋 Closing peer connection')
            peerConnection.current.close()
            peerConnection.current = null
        }
        if (channel.current) {
            console.log('👋 Removing WebRTC channel')
            supabase.removeChannel(channel.current)
            channel.current = null
        }
        if (videoChannel.current) {
            console.log('👋 Removing video processing channel')
            supabase.removeChannel(videoChannel.current)
            videoChannel.current = null
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
                console.log('📡 WebRTC Connection State:', pc.connectionState, {
                    iceConnectionState: pc.iceConnectionState,
                    iceGatheringState: pc.iceGatheringState,
                    signalingState: pc.signalingState,
                })

                switch (pc.connectionState) {
                    case 'disconnected':
                    case 'failed':
                        console.log('❌ Connection failed or disconnected', {
                            connectionState: pc.connectionState,
                            iceConnectionState: pc.iceConnectionState,
                        })
                        resetState()
                        Alert.alert(
                            'Connection Lost',
                            'The screen sharing connection was lost. Please try again.',
                        )
                        break
                    case 'connecting':
                        setState(prev => ({
                            ...prev,
                            statusMessage: STATUS_MESSAGES.CONNECTING,
                        }))
                        break
                    case 'connected':
                        console.log('✅ Connection established successfully')
                        setState(prev => ({ ...prev, statusMessage: null }))
                        break
                }
            })

            pc.addEventListener('iceconnectionstatechange', () => {
                console.log('🧊 ICE Connection State:', pc.iceConnectionState)
                if (pc.iceConnectionState === 'failed') {
                    console.log(
                        '❌ ICE Connection failed - possible TURN server needed',
                    )
                    Alert.alert(
                        'Connection Failed',
                        'Unable to establish a direct connection. This might be due to network restrictions.',
                    )
                }
            })

            pc.addEventListener('icegatheringstatechange', () => {
                console.log('🧊 ICE Gathering State:', pc.iceGatheringState)
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
                        // Set the remote description first...
                        await pc.setRemoteDescription(
                            new RTCSessionDescription({
                                type: signal.payload.offer.type,
                                sdp: signal.payload.offer.sdp,
                            }),
                        )
                        // Now flush any ICE candidates that arrived before remoteDescription was set.
                        for (const queuedCandidate of candidateQueue.current) {
                            try {
                                await pc.addIceCandidate(queuedCandidate)
                                console.log('✅ Flushed queued ICE candidate')
                            } catch (err) {
                                console.error(
                                    '❌ Error flushing ICE candidate:',
                                    err,
                                )
                            }
                        }
                        candidateQueue.current = []

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
                        const candidate = new RTCIceCandidate(
                            signal.payload.candidate,
                        )
                        // If remoteDescription isn't set yet, queue the candidate
                        if (!pc.remoteDescription) {
                            console.log(
                                '🌐 Remote description not set yet, queueing ICE candidate',
                            )
                            candidateQueue.current.push(candidate)
                        } else {
                            await pc.addIceCandidate(candidate)
                            console.log('✅ Added ICE candidate')
                        }
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

        console.log('🔄 Setting up signaling for session:', {
            sessionCode: state.sessionCode,
            hasExistingPeerConnection: !!peerConnection.current,
            hasExistingChannel: !!channel.current,
            hasExistingVideoChannel: !!videoChannel.current,
        })

        const connectionTimeout = setTimeout(() => {
            if (peerConnection.current?.connectionState !== 'connected') {
                console.log(
                    '⏰ Connection timeout - connection not established',
                )
                Alert.alert(
                    'Connection Timeout',
                    'Unable to establish connection. Please check your network and try again.',
                )
                resetState()
            }
        }, 30000) // 30 second timeout

        setState(prev => ({ ...prev, statusMessage: STATUS_MESSAGES.WAITING }))

        // Create and subscribe to the signaling channel first
        const newChannel = supabase.channel(`webrtc:${state.sessionCode}`, {
            config: CHANNEL_CONFIG,
        })

        // Create and subscribe to the video processing channel
        console.log('📡 Setting up video processing channel:', {
            channelName: `video:${state.sessionCode}`,
            sessionCode: state.sessionCode,
        })
        const newVideoChannel = supabase.channel(`video:${state.sessionCode}`, {
            config: CHANNEL_CONFIG,
        })

        newVideoChannel.on(
            'broadcast',
            { event: 'video_processing' },
            ({ payload }) => {
                console.log('📼 Received video processing update:', {
                    payload,
                    currentState: state,
                    channelState: newVideoChannel.state,
                    channelName: `video:${state.sessionCode}`,
                })
                const videoSignal = payload as VideoProcessingSignal
                setState(prev => {
                    const newState = {
                        ...prev,
                        videoProcessing: {
                            status: videoSignal.status,
                            videoId: videoSignal.videoId,
                            error: videoSignal.error,
                        },
                    }
                    console.log('🔄 Updating state with video processing:', {
                        prevState: prev,
                        newState,
                        channelState: newVideoChannel.state,
                    })
                    return newState
                })
            },
        )

        newVideoChannel.subscribe(status => {
            console.log('📡 Video processing channel status:', {
                status,
                channelName: `video:${state.sessionCode}`,
                presenceState: newVideoChannel.presenceState(),
            })
            if (status === 'SUBSCRIBED') {
                console.log('👋 Connected to video processing channel:', {
                    channelName: `video:${state.sessionCode}`,
                    state: newVideoChannel.state,
                })
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Video processing channel error:', {
                    status,
                    channelName: `video:${state.sessionCode}`,
                    state: newVideoChannel.state,
                })
            } else if (status === 'CLOSED') {
                console.log('👋 Video processing channel closed:', {
                    channelName: `video:${state.sessionCode}`,
                    state: newVideoChannel.state,
                })
            }
        })

        videoChannel.current = newVideoChannel

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
            clearTimeout(connectionTimeout)
            pc.close()
            supabase.removeChannel(newChannel)
            supabase.removeChannel(newVideoChannel)
        }
    }, [state.sessionCode, handleWebRTCSignal, handleStreamSetup])

    return {
        state,
        startSession,
        resetState,
        channel,
    }
}
