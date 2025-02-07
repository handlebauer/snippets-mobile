import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase.client'

import type { VideoMetadata } from '@/types/webrtc'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

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

        // Set up realtime subscription
        const channel = supabase
            .channel('videos_changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'videos',
                },
                async (
                    payload: RealtimePostgresChangesPayload<VideoMetadata>,
                ) => {
                    console.log('📼 Realtime video update:', payload)

                    // Fetch the current user to filter changes
                    const {
                        data: { user },
                    } = await supabase.auth.getUser()
                    if (!user) return

                    // Only process changes for the current user's videos
                    if (
                        payload.new &&
                        'profile_id' in payload.new &&
                        payload.new.profile_id === user.id
                    ) {
                        switch (payload.eventType) {
                            case 'INSERT':
                                setVideos(prev => [
                                    payload.new as VideoMetadata,
                                    ...prev,
                                ])
                                break
                            case 'UPDATE':
                                setVideos(prev =>
                                    prev.map(video =>
                                        video.id === payload.new.id
                                            ? { ...video, ...payload.new }
                                            : video,
                                    ),
                                )
                                break
                            case 'DELETE':
                                setVideos(prev =>
                                    prev.filter(
                                        video => video.id !== payload.old.id,
                                    ),
                                )
                                break
                        }
                    }
                },
            )
            .subscribe()

        // Cleanup subscription on unmount
        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return {
        videos,
        loading,
        error,
        refetch: fetchVideos,
    }
}
