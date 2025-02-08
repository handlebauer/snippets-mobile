export const WEBRTC_CONFIG = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302',
        },
    ],
    iceCandidatePoolSize: 10,
} as const

export const PRESENCE_SYNC_DELAY = 2000

export const CHANNEL_CONFIG = {
    broadcast: { self: false },
    presence: { key: 'presence' },
} as const

export const MEDIA_CONSTRAINTS = {
    video: true,
    audio: true,
} as const

export const STATUS_MESSAGES = {
    CONNECTING: 'Connecting to screen share...',
    WAITING: 'Waiting for connection...',
    ENDED: 'Screen sharing has ended',
    NO_STREAM: 'No stream received yet.',
} as const
