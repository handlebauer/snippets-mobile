import { useLocalSearchParams, useRouter } from 'expo-router'

import { VideoEditView } from '@/components/video-edit-view'

export default function VideoEditorModal() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const router = useRouter()

    if (!id) {
        router.back()
        return null
    }

    return <VideoEditView videoId={id} onClose={() => router.back()} />
}
