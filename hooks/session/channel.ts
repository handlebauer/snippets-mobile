import type { VideoProcessingSignal } from '@/types/webrtc'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'

// Track cleanup state for each channel
const cleanupStates = new WeakMap<RealtimeChannel, boolean>()

export const setupChannel = async (
    supabase: SupabaseClient,
    pairingCode: string,
    onVideoProcessing?: (signal: VideoProcessingSignal) => void,
) => {
    console.log('🔄 Starting channel setup for code:', pairingCode)
    if (!pairingCode) {
        throw new Error('Please enter a complete pairing code')
    }

    // Get the current user from the session
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
        console.error('❌ Failed to get authenticated user:', userError)
        throw new Error('No authenticated user found')
    }
    console.log('👤 Got authenticated user:', user.id)

    const channel = supabase.channel(`session:${pairingCode}`, {
        config: {
            presence: {
                key: pairingCode,
            },
        },
    })
    console.log('📡 Channel created with ID:', `session:${pairingCode}`)

    // Initialize cleanup state
    cleanupStates.set(channel, false)

    if (onVideoProcessing) {
        console.log('🎥 Setting up video processing handler')
        channel.on(
            'broadcast',
            { event: 'video_processing' },
            ({ payload }) => {
                console.log('📼 Received video processing signal:', payload)
                if (!payload || typeof payload !== 'object') {
                    console.error(
                        'Invalid video processing signal payload:',
                        payload,
                    )
                    return
                }
                onVideoProcessing(payload as VideoProcessingSignal)
            },
        )
    }

    // Wait for channel subscription and presence sync
    await new Promise<void>((resolve, reject) => {
        let presenceSynced = false
        let hasWebClient = false

        channel
            .on('presence', { event: 'sync' }, () => {
                console.log('👥 Presence synced')
                const state = channel.presenceState()
                console.log('👥 Current presence state:', state)

                // Check if web client is present
                hasWebClient = Object.values(state).some((presences: any) =>
                    presences.some((p: any) => p.client_type === 'web'),
                )
                if (hasWebClient) {
                    console.log('🌐 Web client detected')
                }
                presenceSynced = true
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('🟢 Presence join:', { key, newPresences })
                // Check if the new presence is a web client
                if (newPresences.some((p: any) => p.client_type === 'web')) {
                    hasWebClient = true
                    console.log('🌐 Web client joined')
                }
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('🔴 Presence leave:', { key, leftPresences })
            })
            .subscribe(async (status: ChannelStatus) => {
                console.log('📡 Channel status:', status)
                const isCleaningUp = cleanupStates.get(channel) || false

                if (status === 'SUBSCRIBED') {
                    try {
                        console.log('✅ Channel subscribed, tracking presence')
                        await channel.track({
                            online_at: new Date().toISOString(),
                            client_type: 'mobile',
                            session_code: pairingCode,
                            user_id: user.id,
                        })
                        console.log(
                            '👤 Presence tracked with user ID:',
                            user.id,
                        )
                        console.log(
                            '🔍 Current presence state:',
                            channel.presenceState(),
                        )

                        // Wait for presence sync and web client before resolving
                        while (!presenceSynced || !hasWebClient) {
                            await new Promise(r => setTimeout(r, 100))
                        }
                        console.log('🤝 Channel setup complete')
                        resolve()
                    } catch (error) {
                        console.error('❌ Error tracking presence:', error)
                        reject(error)
                    }
                } else if (
                    status === 'CHANNEL_ERROR' ||
                    status === 'TIMED_OUT'
                ) {
                    const error = new Error(
                        `Channel subscription failed: ${status}`,
                    )
                    console.error('❌ Channel error:', error)
                    reject(error)
                } else if (status === 'CLOSED' && !isCleaningUp) {
                    console.log('⚠️ Channel closed unexpectedly')
                    resolve()
                }
            })
    })

    return channel
}

export const cleanupChannel = async (
    supabase: SupabaseClient,
    channel: RealtimeChannel | null,
) => {
    if (channel) {
        try {
            console.log('🧹 Starting channel cleanup')
            // Mark channel as cleaning up
            cleanupStates.set(channel, true)

            // First untrack presence
            await channel.untrack()
            console.log('👋 Presence untracked')

            // Then unsubscribe
            await channel.unsubscribe()
            console.log('🔌 Channel unsubscribed')

            // Finally remove the channel
            await supabase.removeChannel(channel)
            console.log('✅ Channel cleanup complete')
        } catch (error) {
            console.log('⚠️ Non-critical error during channel cleanup:', error)
        }
    }
}
