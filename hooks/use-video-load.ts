import { useCallback, useState } from 'react'

import { supabase } from '@/lib/supabase.client'

import type { VideoMetadata } from '@/types/recordings'

interface UseVideoLoadOptions {
    videoId: string
}

export function useVideoLoad({ videoId }: UseVideoLoadOptions) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [video, setVideo] = useState<VideoMetadata | null>(null)
    const [videoUrl, setVideoUrl] = useState<string | null>(null)

    const loadVideo = useCallback(async () => {
        try {
            console.log('🔍 Fetching video details for:', videoId)
            const { data, error } = await supabase
                .from('videos')
                .select('*')
                .eq('id', videoId)
                .single()

            if (error) throw error
            console.log('📝 Video data:', data)

            // Check if the video file exists in storage
            const { data: fileData, error: fileError } = await supabase.storage
                .from('videos')
                .list(videoId)

            if (fileError) {
                console.error('❌ Error checking video file:', fileError)
                throw fileError
            }

            // Try to find trimmed version first, fall back to most recent video file
            const videoFile =
                fileData.find(f => f.name === 'trimmed.mp4') ||
                fileData.find(
                    f => f.name.endsWith('.mp4') && f.name !== 'trimmed.mp4',
                )

            if (!videoFile) {
                throw new Error('No video file found in storage')
            }

            console.log('📊 Video file details:', {
                name: videoFile.name,
                size: videoFile.metadata?.size || 0,
                mimeType: videoFile.metadata?.mimetype,
            })

            setVideo(data)

            // Get signed URL for video
            const { data: signedUrlData, error: signedUrlError } =
                await supabase.storage
                    .from('videos')
                    .createSignedUrl(data.storage_path, 3600)

            if (signedUrlError) throw signedUrlError
            if (signedUrlData?.signedUrl) {
                console.log('🔗 Got signed URL:', {
                    url: signedUrlData.signedUrl,
                    storagePath: data.storage_path,
                })
                setVideoUrl(signedUrlData.signedUrl)
            }

            return { video: data, videoUrl: signedUrlData?.signedUrl }
        } catch (err) {
            console.error('❌ Error fetching video:', err)
            setError(
                err instanceof Error ? err.message : 'Failed to load video',
            )
            return { error: err }
        } finally {
            setLoading(false)
        }
    }, [videoId])

    return {
        loading,
        error,
        video,
        videoUrl,
        loadVideo,
        setVideo,
        setVideoUrl,
    }
}
