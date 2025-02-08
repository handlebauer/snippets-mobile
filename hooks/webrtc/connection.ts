import {
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
} from 'react-native-webrtc'

import { WEBRTC_CONFIG } from '@/constants/webrtc'

import type { WebRTCSignal } from '@/types/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const createPeerConnection = () => {
    const config = {
        ...WEBRTC_CONFIG,
        iceServers: [...WEBRTC_CONFIG.iceServers],
    }
    try {
        return new RTCPeerConnection(config)
    } catch (error) {
        console.error('Failed to create RTCPeerConnection:', error)
        throw new Error('Failed to initialize WebRTC connection')
    }
}

export const setupWebRTCHandlers = (
    peerConnection: RTCPeerConnection,
    channel: RealtimeChannel,
    candidateQueue: RTCIceCandidate[],
    onStreamURL: (url: string) => void,
) => {
    if (!peerConnection || !channel) {
        throw new Error('Missing required WebRTC handlers parameters')
    }

    peerConnection.addEventListener('track', (event: any) => {
        if (!event.streams) {
            console.error('No streams in track event')
            return
        }
        const [stream] = event.streams
        if (!stream) {
            console.error('Empty stream array in track event')
            return
        }
        try {
            const url = stream.toURL()
            onStreamURL(url)
        } catch (error) {
            console.error('Error converting stream to URL:', error)
        }
    })

    channel.on('broadcast', { event: 'webrtc' }, async ({ payload }) => {
        if (!payload || typeof payload !== 'object') {
            console.error('Invalid WebRTC signal payload:', payload)
            return
        }
        const signal = payload as WebRTCSignal
        if (!peerConnection) {
            console.error('No peer connection available')
            return
        }

        try {
            if (signal.type === 'offer' && signal.payload.offer?.sdp) {
                if (!signal.payload.offer.type) {
                    console.error('Invalid offer type:', signal.payload.offer)
                    return
                }
                // Set the remote description first...
                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription({
                        type: signal.payload.offer.type,
                        sdp: signal.payload.offer.sdp,
                    }),
                )

                // Now flush any ICE candidates that arrived before remoteDescription was set
                for (const queuedCandidate of candidateQueue) {
                    try {
                        await peerConnection.addIceCandidate(queuedCandidate)
                    } catch (err) {
                        console.error('Error flushing ICE candidate:', err)
                    }
                }
                candidateQueue.length = 0 // Clear the queue

                try {
                    const answer = await peerConnection.createAnswer()
                    await peerConnection.setLocalDescription(answer)

                    await channel.send({
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
                } catch (error) {
                    console.error('Error creating/sending answer:', error)
                    throw error
                }
            } else if (
                signal.type === 'ice-candidate' &&
                signal.payload.candidate
            ) {
                if (!signal.payload.candidate.candidate) {
                    console.error(
                        'Invalid ICE candidate:',
                        signal.payload.candidate,
                    )
                    return
                }
                const candidate = new RTCIceCandidate(signal.payload.candidate)
                // If remoteDescription isn't set yet, queue the candidate
                if (!peerConnection.remoteDescription) {
                    candidateQueue.push(candidate)
                } else {
                    await peerConnection.addIceCandidate(candidate)
                }
            }
        } catch (err) {
            console.error('Error handling WebRTC signal:', err)
        }
    })

    peerConnection.addEventListener('icecandidate', event => {
        if (event.candidate) {
            try {
                const candidateJson = event.candidate.toJSON()
                channel.send({
                    type: 'broadcast',
                    event: 'webrtc',
                    payload: {
                        type: 'ice-candidate',
                        payload: { candidate: candidateJson },
                    },
                })
            } catch (error) {
                console.error('Error sending ICE candidate:', error)
            }
        }
    })

    return channel
}

export const setupPeerConnection = async (
    peerConnection: RTCPeerConnection,
    channel: RealtimeChannel,
    candidateQueue: RTCIceCandidate[],
    onStreamURL: (url: string) => void,
) => {
    if (!peerConnection || !channel) {
        throw new Error('Missing required peer connection parameters')
    }

    try {
        return setupWebRTCHandlers(
            peerConnection,
            channel,
            candidateQueue,
            onStreamURL,
        )
    } catch (error) {
        console.error('Error setting up WebRTC handlers:', error)
        throw error
    }
}
