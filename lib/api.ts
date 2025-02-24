import Constants from 'expo-constants'

import { EditorEvent } from '@/types/recordings'

import type { NarrationPayload } from '@/hooks/use-narration'

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

interface DeveloperStyle {
    timeDistribution: {
        thinkingTimePercent: number
        activeEditingPercent: number
        reviewingPercent: number
    }
    editingPatterns: string[]
    paceInsights: string
}

export interface CodeInsights {
    summary: string
    keyChanges: string[]
    complexity: InsightComplexity
    suggestions: InsightSuggestion[]
    developerStyle: DeveloperStyle
}

interface GenerateInsightsRequest {
    pairingCode: string
    data: {
        events: EditorEvent[]
        initialState: string
        finalContent: string
    }
}

interface NarrationResponse {
    narration: string
    confidence: number
    metadata?: {
        tone: 'neutral' | 'technical' | 'educational'
        complexity: 'simple' | 'moderate' | 'complex'
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

export async function generateNarration(
    payload: NarrationPayload,
): Promise<NarrationResponse> {
    try {
        console.log('📤 [api] Sending narration request:', {
            hasLastNarration: 'lastNarration' in payload,
            lastNarrationLength: payload.lastNarration?.length,
            eventCount: payload.eventGroup.events.length,
        })

        const response = await fetch(`${API_URL}/api/editor/narrate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Failed to generate narration')
        }

        const data = await response.json()
        console.log('📥 [api] Received narration response:', {
            confidence: data.confidence,
            narrationLength: data.narration.length,
            tone: data.metadata?.tone,
        })

        return data
    } catch (error) {
        console.error('Error generating narration:', error)
        throw error
    }
}
