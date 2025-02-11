import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase.client'

import type { RecordingMetadata } from '@/types/recordings'

export function useVideos() {
    const [recordings, setRecordings] = useState<RecordingMetadata[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchRecordings = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            if (!user) {
                setError('User not authenticated')
                return
            }

            const { data, error } = await supabase.rpc(
                'fetch_user_recordings',
                {
                    profile_id_param: user.id,
                },
            )

            if (error) throw error
            setRecordings(data || [])
            setError(null)
        } catch (err) {
            console.error('Error fetching recordings:', err)
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to fetch recordings',
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRecordings()

        // Set up realtime subscription for both videos and recording sessions
        const videosChannel = supabase
            .channel('videos_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'videos',
                },
                () => {
                    fetchRecordings()
                },
            )
            .subscribe()

        const recordingsChannel = supabase
            .channel('recordings_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'recording_sessions',
                },
                () => {
                    fetchRecordings()
                },
            )
            .subscribe()

        return () => {
            supabase.removeChannel(videosChannel)
            supabase.removeChannel(recordingsChannel)
        }
    }, [])

    return {
        videos: recordings,
        loading,
        error,
        refetch: fetchRecordings,
    }
}
