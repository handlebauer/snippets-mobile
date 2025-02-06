import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase.client'

import type { VideoMetadata } from '@/types/webrtc'

export function useVideos() {
    const [videos, setVideos] = useState<VideoMetadata[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchVideos = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            if (!user) {
                setError('User not authenticated')
                return
            }

            const { data, error } = await supabase
                .from('videos')
                .select('*')
                .eq('profile_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setVideos(data || [])
            setError(null)
        } catch (err) {
            console.error('Error fetching videos:', err)
            setError(
                err instanceof Error ? err.message : 'Failed to fetch videos',
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchVideos()
    }, [])

    return {
        videos,
        loading,
        error,
        refetch: fetchVideos,
    }
}
