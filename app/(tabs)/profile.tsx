import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Surface } from 'react-native-paper'

import Account from '@/components/account'
import { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase.client'

export default function ProfileScreen() {
    const [session, setSession] = useState<Session | null>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })
    }, [])

    if (!session) return null

    return (
        <Surface style={styles.container}>
            <Account session={session} />
        </Surface>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 12,
    },
})
