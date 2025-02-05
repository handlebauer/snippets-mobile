import { cleanDatabase, supabase } from './base'

async function seedUsers() {
    const testUser = {
        email: 'asdf@asdf.com',
        password: 'asdf',
    }

    try {
        await cleanDatabase()

        // Create user with service role
        const { data: user, error: createError } =
            await supabase.auth.admin.createUser({
                email: testUser.email,
                password: testUser.password,
                email_confirm: true,
            })

        if (createError) throw createError

        // Create profile for user
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: user.user.id,
            username: 'testuser',
            updated_at: new Date().toISOString(),
        })

        if (profileError) throw profileError

        console.log('Test user created successfully:', user.user.id)
    } catch (error) {
        console.error('Error seeding test user:', error)
        process.exit(1)
    }
}

seedUsers()
