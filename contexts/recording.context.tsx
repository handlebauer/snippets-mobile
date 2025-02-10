import React from 'react'

interface StreamContextType {
    isStreaming: boolean
    setIsStreaming: (isStreaming: boolean) => void
    isEditing: boolean
    setIsEditing: (isEditing: boolean) => void
    isRecording: boolean
    setIsRecording: (isRecording: boolean) => void
    recordingStartTime: number | null
    setRecordingStartTime: (time: number | null) => void
    recordingDuration: string
}

export const StreamContext = React.createContext<StreamContextType>({
    isStreaming: false,
    setIsStreaming: () => {},
    isEditing: false,
    setIsEditing: () => {},
    isRecording: false,
    setIsRecording: () => {},
    recordingStartTime: null,
    setRecordingStartTime: () => {},
    recordingDuration: '00:00',
})

export function StreamProvider({ children }: { children: React.ReactNode }) {
    const [isStreaming, setIsStreaming] = React.useState(false)
    const [isEditing, setIsEditing] = React.useState(false)
    const [isRecording, setIsRecording] = React.useState(false)
    const [recordingStartTime, setRecordingStartTime] = React.useState<
        number | null
    >(null)
    const [recordingDuration, setRecordingDuration] = React.useState('00:00')

    // Update timer every second when recording
    React.useEffect(() => {
        if (!recordingStartTime) {
            setRecordingDuration('00:00')
            return
        }

        const interval = setInterval(() => {
            const now = Date.now()
            const diff = now - recordingStartTime
            const seconds = Math.floor(diff / 1000)
            const minutes = Math.floor(seconds / 60)
            const paddedSeconds = String(seconds % 60).padStart(2, '0')
            const paddedMinutes = String(minutes).padStart(2, '0')
            setRecordingDuration(`${paddedMinutes}:${paddedSeconds}`)
        }, 1000)

        return () => clearInterval(interval)
    }, [recordingStartTime])

    return (
        <StreamContext.Provider
            value={{
                isStreaming,
                setIsStreaming,
                isEditing,
                setIsEditing,
                isRecording,
                setIsRecording,
                recordingStartTime,
                setRecordingStartTime,
                recordingDuration,
            }}
        >
            {children}
        </StreamContext.Provider>
    )
}

export function useStream() {
    return React.useContext(StreamContext)
}
