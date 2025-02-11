import type { Database } from '@/lib/supabase.types'

type RecordingSessionType =
    Database['public']['Enums']['recording_session_type']

export interface WebRTCSignal {
    type: 'offer' | 'answer' | 'ice-candidate'
    payload: {
        offer?: {
            type: RTCSessionDescriptionType
            sdp: string
        }
        answer?: {
            type: RTCSessionDescriptionType
            sdp: string
        }
        candidate?: RTCIceCandidateInit
    }
}

export interface RecordingSignal {
    type: 'recording'
    action: 'start' | 'stop'
}

export interface VideoProcessingSignal {
    type: 'video_processing'
    status: 'processing' | 'completed' | 'error'
    videoId?: string
    error?: string
}

export interface VideoMetadata {
    id: string
    name: string
    duration: number
    size: number
    storage_path: string
    mime_type: string
    created_at: string
    thumbnail_url?: string
    views?: number
    linked_repo?: string | null
}

export interface ScreenShareState {
    sessionCode: string | null
    streamURL: string | null
    statusMessage: string | null
    isRecording?: boolean
    sessionType?: RecordingSessionType | null
    videoProcessing?: {
        status: 'processing' | 'completed' | 'error'
        videoId?: string
        error?: string
    }
}

type RTCSessionDescriptionType = 'offer' | 'answer' | 'pranswer' | 'rollback'
