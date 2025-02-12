import Constants from 'expo-constants'

import { EditorEvent } from '@/types/recordings'

const API_URL = Constants.expoConfig?.extra?.apiUrl as string

if (!API_URL) {
    throw new Error('API_URL is not defined in app.config.js')
}

interface InsightSuggestion {
    title: string
    description: string
    priority: 'low' | 'medium' | 'high'
}

interface InsightComplexity {
    before: number
    after: number
    explanation: string
}

export interface CodeInsights {
    summary: string
    keyChanges: string[]
    complexity: InsightComplexity
    suggestions: InsightSuggestion[]
}

interface GenerateInsightsRequest {
    pairingCode: string
    data: {
        events: EditorEvent[]
        initialState: string
        finalContent: string
    }
}

export async function generateInsights({
    pairingCode,
    data,
}: GenerateInsightsRequest): Promise<CodeInsights> {
    try {
        const response = await fetch(`${API_URL}/api/editor/insights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pairingCode,
                data,
            }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Failed to generate insights')
        }

        return response.json()
    } catch (error) {
        console.error('Error generating insights:', error)
        throw error
    }
}
