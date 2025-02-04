import React, { useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { Button, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
    RTCView,
} from 'react-native-webrtc'

import { supabase } from '@/lib/supabase.client'

import type { RealtimeChannel } from '@supabase/supabase-js'

interface WebRTCSignal {
    type: 'offer' | 'answer' | 'ice-candidate'
    payload: {
        offer?: RTCSessionDescriptionInit
        answer?: RTCSessionDescriptionInit
        candidate?: RTCIceCandidateInit
    }
}

// Minimal PeerConnection configuration using a public STUN server.
const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export default function Index() {
    // State for holding the generated session code.
    const [sessionCode, setSessionCode] = useState<string | null>(null)
    // State for storing the URL of the incoming video stream.
    const [streamURL, setStreamURL] = useState<string | null>(null)
    // Use a ref to hold our RTCPeerConnection instance.
    const peerConnection = useRef<RTCPeerConnection | null>(null)
    const channel = useRef<RealtimeChannel | null>(null)

    // Initialize WebRTC peer connection
    useEffect(() => {
        const pc = new RTCPeerConnection(configuration)
        peerConnection.current = pc

        pc.addEventListener('track', (event: any) => {
            if (event.streams && event.streams[0]) {
                console.log('🎥 Received remote stream')
                setStreamURL(event.streams[0].toURL())
            }
        })

        pc.addEventListener('connectionstatechange', () => {
            console.log('📡 WebRTC Connection State:', pc.connectionState)
        })

        // Handle ICE candidates
        pc.addEventListener(
            'icecandidate',
            (event: { candidate: RTCIceCandidate | null }) => {
                if (event.candidate && channel.current && sessionCode) {
                    console.log('🧊 Sending ICE candidate')
                    channel.current.send({
                        type: 'broadcast',
                        event: 'webrtc',
                        payload: {
                            type: 'ice-candidate',
                            payload: {
                                candidate: event.candidate,
                            },
                        },
                    })
                }
            },
        )

        return () => {
            pc.close()
        }
    }, [sessionCode])

    // Set up signaling when session code is available
    useEffect(() => {
        if (sessionCode && peerConnection.current) {
            console.log('🔄 Setting up signaling for session:', sessionCode)

            // Create and subscribe to the channel
            const newChannel = supabase.channel(`webrtc:${sessionCode}`, {
                config: {
                    broadcast: { self: false },
                    presence: {
                        key: 'mobile',
                    },
                },
            })

            // Listen for WebRTC signals
            newChannel.on(
                'broadcast',
                { event: 'webrtc' },
                async ({ payload }) => {
                    try {
                        const signal = payload as WebRTCSignal
                        const pc = peerConnection.current
                        if (!pc) return

                        switch (signal.type) {
                            case 'offer':
                                if (
                                    !signal.payload.offer ||
                                    !signal.payload.offer.sdp
                                )
                                    break
                                console.log(
                                    '📥 Received offer, creating answer',
                                )
                                await pc.setRemoteDescription(
                                    new RTCSessionDescription({
                                        type: signal.payload.offer.type,
                                        sdp: signal.payload.offer.sdp,
                                    }),
                                )
                                const answer = await pc.createAnswer()
                                await pc.setLocalDescription(answer)
                                console.log('📤 Sending answer')
                                newChannel.send({
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
                                    new RTCIceCandidate(
                                        signal.payload.candidate,
                                    ),
                                )
                                break
                        }
                    } catch (error: any) {
                        console.error('❌ WebRTC Error:', error)
                        Alert.alert('WebRTC Error', error.message)
                    }
                },
            )

            // Subscribe and track presence
            newChannel.subscribe(async status => {
                if (status === 'SUBSCRIBED') {
                    console.log('👋 Connected to signaling channel')
                    try {
                        await newChannel.track({
                            online_at: new Date().toISOString(),
                        })
                        console.log('✅ Presence tracked successfully')

                        // Log the current presence state
                        const presenceState = newChannel.presenceState()
                        console.log(
                            '📱 Current presence state:',
                            JSON.stringify(presenceState, null, 2),
                        )
                    } catch (error) {
                        console.error('❌ Error tracking presence:', error)
                    }
                } else {
                    console.log('📡 Channel status:', status)
                }
            })

            // Listen for presence changes
            newChannel.on('presence', { event: 'sync' }, () => {
                const state = newChannel.presenceState()
                console.log('🔄 Presence sync:', JSON.stringify(state, null, 2))
            })

            newChannel.on(
                'presence',
                { event: 'join' },
                ({ key, newPresences }) => {
                    console.log('👋 Presence join:', key, newPresences)
                },
            )

            newChannel.on(
                'presence',
                { event: 'leave' },
                ({ key, leftPresences }) => {
                    console.log('👋 Presence leave:', key, leftPresences)
                },
            )

            channel.current = newChannel

            // Return cleanup function
            return () => {
                if (channel.current) {
                    supabase.removeChannel(channel.current)
                    channel.current = null
                }
            }
        }
    }, [sessionCode])

    // When the user taps the button, generate a random 6-digit code and set it in state.
    const handleStartSession = () => {
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        console.log('🎯 Generated session code:', code)
        setSessionCode(code)
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                {!sessionCode && (
                    <Button
                        mode="contained"
                        onPress={handleStartSession}
                        style={styles.button}
                    >
                        Start Recording Session
                    </Button>
                )}

                {sessionCode && (
                    <View style={styles.infoContainer}>
                        <Text variant="headlineMedium" style={styles.codeText}>
                            {sessionCode}
                        </Text>
                        <Text
                            variant="bodyMedium"
                            style={styles.instructionText}
                        >
                            Visit{' '}
                            <Text style={styles.boldText}>snippet.is</Text> on
                            your computer and enter this code to begin
                            streaming.
                        </Text>
                    </View>
                )}

                {streamURL ? (
                    <RTCView
                        streamURL={streamURL}
                        style={styles.stream}
                        objectFit="cover"
                    />
                ) : (
                    <View style={styles.placeholderContainer}>
                        <Text variant="bodyLarge" style={styles.noStreamText}>
                            No stream received yet.
                        </Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        marginVertical: 20,
    },
    infoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    codeText: {
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 16,
    },
    instructionText: {
        textAlign: 'center',
        marginHorizontal: 32,
        lineHeight: 24,
    },
    boldText: {
        fontWeight: 'bold',
    },
    placeholderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noStreamText: {
        color: '#666',
    },
    stream: {
        flex: 1,
        width: '100%',
        backgroundColor: '#000',
        marginTop: 16,
    },
})
