/**
 * Base interface for common metadata across all recording types
 */
export interface BaseRecordingMetadata {
    id: string
    created_at: string
    linked_repo?: string | null
    views?: number
}

/**
 * Metadata specific to video recordings
 */
export interface VideoMetadata extends BaseRecordingMetadata {
    type: 'video'
    name: string
    duration: number
    size: number
    storage_path: string
    mime_type: string
    thumbnail_url?: string
}

/**
 * Metadata specific to editor recordings
 */
export interface EditorMetadata extends BaseRecordingMetadata {
    type: 'editor'
    session_code: string
    initial_content: string
    duration_ms: number
    event_count: number
    status: 'draft' | 'recording' | 'saved' | 'deleted'
    final_content?: string
    thumbnail_code?: string // Syntax highlighted snippet for thumbnail
}

/**
 * Union type representing any type of recording
 */
export type RecordingMetadata = VideoMetadata | EditorMetadata

/**
 * Type guard to check if a recording is a video
 */
export function isVideoRecording(
    recording: RecordingMetadata,
): recording is VideoMetadata {
    return recording.type === 'video'
}

/**
 * Type guard to check if a recording is an editor session
 */
export function isEditorRecording(
    recording: RecordingMetadata,
): recording is EditorMetadata {
    return recording.type === 'editor'
}

/**
 * Editor event types that can occur during a recording
 */
export interface EditorEvent {
    type: 'insert' | 'delete' | 'replace'
    timestamp: number
    from: number
    to: number
    text: string
    removed?: string
}

/**
 * Batch of editor events stored together
 */
export interface EditorEventBatch {
    id: string
    session_id: string
    timestamp_start: number
    timestamp_end: number
    events: EditorEvent[]
    event_count: number
    created_at: string
}

/**
 * Editor snapshot for faster seeking
 */
export interface EditorSnapshot {
    id: string
    session_id: string
    event_index: number
    timestamp: number
    content: string
    metadata?: Record<string, unknown>
    created_at: string
}
