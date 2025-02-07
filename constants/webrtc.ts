export const WEBRTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // TODO: Add TURN servers for production
        // Example TURN configuration:
        // {
        //     urls: 'turn:your-turn-server.com:3478',
        //     username: 'username',
        //     credential: 'password'
        // }
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 0,
} as const

export const CHANNEL_CONFIG = {
    broadcast: { self: false },
    presence: { key: 'mobile' },
} as const

export const STATUS_MESSAGES = {
    CONNECTING: 'Connecting to screen share...',
    WAITING: 'Waiting for connection...',
    ENDED: 'Screen sharing has ended',
    NO_STREAM: 'No stream received yet.',
} as const
