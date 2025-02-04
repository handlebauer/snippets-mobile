import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { RTCPeerConnection, RTCView } from 'react-native-webrtc'

// Minimal configuration using a public STUN server.
const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export default function Index() {
    const [streamURL, setStreamURL] = useState<string | null>(null)

    useEffect(() => {
        // Create a new RTCPeerConnection instance.
        const peerConnection = new RTCPeerConnection(configuration)

        // Instead of setting `ontrack` directly, use addEventListener.
        peerConnection.addEventListener('track', (event: any) => {
            if (event.streams && event.streams[0]) {
                setStreamURL(event.streams[0].toURL())
            }
        })

        // --- BEGIN SIGNALING PLACEHOLDER ---
        // In a full implementation, set up your signaling channel here
        // to exchange offers/answers with the desktop companion.
        // For this simple demo, we assume that an incoming call will eventually
        // trigger the 'track' event with a valid stream.
        // --- END SIGNALING PLACEHOLDER ---

        // Cleanup the peer connection when unmounting.
        return () => {
            peerConnection.close()
        }
    }, [])

    return (
        <View style={styles.container}>
            {streamURL ? (
                <RTCView
                    streamURL={streamURL}
                    style={styles.stream}
                    objectFit="cover"
                />
            ) : (
                <Text>No stream received yet.</Text>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stream: {
        width: '100%',
        height: '100%',
    },
})
