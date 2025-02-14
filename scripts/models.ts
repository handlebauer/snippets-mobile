#!/usr/bin/env bun
import { $ } from 'bun'

async function downloadTTSModels() {
    try {
        // Create models directory if it doesn't exist
        await $`mkdir -p assets/models`

        // Change to models directory
        process.chdir('assets/models')

        // Download the quantized model
        console.log('Downloading kokoro model...')
        await $`wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.int8.onnx -O kokoro.onnx`

        // Download the voices file
        console.log('Downloading voices...')
        await $`wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin -O voices.bin`

        // Change back to original directory
        process.chdir('../..')

        console.log('Download completed successfully!')
    } catch (error) {
        console.error('Error downloading TTS models:', error)
        process.exit(1)
    }
}

// Run the download function
await downloadTTSModels()
