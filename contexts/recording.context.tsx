import React from 'react'

interface StreamContextType {
    isStreaming: boolean
    setIsStreaming: (isStreaming: boolean) => void
}

export const StreamContext = React.createContext<StreamContextType>({
    isStreaming: false,
    setIsStreaming: () => {},
})

export function StreamProvider({ children }: { children: React.ReactNode }) {
    const [isStreaming, setIsStreaming] = React.useState(false)

    return (
        <StreamContext.Provider value={{ isStreaming, setIsStreaming }}>
            {children}
        </StreamContext.Provider>
    )
}

export function useStream() {
    return React.useContext(StreamContext)
}
