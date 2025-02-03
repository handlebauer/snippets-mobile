import { cleanDatabase } from './base'

async function runAllSeeds() {
    try {
        await cleanDatabase()

        // Import and run all seed files here
        await import('./users')

        console.log('All seeds completed successfully')
    } catch (error) {
        console.error('Error running seeds:', error)
        process.exit(1)
    }
}

runAllSeeds()
