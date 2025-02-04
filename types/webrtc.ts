export interface WebRTCSignal {
    type: 'offer' | 'answer' | 'ice-candidate'
    payload: {
        offer?: RTCSessionDescriptionInit
        answer?: RTCSessionDescriptionInit
        candidate?: RTCIceCandidateInit
    }
}

export interface ScreenShareState {
    sessionCode: string | null
    streamURL: string | null
    statusMessage: string | null
}
