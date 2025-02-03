import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role configuration')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function cleanDatabase() {
    try {
        // First get all users
        const { data: users, error: listError } =
            await supabase.auth.admin.listUsers()
        if (listError) throw listError

        // Delete each user
        for (const user of users.users) {
            const { error: deleteError } = await supabase.auth.admin.deleteUser(
                user.id,
            )
            if (deleteError) throw deleteError
        }
    } catch (error) {
        console.error('Error cleaning database:', error)
        process.exit(1)
    }
}
