export const WEBRTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
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
