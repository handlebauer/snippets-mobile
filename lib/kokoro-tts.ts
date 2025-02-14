// @ts-nocheck

import { Asset } from 'expo-asset'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'

// import npyjs from 'npyjs'
// import { InferenceSession, Tensor } from 'onnxruntime-react-native'

const SAMPLE_RATE = 24000
const MAX_PHONEME_LENGTH = 510

// Language codes based on Kokoro documentation
const LANGUAGE_CODES = {
    'en-us': 'a', // American English
    'en-gb': 'b', // British English
} as const

// Voice IDs with their traits and quality grades
interface VoiceInfo {
    id: string
    name: string
    language: keyof typeof LANGUAGE_CODES
    gender?: 'male' | 'female'
    age?: number
    quality?: 'high' | 'medium' | 'low'
}

const VOICE_INFO: VoiceInfo[] = [
    {
        id: 'am_liam',
        name: 'Liam',
        language: 'en-us',
        gender: 'male',
        quality: 'high',
    },
]

interface Voice {
    embedding: Float32Array
    info: VoiceInfo
}

interface VoiceLoadOptions {
    voicePath?: string
    customVoices?: { [key: string]: Float32Array }
}

interface TextNormalizationPattern {
    pattern: RegExp
    replace: string | ((substring: string, ...args: any[]) => string)
}

// Text normalization patterns
const TEXT_NORMALIZATION_PATTERNS: TextNormalizationPattern[] = [
    { pattern: /D[Rr]\.(?= [A-Z])/, replace: 'Doctor' },
    { pattern: /\b(?:Mr\.|MR\.(?= [A-Z]))/, replace: 'Mister' },
    { pattern: /\b(?:Ms\.|MS\.(?= [A-Z]))/, replace: 'Miss' },
    { pattern: /\b(?:Mrs\.|MRS\.(?= [A-Z]))/, replace: 'Mrs' },
    { pattern: /\betc\.(?! [A-Z])/, replace: 'etc' },
    { pattern: /\b(y)eah?\b/gi, replace: "$1e'a" },
    {
        pattern: /\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/,
        replace: (match: string) => {
            if (match.includes('.')) {
                return match
            } else if (match.includes(':')) {
                let [h, m] = match.split(':').map(Number)
                if (m === 0) {
                    return `${h} o'clock`
                } else if (m < 10) {
                    return `${h} oh ${m}`
                }
                return `${h} ${m}`
            }
            let year = parseInt(match.slice(0, 4), 10)
            if (year < 1100 || year % 1000 < 10) {
                return match
            }
            let left = match.slice(0, 2)
            let right = parseInt(match.slice(2, 4), 10)
            let suffix = match.endsWith('s') ? 's' : ''
            if (year % 1000 >= 100 && year % 1000 <= 999) {
                if (right === 0) {
                    return `${left} hundred${suffix}`
                } else if (right < 10) {
                    return `${left} oh ${right}${suffix}`
                }
            }
            return `${left} ${right}${suffix}`
        },
    },
    { pattern: /(?<=\d),(?=\d)/, replace: '' },
    {
        pattern:
            /[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi,
        replace: (match: string) => {
            const bill = match[0] === '$' ? 'dollar' : 'pound'
            if (isNaN(Number(match.slice(1)))) {
                return `${match.slice(1)} ${bill}s`
            } else if (!match.includes('.')) {
                let suffix = match.slice(1) === '1' ? '' : 's'
                return `${match.slice(1)} ${bill}${suffix}`
            }
            const [b, c] = match.slice(1).split('.')
            const d = parseInt(c.padEnd(2, '0'), 10)
            let coins =
                match[0] === '$'
                    ? d === 1
                        ? 'cent'
                        : 'cents'
                    : d === 1
                      ? 'penny'
                      : 'pence'
            return `${b} ${bill}${b === '1' ? '' : 's'} and ${d} ${coins}`
        },
    },
    {
        pattern: /\d*\.\d+/,
        replace: (match: string) => {
            let [a, b] = match.split('.')
            return `${a} point ${b.split('').join(' ')}`
        },
    },
    { pattern: /(?<=\d)-(?=\d)/, replace: ' to ' },
    { pattern: /(?<=\d)S/, replace: ' S' },
    { pattern: /(?<=[BCDFGHJ-NP-TV-Z])'?s\b/, replace: "'S" },
    { pattern: /(?<=X')S\b/, replace: 's' },
    {
        pattern: /(?:[A-Za-z]\.){2,} [a-z]/,
        replace: (m: string) => m.replace(/\./g, '-'),
    },
    { pattern: /(?<=[A-Z])\.(?=[A-Z])/gi, replace: '-' },
]

interface PhonemeMap {
    [key: string]: number
}

// Enhanced phoneme mapping
const PHONEME_MAP: PhonemeMap = {
    ' ': 1,
    '.': 2,
    '!': 3,
    '?': 4,
    ',': 5,
    a: 6,
    e: 7,
    i: 8,
    o: 9,
    u: 10,
    æ: 11,
    ə: 12,
    ɪ: 13,
    ʊ: 14,
    ɛ: 15,
    ɔ: 16,
    ɑ: 17,
    ʌ: 18,
    ɝ: 19,
    ɚ: 20,
    // Add more phonemes as needed
}

interface SynthesisOptions {
    speed?: number
    trim?: boolean
    isStreaming?: boolean
}

// Voice asset mapping
const VOICE_ASSETS = {
    am_liam: require('../assets/models/voices/am_liam.npy'),
} as const

export class KokoroTTS {
    private session: InferenceSession | null = null
    private voices: Map<string, Voice> = new Map()
    private initialized: boolean = false
    private g2pCache: Map<string, number[]> = new Map()
    private voiceLoadOptions?: VoiceLoadOptions

    constructor(options?: VoiceLoadOptions) {
        this.voiceLoadOptions = options
    }

    async initialize() {
        if (this.initialized) return

        try {
            // Load ONNX model
            const modelAsset = Asset.fromModule(
                require('../assets/models/kokoro.onnx'),
            )
            await modelAsset.downloadAsync()
            console.log('Model asset downloaded:', modelAsset.localUri)

            // Create inference session with more detailed logging
            try {
                // Get the model file as a binary array
                const modelData = await FileSystem.readAsStringAsync(
                    modelAsset.localUri!,
                    {
                        encoding: FileSystem.EncodingType.Base64,
                    },
                )

                // Convert base64 to Uint8Array
                const binaryString = atob(modelData)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                }

                this.session = await InferenceSession.create(bytes)

                // Validate model inputs
                const inputNames = this.session.inputNames
                const outputNames = this.session.outputNames
                console.log('Model info:', {
                    inputs: inputNames,
                    outputs: outputNames,
                    modelSize: bytes.length,
                })

                console.log('Input names:', inputNames)
                console.log('Output names:', outputNames)

                console.log(
                    'Inference session created and validated successfully',
                )
            } catch (sessionError) {
                console.error('Failed to create inference session:', {
                    error: sessionError,
                    modelExists: !!modelAsset.localUri,
                    modelPath: modelAsset.localUri,
                })
                throw sessionError
            }

            // Load default voices
            await this.loadDefaultVoices()

            // Load custom voices if provided
            if (this.voiceLoadOptions?.customVoices) {
                for (const [id, embedding] of Object.entries(
                    this.voiceLoadOptions.customVoices,
                )) {
                    const info = VOICE_INFO.find(v => v.id === id)
                    if (info) {
                        this.voices.set(id, { embedding, info })
                    }
                }
            }

            this.initialized = true
            console.log('TTS initialization completed successfully')
        } catch (error) {
            console.error('Failed to initialize Kokoro:', error)
            throw error
        }
    }

    private async loadDefaultVoices() {
        for (const info of VOICE_INFO) {
            try {
                const voiceAsset = Asset.fromModule(
                    VOICE_ASSETS[info.id as keyof typeof VOICE_ASSETS],
                )
                await voiceAsset.downloadAsync()

                const n = new npyjs()
                const array = await n.load(voiceAsset.localUri!)

                const voice: Voice = {
                    embedding: array.data as Float32Array,
                    info,
                }
                this.voices.set(info.id, voice)
            } catch (error) {
                console.warn(`Failed to load voice ${info.id}:`, error)
            }
        }
    }

    getAvailableVoices(): VoiceInfo[] {
        return Array.from(this.voices.values()).map(v => v.info)
    }

    getVoicesByLanguage(language: keyof typeof LANGUAGE_CODES): VoiceInfo[] {
        return this.getAvailableVoices().filter(v => v.language === language)
    }

    private normalizeText(text: string): string {
        // Remove leading/trailing whitespace and empty lines
        text = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n')

        // Apply normalization patterns
        for (const { pattern, replace } of TEXT_NORMALIZATION_PATTERNS) {
            if (typeof replace === 'string') {
                text = text.replace(pattern, replace)
            } else {
                text = text.replace(pattern, replace)
            }
        }

        // Replace multiple spaces with single space
        text = text.replace(/\s+/g, ' ')

        // Replace curly quotes with straight quotes
        text = text
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')

        // Handle punctuation
        text = text
            .replace(/[;:,.!?¡¿—…"«»""(){}[\]]/g, match => ` ${match} `)
            .replace(/\s+/g, ' ')

        return text.trim()
    }

    private textToPhonemes(
        text: string,
        language: keyof typeof LANGUAGE_CODES,
    ): number[] {
        const cacheKey = `${language}:${text}`
        if (this.g2pCache.has(cacheKey)) {
            return this.g2pCache.get(cacheKey)!
        }

        // Normalize text first
        text = this.normalizeText(text)

        // Convert to phonemes based on language
        let phonemes: number[]
        switch (language) {
            case 'en-us':
            case 'en-gb': {
                // Split into words and handle each word
                const words = text.toLowerCase().split(/\s+/)
                phonemes = []

                for (const word of words) {
                    // Handle numbers and special cases
                    if (/^\d+$/.test(word)) {
                        // Convert numbers to words
                        const numPhonemes = this.numberToPhonemes(word)
                        phonemes.push(...numPhonemes)
                    } else {
                        // Basic word-to-phoneme conversion
                        for (const char of word) {
                            const phoneme =
                                PHONEME_MAP[char] || PHONEME_MAP['ə']
                            if (phoneme) {
                                phonemes.push(phoneme)
                            }
                        }
                    }

                    // Add space between words
                    if (word !== words[words.length - 1]) {
                        phonemes.push(PHONEME_MAP[' '])
                    }
                }
                break
            }
            default:
                phonemes = this.defaultToPhonemes(text)
        }

        // Add start/end tokens and cache
        phonemes = [0, ...phonemes, 0]
        this.g2pCache.set(cacheKey, phonemes)
        return phonemes
    }

    private numberToPhonemes(num: string): number[] {
        // Convert number to words and then to phonemes
        const words = this.numberToWords(num)
        const phonemes: number[] = []

        for (const word of words.toLowerCase().split(/\s+/)) {
            for (const char of word) {
                const phoneme = PHONEME_MAP[char] || PHONEME_MAP['ə']
                if (phoneme) {
                    phonemes.push(phoneme)
                }
            }
            phonemes.push(PHONEME_MAP[' '])
        }

        return phonemes
    }

    private numberToWords(num: string): string {
        const n = parseInt(num)
        if (isNaN(n)) return num

        const units = [
            '',
            'one',
            'two',
            'three',
            'four',
            'five',
            'six',
            'seven',
            'eight',
            'nine',
        ]
        const teens = [
            'ten',
            'eleven',
            'twelve',
            'thirteen',
            'fourteen',
            'fifteen',
            'sixteen',
            'seventeen',
            'eighteen',
            'nineteen',
        ]
        const tens = [
            '',
            '',
            'twenty',
            'thirty',
            'forty',
            'fifty',
            'sixty',
            'seventy',
            'eighty',
            'ninety',
        ]

        if (n < 10) return units[n]
        if (n < 20) return teens[n - 10]
        if (n < 100) {
            const unit = units[n % 10]
            return tens[Math.floor(n / 10)] + (unit ? '-' + unit : '')
        }
        if (n < 1000) {
            const rest = n % 100
            return (
                units[Math.floor(n / 100)] +
                ' hundred' +
                (rest ? ' and ' + this.numberToWords(rest.toString()) : '')
            )
        }
        return num // For larger numbers, just return the original
    }

    private defaultToPhonemes(text: string): number[] {
        // Fallback for unsupported languages
        return text.split('').map(char => this.charToPhonemeId(char))
    }

    private charToPhonemeId(char: string): number {
        // This should be expanded with a proper phoneme mapping
        const basicMap: { [key: string]: number } = {
            ' ': 1,
            '.': 2,
            '!': 3,
            '?': 4,
            ',': 5,
            a: 6,
            e: 7,
            i: 8,
            o: 9,
            u: 10,
            // Add more mappings as needed
        }
        return basicMap[char] || 0 // Return padding token for unknown characters
    }

    private createTensor(
        data: number[] | Float32Array,
        dims: number[],
    ): Tensor {
        return new Tensor(
            'float32',
            data instanceof Float32Array ? data : Float32Array.from(data),
            dims,
        )
    }

    private splitPhonemes(phonemes: string): string[] {
        // Split phonemes into batches based on punctuation
        const batches: string[] = []
        let currentBatch = ''

        const words = phonemes.split(/([.,!?;])/)
        for (const part of words) {
            const trimmedPart = part.trim()
            if (!trimmedPart) continue

            if (
                currentBatch.length + trimmedPart.length + 1 >=
                MAX_PHONEME_LENGTH
            ) {
                batches.push(currentBatch.trim())
                currentBatch = trimmedPart
            } else {
                if (/[.,!?;]/.test(trimmedPart)) {
                    currentBatch += trimmedPart
                } else {
                    if (currentBatch) currentBatch += ' '
                    currentBatch += trimmedPart
                }
            }
        }

        if (currentBatch) {
            batches.push(currentBatch.trim())
        }

        return batches
    }

    async synthesize(
        text: string,
        voiceId: string = 'am_liam',
        options: SynthesisOptions = {},
    ): Promise<Audio.Sound> {
        const { speed = 1.0, trim = true } = options

        if (!this.initialized || !this.session) {
            throw new Error('TTS not initialized')
        }

        const voice = this.voices.get(voiceId)
        if (!voice) {
            throw new Error(`Voice ${voiceId} not found`)
        }

        try {
            // Convert text to phoneme IDs
            const phonemes = this.textToPhonemes(text, voice.info.language)
            const audio = await this.generateAudio(
                phonemes,
                voice.embedding,
                speed,
                trim,
            )

            // Convert to WAV and create sound
            const wavBuffer = this.float32ToWav(audio)
            const audioPath = `${FileSystem.cacheDirectory}/output.wav`

            // Convert ArrayBuffer to base64
            const bytes = new Uint8Array(wavBuffer)
            let binary = ''
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i])
            }
            const base64 = btoa(binary)

            await FileSystem.writeAsStringAsync(audioPath, base64, {
                encoding: FileSystem.EncodingType.Base64,
            })

            const sound = new Audio.Sound()
            await sound.loadAsync({ uri: audioPath })
            return sound
        } catch (error) {
            console.error('Synthesis failed:', error)
            throw error
        }
    }

    async *synthesizeStream(
        text: string,
        voiceId: string = 'am_liam',
        options: SynthesisOptions = {},
    ): AsyncGenerator<Audio.Sound, void, unknown> {
        const { speed = 1.0, trim = true } = options

        if (!this.initialized || !this.session) {
            throw new Error('TTS not initialized')
        }

        const voice = this.voices.get(voiceId)
        if (!voice) {
            throw new Error(`Voice ${voiceId} not found`)
        }

        try {
            // Convert text to phonemes and split into batches
            const phonemes = this.textToPhonemes(text, voice.info.language)
            const batches = this.splitPhonemes(String.fromCharCode(...phonemes))

            for (const batch of batches) {
                const batchPhonemes = this.textToPhonemes(
                    batch,
                    voice.info.language,
                )
                const audio = await this.generateAudio(
                    batchPhonemes,
                    voice.embedding,
                    speed,
                    trim,
                )

                // Convert to WAV and create sound
                const wavBuffer = this.float32ToWav(audio)
                const audioPath = `${FileSystem.cacheDirectory}/output_${Date.now()}.wav`

                // Convert ArrayBuffer to base64
                const bytes = new Uint8Array(wavBuffer)
                let binary = ''
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i])
                }
                const base64 = btoa(binary)

                await FileSystem.writeAsStringAsync(audioPath, base64, {
                    encoding: FileSystem.EncodingType.Base64,
                })

                const sound = new Audio.Sound()
                await sound.loadAsync({ uri: audioPath })
                yield sound

                // Clean up temporary file
                await FileSystem.deleteAsync(audioPath, { idempotent: true })
            }
        } catch (error) {
            console.error('Stream synthesis failed:', error)
            throw error
        }
    }

    private async generateAudio(
        phonemes: number[],
        voiceEmbedding: Float32Array,
        speed: number,
        trim: boolean,
    ): Promise<Float32Array> {
        if (phonemes.length > MAX_PHONEME_LENGTH) {
            throw new Error('Text too long')
        }

        try {
            // Add start and end tokens (0) if not already present
            if (phonemes[0] !== 0) {
                phonemes = [0, ...phonemes, 0]
            }

            // Create input tensors matching Python implementation
            const inputTensor = this.createTensor(Float32Array.from(phonemes), [
                1,
                phonemes.length,
            ])

            // Create style tensor with shape [len(tokens), embedding_size]
            // In Python: voice = voice[len(tokens)]
            const embeddingSize = 3036 // Fixed size based on model requirements
            const styleData = new Float32Array(phonemes.length * embeddingSize)

            // Copy the voice embedding data for each phoneme position
            for (let i = 0; i < phonemes.length; i++) {
                const sourceStart = i * embeddingSize
                const sourceEnd = sourceStart + embeddingSize
                const targetStart = i * embeddingSize
                styleData.set(
                    voiceEmbedding.slice(sourceStart, sourceEnd),
                    targetStart,
                )
            }

            const styleTensor = this.createTensor(styleData, [
                phonemes.length,
                embeddingSize,
            ])

            const speedTensor = this.createTensor(Float32Array.from([speed]), [
                1,
            ])

            // Log tensor shapes for debugging
            console.log('Running inference with tensor shapes:', {
                tokens: inputTensor.dims,
                style: styleTensor.dims,
                speed: speedTensor.dims,
            })
            console.log('Voice embedding total size:', voiceEmbedding.length)
            console.log('Style tensor total size:', styleData.length)

            // Run inference
            const feeds = {
                tokens: inputTensor,
                style: styleTensor,
                speed: speedTensor,
            }

            if (!this.session) {
                throw new Error('Session is null')
            }

            const output = await this.session.run(feeds)
            console.log('Inference completed')

            let audioData = output['audio'].data as Float32Array

            if (trim) {
                audioData = this.trimAudio(audioData)
            }

            return audioData
        } catch (error) {
            console.error('Generate audio failed:', error)
            console.error('Error details:', {
                phonemesLength: phonemes.length,
                embeddingLength: voiceEmbedding.length,
                speed,
                sessionExists: !!this.session,
            })
            throw error
        }
    }

    private trimAudio(audio: Float32Array): Float32Array {
        // Simple implementation of silence trimming
        const threshold = 0.01
        let start = 0
        let end = audio.length - 1

        // Find start (first non-silent sample)
        while (start < audio.length && Math.abs(audio[start]) < threshold) {
            start++
        }

        // Find end (last non-silent sample)
        while (end > start && Math.abs(audio[end]) < threshold) {
            end--
        }

        return audio.slice(start, end + 1)
    }

    private float32ToWav(float32Data: Float32Array): ArrayBuffer {
        // Convert Float32Array to 16-bit PCM WAV
        const numSamples = float32Data.length
        const bytesPerSample = 2
        const numChannels = 1

        const wavHeader = new ArrayBuffer(44)
        const view = new DataView(wavHeader)

        // WAV header
        view.setUint32(0, 0x52494646, false) // "RIFF"
        view.setUint32(4, 36 + numSamples * bytesPerSample, true) // File size
        view.setUint32(8, 0x57415645, false) // "WAVE"
        view.setUint32(12, 0x666d7420, false) // "fmt "
        view.setUint32(16, 16, true) // Format chunk size
        view.setUint16(20, 1, true) // Audio format (PCM)
        view.setUint16(22, numChannels, true) // Number of channels
        view.setUint32(24, SAMPLE_RATE, true) // Sample rate
        view.setUint32(28, SAMPLE_RATE * numChannels * bytesPerSample, true) // Byte rate
        view.setUint16(32, numChannels * bytesPerSample, true) // Block align
        view.setUint16(34, 16, true) // Bits per sample
        view.setUint32(36, 0x64617461, false) // "data"
        view.setUint32(40, numSamples * bytesPerSample, true) // Data size

        // Convert audio data to 16-bit PCM
        const audioBuffer = new ArrayBuffer(numSamples * bytesPerSample)
        const audioView = new DataView(audioBuffer)

        for (let i = 0; i < numSamples; i++) {
            const sample = Math.max(-1, Math.min(1, float32Data[i])) // Clamp
            const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff
            audioView.setInt16(i * bytesPerSample, pcm, true)
        }

        // Combine header and audio data
        const combined = new Uint8Array(
            wavHeader.byteLength + audioBuffer.byteLength,
        )
        combined.set(new Uint8Array(wavHeader), 0)
        combined.set(new Uint8Array(audioBuffer), wavHeader.byteLength)

        return combined.buffer
    }
}
