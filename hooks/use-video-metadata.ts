import { useCallback } from 'react'

import { supabase } from '@/lib/supabase.client'

interface VideoMetadataOptions {
    videoId: string
    sessionCode: string
}

export function useVideoMetadata({
    videoId,
    sessionCode,
}: VideoMetadataOptions) {
    const updateVideoMetadata = useCallback(async () => {
        try {
            console.log('🔄 Fetching session repository info:', {
                sessionCode,
                videoId,
            })

            // Get the repository from the recording session
            const { data: sessionData, error: sessionError } = await supabase
                .from('recording_sessions')
                .select('linked_repo')
                .eq('code', sessionCode)
                .single()

            if (sessionError) {
                console.error('❌ Error fetching session:', sessionError)
                throw sessionError
            }

            if (!sessionData.linked_repo) {
                console.log('ℹ️ No repository linked to session')
                return
            }

            console.log('📝 Updating video with repo:', sessionData.linked_repo)

            // Update the video with the repository information
            const { error: updateError } = await supabase
                .from('videos')
                .update({
                    linked_repo: sessionData.linked_repo,
                })
                .eq('id', videoId)

            if (updateError) {
                console.error('❌ Error updating video:', updateError)
                throw updateError
            }

            console.log('✅ Video metadata updated successfully')
        } catch (error) {
            console.error('❌ Error updating video metadata:', error)
            throw error
        }
    }, [videoId, sessionCode])

    return {
        updateVideoMetadata,
    }
}
