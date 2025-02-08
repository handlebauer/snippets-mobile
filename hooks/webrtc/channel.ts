import { CHANNEL_CONFIG } from '@/constants/webrtc'

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
    if (!pairingCode) {
        throw new Error('Please enter a complete pairing code')
    }

    // Get the current user from the session
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        throw new Error('No authenticated user found')
    }

    const channel = supabase.channel(`webrtc:${pairingCode}`, {
        config: CHANNEL_CONFIG,
    })

    // Initialize cleanup state
    cleanupStates.set(channel, false)

    if (onVideoProcessing) {
        channel.on(
            'broadcast',
            { event: 'video_processing' },
            ({ payload }) => {
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

    try {
        // Wait for channel subscription and presence sync
        await new Promise<void>((resolve, reject) => {
            let presenceSynced = false
            channel
                .on('presence', { event: 'sync' }, () => {
                    presenceSynced = true
                })
                .subscribe(async (status: ChannelStatus) => {
                    const isCleaningUp = cleanupStates.get(channel) || false

                    if (status === 'SUBSCRIBED') {
                        try {
                            await channel.track({
                                online_at: new Date().toISOString(),
                                client_type: 'mobile',
                                session_code: pairingCode,
                                user_id: user.id, // Include the user ID in presence data
                            })

                            while (!presenceSynced) {
                                await new Promise(r => setTimeout(r, 100))
                            }
                            resolve()
                        } catch (error) {
                            console.error('Error tracking presence:', error)
                            reject(error)
                        }
                    } else if (
                        status === 'CHANNEL_ERROR' ||
                        status === 'TIMED_OUT'
                    ) {
                        // Only reject for actual errors, not normal cleanup
                        const error = new Error(
                            `Channel subscription failed: ${status}`,
                        )
                        console.error(error)
                        reject(error)
                    } else if (status === 'CLOSED' && !isCleaningUp) {
                        // Only log for unexpected closures
                        console.log('Channel closed unexpectedly')
                        resolve()
                    }
                })
        })

        return channel
    } catch (error) {
        if (error instanceof Error && error.message.includes('CLOSED')) {
            // If it's just a closure during cleanup, return the channel
            return channel
        }
        console.error('Error subscribing to channel:', error)
        throw error
    }
}

export const cleanupChannel = async (
    supabase: SupabaseClient,
    channel: RealtimeChannel | null,
) => {
    if (channel) {
        try {
            // Mark channel as cleaning up
            cleanupStates.set(channel, true)

            // First unsubscribe - don't await this as it might be already closed
            channel.unsubscribe().catch(err => {
                console.log('Channel already unsubscribed:', err.message)
            })

            // Then remove the channel - this should always work
            await supabase.removeChannel(channel)
        } catch (error) {
            // Just log the error, don't throw - cleanup should be best-effort
            console.log('Non-critical error during channel cleanup:', error)
        }
    }
}
