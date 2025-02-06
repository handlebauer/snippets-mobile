import { useLocalSearchParams, useRouter } from 'expo-router'

import { VideoEditView } from '@/components/video-edit-view'

export default function VideoEditorModal() {
    const { videoId } = useLocalSearchParams<{ videoId: string }>()
    const router = useRouter()

    if (!videoId) {
        router.back()
        return null
    }

    return <VideoEditView videoId={videoId} onClose={() => router.back()} />
}
