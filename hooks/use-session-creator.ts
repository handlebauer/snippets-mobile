import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

import { useSupabase } from '@/contexts/supabase.context'

import { supabase } from '@/lib/supabase.client'

interface SessionCreatorState {
    code: string | null
    isCreating: boolean
    error: string | null
}

export function useSessionCreator() {
    // Get current user
    const { user } = useSupabase()
    if (!user) throw new Error('No authenticated user')

    const [state, setState] = useState<SessionCreatorState>({
        code: null,
        isCreating: false,
        error: null,
    })

    const createSession = useCallback(
        async (code: string) => {
            setState(prev => ({ ...prev, isCreating: true, error: null }))

            try {
                // Insert into recording_sessions table
                const { error: insertError } = await supabase
                    .from('recording_sessions')
                    .insert({
                        user_id: user.id,
                        code,
                        created_at: new Date().toISOString(),
                    })

                if (insertError) throw insertError

                setState(prev => ({ ...prev, code, isCreating: false }))
                return true
            } catch (error) {
                console.error('❌ Error creating session:', error)
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : 'Failed to create session'
                setState(prev => ({
                    ...prev,
                    isCreating: false,
                    error: errorMessage,
                }))
                Alert.alert('Error', errorMessage)
                return null
            }
        },
        [user.id],
    )

    const resetState = useCallback(() => {
        setState({
            code: null,
            isCreating: false,
            error: null,
        })
    }, [])

    return {
        state,
        createSession,
        resetState,
    }
}
