import { useRef, useState, useCallback, useEffect } from 'react'

interface UseWhisperOptions {
  model?: string
  onTranscriptionComplete?: (text: string, context?: string) => void
  onError?: (error: Error) => void
}

interface UseWhisperReturn {
  isRecording: boolean
  isTranscribing: boolean
  isModelLoading: boolean
  modelLoadProgress: number
  transcript: string
  error: string | null
  startRecording: (context?: string) => Promise<void>
  stopRecording: () => Promise<void>
}

export function useWhisper(options: UseWhisperOptions = {}): UseWhisperReturn {
  const {
    model = 'Xenova/whisper-tiny.en',
    onTranscriptionComplete,
    onError
  } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(false)
  const [modelLoadProgress, setModelLoadProgress] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const transcriber = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const recordingContextRef = useRef<string | undefined>(undefined)

  const initializeTranscriber = useCallback(async () => {
    if (transcriber.current) return transcriber.current

    try {
      setIsModelLoading(true)
      setModelLoadProgress(0)
      setError(null)

      console.log('Loading Whisper model...')

      // Dynamically import to avoid SSR issues
      const { pipeline } = await import('@xenova/transformers')

      transcriber.current = await pipeline(
        'automatic-speech-recognition',
        model,
        {
          progress_callback: (progress: any) => {
            console.log('Model loading progress:', progress)
            if (progress.status === 'progress' && progress.total) {
              const percentage = Math.round((progress.loaded / progress.total) * 100)
              setModelLoadProgress(percentage)
            } else if (progress.status === 'ready') {
              setModelLoadProgress(100)
            }
          }
        }
      )

      console.log('Model loaded successfully')
      setIsModelLoading(false)
      setModelLoadProgress(100)
      return transcriber.current
    } catch (err) {
      console.error('Error loading model:', err)
      const error = err instanceof Error ? err : new Error('Failed to load model')
      setError(error.message)
      setIsModelLoading(false)
      if (onError) onError(error)
      throw error
    }
  }, [model, onError])

  // Convert audio blob to format Whisper can process
  const convertAudioBlob = useCallback(async (audioBlob: Blob): Promise<Float32Array> => {
    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 })
      }

      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)

      // Convert to mono and resample to 16kHz
      let audioData = audioBuffer.getChannelData(0)

      // If sample rate is not 16kHz, we need to resample
      if (audioBuffer.sampleRate !== 16000) {
        const ratio = audioBuffer.sampleRate / 16000
        const newLength = Math.round(audioData.length / ratio)
        const result = new Float32Array(newLength)

        for (let i = 0; i < newLength; i++) {
          const index = Math.floor(i * ratio)
          result[i] = audioData[index]
        }
        audioData = result
      }

      return audioData
    } catch (err) {
      console.error('Error converting audio:', err)
      throw new Error('Failed to convert audio format')
    }
  }, [])

  const startRecording = useCallback(async (context?: string) => {
    try {
      console.log('Starting recording with context:', context)
      recordingContextRef.current = context
      setError(null)
      setTranscript('')
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000
        }
      })
      console.log('Got media stream')

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk received:', event.data.size, 'bytes')
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...')
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('Audio blob created:', audioBlob.size, 'bytes')

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Transcribe the audio
        try {
          setIsTranscribing(true)
          setError(null)

          console.log('Initializing transcriber...')
          const transcriber = await initializeTranscriber()

          console.log('Converting audio...')
          const audioData = await convertAudioBlob(audioBlob)
          console.log('Audio converted:', audioData.length, 'samples')

          console.log('Transcribing...')
          const result = await transcriber(audioData)
          console.log('Transcription result:', result)

          const text = result.text.trim()
          console.log('Transcribed text:', text)

          setTranscript(text)
          setIsTranscribing(false)

          if (onTranscriptionComplete && text) {
            const context = recordingContextRef.current
            console.log('Calling onTranscriptionComplete with context:', context)
            onTranscriptionComplete(text, context)
            recordingContextRef.current = undefined // Clear after use
          }
        } catch (err) {
          console.error('Transcription error:', err)
          const error = err instanceof Error ? err : new Error('Transcription failed')
          setError(error.message)
          setIsTranscribing(false)
          if (onError) onError(error)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setError('Recording failed')
      }

      mediaRecorder.start()
      setIsRecording(true)
      console.log('Recording started')
    } catch (err) {
      console.error('Start recording error:', err)
      const error = err instanceof Error ? err : new Error('Failed to start recording')
      setError(error.message)
      if (onError) onError(error)
    }
  }, [initializeTranscriber, convertAudioBlob, onTranscriptionComplete, onError])

  const stopRecording = useCallback(async () => {
    console.log('Stopping recording...')
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      console.log('Recording stop requested')
    }
  }, [isRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return {
    isRecording,
    isTranscribing,
    isModelLoading,
    modelLoadProgress,
    transcript,
    error,
    startRecording,
    stopRecording
  }
}
