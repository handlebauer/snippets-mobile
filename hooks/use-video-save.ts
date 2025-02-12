import { Buffer } from 'buffer'
import { useCallback, useState } from 'react'

import * as FileSystem from 'expo-file-system'

import { useChannel } from '@/contexts/channel.context'
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native'

import { supabase } from '@/lib/supabase.client'

import type { VideoMetadata } from '@/types/recordings'

interface UseVideoSaveOptions {
    videoId: string
    isFromPostRecording?: boolean
    pairingCode?: string
}

interface SaveVideoOptions {
    video: VideoMetadata
    videoUrl: string
    trimStart: number
    trimEnd: number
    originalTrimStart: number
    originalTrimEnd: number
}

export function useVideoSave({
    videoId,
    isFromPostRecording,
    pairingCode,
}: UseVideoSaveOptions) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { state: channelState } = useChannel()

    const saveVideo = useCallback(
        async ({
            video,
            videoUrl,
            trimStart,
            trimEnd,
            originalTrimStart,
            originalTrimEnd,
        }: SaveVideoOptions) => {
            try {
                // Only proceed with trim if there are actual trim changes
                if (
                    trimStart !== originalTrimStart ||
                    trimEnd !== originalTrimEnd
                ) {
                    // Create a temporary directory for the trimmed video
                    const tempDir = `${FileSystem.cacheDirectory}video-trim-${videoId}/`
                    await FileSystem.makeDirectoryAsync(tempDir, {
                        intermediates: true,
                    })

                    // Generate output path for trimmed video
                    const outputPath = `${tempDir}trimmed.mp4`

                    // Show loading state
                    setLoading(true)

                    // Construct FFmpeg command for trimming
                    const command = `-y -ss ${trimStart} -t ${trimEnd - trimStart} -i ${videoUrl} -c copy ${outputPath}`

                    console.log('Starting video trim:', {
                        command,
                        trimStart,
                        trimEnd,
                        duration: trimEnd - trimStart,
                    })

                    // Execute FFmpeg command
                    const session = await FFmpegKit.execute(command)
                    const returnCode = await session.getReturnCode()

                    if (ReturnCode.isSuccess(returnCode)) {
                        console.log('Video trimmed successfully')

                        // Verify the output file exists and has content
                        const fileInfo =
                            await FileSystem.getInfoAsync(outputPath)
                        if (!fileInfo.exists) {
                            throw new Error('Trimmed video file not created')
                        }

                        // Read the file as binary data
                        const binaryFile = await FileSystem.readAsStringAsync(
                            outputPath,
                            {
                                encoding: FileSystem.EncodingType.Base64,
                            },
                        )

                        // Convert base64 to binary data
                        const binaryData = Buffer.from(binaryFile, 'base64')

                        if (!binaryData || binaryData.length === 0) {
                            throw new Error('Failed to read trimmed video file')
                        }

                        const newStoragePath = `${videoId}/trimmed.mp4`

                        // Upload the binary data
                        const { error: uploadError } = await supabase.storage
                            .from('videos')
                            .upload(newStoragePath, binaryData, {
                                contentType: 'video/mp4',
                                upsert: true,
                            })

                        if (uploadError) throw uploadError

                        // Update video metadata in database
                        const { error: updateError } = await supabase
                            .from('videos')
                            .update({
                                storage_path: newStoragePath,
                                duration: trimEnd - trimStart,
                                trim_start: trimStart,
                                trim_end: trimEnd,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', videoId)

                        if (updateError) throw updateError

                        // Clean up temporary files
                        await FileSystem.deleteAsync(tempDir, {
                            idempotent: true,
                        })
                    } else {
                        throw new Error('Failed to trim video')
                    }
                }

                // If this is from post-recording, we need to mark the video as saved
                if (isFromPostRecording) {
                    const { error: finalizeError } = await supabase.rpc(
                        'finalize_recording_session',
                        {
                            pairing_code: pairingCode,
                            duration_ms: Math.round(video.duration * 1000),
                        },
                    )

                    if (finalizeError) throw finalizeError
                }

                return { success: true }
            } catch (err) {
                console.error('Error saving video:', err)
                setError(
                    err instanceof Error ? err.message : 'Failed to save video',
                )
                return { success: false, error: err }
            } finally {
                setLoading(false)
            }
        },
        [videoId, isFromPostRecording, pairingCode, channelState.pairingCode],
    )

    return {
        loading,
        error,
        saveVideo,
    }
}
