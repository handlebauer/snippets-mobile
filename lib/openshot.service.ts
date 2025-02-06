import Constants from 'expo-constants'

import { encode as base64Encode } from 'base-64'

const OPENSHOT_BASE_URL = Constants.expoConfig?.extra?.openshotBaseUrl as string
const OPENSHOT_ACCESS_KEY = Constants.expoConfig?.extra
    ?.openshotAccessKey as string

if (!OPENSHOT_BASE_URL) {
    throw new Error('OpenShot base URL is not configured')
}

if (!OPENSHOT_ACCESS_KEY) {
    throw new Error('OpenShot access key is not configured')
}

interface OpenshotProject {
    url: string
    id: number
    name: string
    width: number
    height: number
    fps_num: number
    fps_den: number
    sample_rate: number
    channels: number
    channel_layout: number
    video_format: string
    video_codec: string
    video_bitrate: number
    audio_codec: string
    audio_bitrate: number
    files: string[]
    clips: string[]
    effects: string[]
    json: string
}

interface OpenshotFile {
    url: string
    id: number
    media: string | null
    project: string
    json: {
        url: string
        bucket?: string
        container?: string
        acl?: string
        public?: string
    }
}

interface OpenshotClip {
    url: string
    id: number
    position: number
    start: number
    end: number
    layer: number
    project: string
    file: string
    show_audio: boolean
    show_video: boolean
    scale: number
    rotation: number
    location_x: number
    location_y: number
    alpha: number
    time: number
    volume: number
    json: string
    effects: string[]
}

interface OpenshotExport {
    url: string
    id: number
    export_type: 'video' | 'audio' | 'image' | 'waveform'
    video_format: string
    video_codec: string
    video_bitrate: number
    audio_codec: string
    audio_bitrate: number
    start_frame: number
    end_frame: number
    project: string
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancel'
    output: string
    webhook: string
    json: string
    progress: number
    error?: string
}

// Error response type
interface OpenshotError {
    detail: string
}

// Response type for paginated results
interface OpenshotPaginatedResponse<T> {
    count: number
    next: string | null
    previous: string | null
    results: T[]
}

class OpenshotService {
    private static instance: OpenshotService
    private authHeader: string

    private constructor() {
        // Base64 encode the access key with empty username
        this.authHeader = `Basic ${base64Encode(`:${OPENSHOT_ACCESS_KEY}`)}`
    }

    public static getInstance(): OpenshotService {
        if (!OpenshotService.instance) {
            OpenshotService.instance = new OpenshotService()
        }
        return OpenshotService.instance
    }

    private async request<T>(
        endpoint: string,
        method: 'GET' | 'POST' = 'GET',
        body?: object,
    ): Promise<T> {
        const response = await fetch(`${OPENSHOT_BASE_URL}${endpoint}`, {
            method,
            headers: {
                Authorization: this.authHeader,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        })

        const data = await response.json()

        if (!response.ok) {
            const error = data as OpenshotError
            throw new Error(
                error.detail || `OpenShot API error: ${response.statusText}`,
            )
        }

        return data as T
    }

    async listProjects(): Promise<OpenshotPaginatedResponse<OpenshotProject>> {
        return this.request<OpenshotPaginatedResponse<OpenshotProject>>(
            '/projects/',
        )
    }

    async createProject(name: string): Promise<OpenshotProject> {
        return this.request<OpenshotProject>('/projects/', 'POST', {
            name,
            width: 1920,
            height: 1080,
            fps_num: 30,
            fps_den: 1,
            sample_rate: 44100,
            channels: 2,
            json: {},
        })
    }

    async uploadFile(
        projectUrl: string,
        videoUrl: string,
    ): Promise<OpenshotFile> {
        return this.request<OpenshotFile>('/files/', 'POST', {
            media: null,
            project: projectUrl,
            json: {
                url: videoUrl,
            },
        })
    }

    async createClip(
        fileUrl: string,
        projectUrl: string,
        start: number,
        end: number,
    ): Promise<OpenshotClip> {
        return this.request<OpenshotClip>('/clips/', 'POST', {
            file: fileUrl,
            position: 0,
            start,
            end,
            layer: 1,
            project: projectUrl,
            json: {},
        })
    }

    async exportVideo(projectUrl: string): Promise<OpenshotExport> {
        return this.request<OpenshotExport>('/exports/', 'POST', {
            export_type: 'video',
            video_format: 'mp4',
            video_codec: 'libx264',
            video_bitrate: 8000000,
            audio_codec: 'aac',
            audio_bitrate: 1920000,
            start_frame: 1,
            end_frame: 0,
            project: projectUrl,
            webhook: '',
            json: {},
            status: 'pending',
        })
    }

    async checkExportStatus(exportUrl: string): Promise<OpenshotExport> {
        return this.request<OpenshotExport>(exportUrl)
    }

    async trimVideo(
        videoUrl: string,
        startTime: number,
        endTime: number,
    ): Promise<{ exportId: string }> {
        // Create a new project
        const project = await this.createProject(`Trim_${Date.now()}`)

        // Upload the video file
        const file = await this.uploadFile(project.url, videoUrl)

        // Create a clip with the specified start and end times
        await this.createClip(file.url, project.url, startTime, endTime)

        // Export the project
        const exportResult = await this.exportVideo(project.url)

        return { exportId: exportResult.id.toString() }
    }
}

export const openshotService = OpenshotService.getInstance()
