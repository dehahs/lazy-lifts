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
  volume: number // 0-1 normalized volume level
  startRecording: (context?: string) => Promise<void>
  stopRecording: () => Promise<void>
  preloadModel: () => Promise<void>
}

export function useWhisper(options: UseWhisperOptions = {}): UseWhisperReturn {
  const {
    model = 'Xenova/whisper-base',
    onTranscriptionComplete,
    onError
  } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(false)
  const [modelLoadProgress, setModelLoadProgress] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [volume, setVolume] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const transcriber = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const recordingContextRef = useRef<string | undefined>(undefined)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isMonitoringRef = useRef<boolean>(false)
  const recordingStartTimeRef = useRef<number>(0)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const initializeTranscriber = useCallback(async (showProgress = true) => {
    if (transcriber.current) return transcriber.current

    try {
      console.log('Loading Whisper model...')

      // Track if we're actually downloading (vs loading from cache)
      let isDownloading = false
      let showUITimeoutId: NodeJS.Timeout | null = null
      const startTime = Date.now()

      // Only show UI if loading takes more than 1 second (indicates download, not cache)
      if (showProgress) {
        showUITimeoutId = setTimeout(() => {
          isDownloading = true
          setIsModelLoading(true)
          setModelLoadProgress(0)
          setError(null)
        }, 1000) // 1 second delay
      }

      // Dynamically import to avoid SSR issues
      const { pipeline } = await import('@xenova/transformers')

      transcriber.current = await pipeline(
        'automatic-speech-recognition',
        model,
        {
          progress_callback: (progress: any) => {
            console.log('Model loading progress:', progress)

            if (showProgress && isDownloading) {
              // Update progress bar if we're showing UI
              if (progress.status === 'progress' && progress.total) {
                const percentage = Math.round((progress.loaded / progress.total) * 100)
                setModelLoadProgress(percentage)
              } else if (progress.status === 'ready') {
                setModelLoadProgress(100)
              }
            }
          }
        }
      )

      // Clear timeout if model loaded quickly (from cache)
      if (showUITimeoutId) {
        clearTimeout(showUITimeoutId)
      }

      const loadTime = Date.now() - startTime
      console.log(`Model loaded in ${loadTime}ms`)

      if (showProgress && isDownloading) {
        setIsModelLoading(false)
        setModelLoadProgress(100)
      }
      return transcriber.current
    } catch (err) {
      console.error('Error loading model:', err)
      const error = err instanceof Error ? err : new Error('Failed to load model')
      if (showProgress) {
        setError(error.message)
        setIsModelLoading(false)
      }
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
      setVolume(0)
      audioChunksRef.current = []
      recordingStartTimeRef.current = Date.now()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      streamRef.current = stream
      console.log('Got media stream')

      // Create audio context and analyser for volume visualization
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      const analyser = audioContextRef.current.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyser)
      sourceNodeRef.current = source

      // Start volume monitoring
      isMonitoringRef.current = true
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateVolume = () => {
        if (isMonitoringRef.current && analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          // Calculate RMS (Root Mean Square) for better volume representation
          const sum = dataArray.reduce((acc, value) => acc + value * value, 0)
          const rms = Math.sqrt(sum / dataArray.length)
          const normalizedVolume = Math.min(rms / 128, 1) // Normalize to 0-1
          setVolume(normalizedVolume)
          if (isMonitoringRef.current) {
            animationFrameRef.current = requestAnimationFrame(updateVolume)
          }
        }
      }
      updateVolume()

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk received:', event.data.size, 'bytes')
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        isMonitoringRef.current = false
        const recordingDuration = Date.now() - recordingStartTimeRef.current
        console.log('Recording stopped, duration:', recordingDuration, 'ms')

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('Audio blob created:', audioBlob.size, 'bytes')

        // Check if recording is too short
        if (recordingDuration < 1000) {
          console.warn('Recording too short:', recordingDuration, 'ms')
          setError('Recording too short. Please speak for at least 1 second.')
          setIsTranscribing(false)
          setIsRecording(false)
          setVolume(0)
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
          }
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          return
        }

        // Check if audio blob is too small
        if (audioBlob.size < 1000) {
          console.warn('Audio blob too small:', audioBlob.size, 'bytes')
          setError('No audio detected. Please check your microphone.')
          setIsTranscribing(false)
          setIsRecording(false)
          setVolume(0)
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
          }
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          return
        }

        // Stop volume monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        setVolume(0)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null

        // Transcribe the audio
        try {
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

      // Clean up on error
      isMonitoringRef.current = false
      setVolume(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
        sourceNodeRef.current = null
      }
    }
  }, [initializeTranscriber, convertAudioBlob, onTranscriptionComplete, onError, isRecording])

  const stopRecording = useCallback(async () => {
    console.log('Stopping recording...')
    if (mediaRecorderRef.current && isRecording) {
      isMonitoringRef.current = false
      setIsTranscribing(true) // Set immediately for better UX
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setVolume(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
        sourceNodeRef.current = null
      }
      console.log('Recording stop requested')
    }
  }, [isRecording])

  // Preload model silently (no UI feedback)
  const preloadModel = useCallback(async () => {
    await initializeTranscriber(false)
  }, [initializeTranscriber])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMonitoringRef.current = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
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
    volume,
    startRecording,
    stopRecording,
    preloadModel
  }
}
