import { useEffect, useState } from 'react'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase'
import { createClient } from '@supabase/supabase-js'

export const useSupabase = () => {
    const [supabase] = useState(() =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
    )

    useEffect(() => {
        return () => {
            supabase.removeAllChannels()
        }
    }, [supabase])

    return { supabase }
}
