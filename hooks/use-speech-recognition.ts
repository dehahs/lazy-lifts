import { useRef, useState, useCallback, useEffect } from 'react'

interface UseSpeechRecognitionOptions {
  onTranscriptionComplete?: (text: string, context?: string) => void
  onError?: (error: Error) => void
}

interface UseSpeechRecognitionReturn {
  isRecording: boolean
  isTranscribing: boolean
  isModelLoading: boolean
  modelLoadProgress: number
  transcript: string
  error: string | null
  volume: number // 0-1 normalized volume level
  startRecording: (context?: string) => Promise<void>
  stopRecording: () => Promise<void>
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const {
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

  const recognitionRef = useRef<any>(null)
  const recordingContextRef = useRef<string | undefined>(undefined)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const finalTranscriptRef = useRef<string>('')
  const manuallyStoppedRef = useRef<boolean>(false)
  const isMonitoringRef = useRef<boolean>(false)
  const hasErrorRef = useRef<boolean>(false)

  // Check if Web Speech API is available
  const isSpeechRecognitionAvailable = useCallback(() => {
    if (typeof window === 'undefined') return false
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  }, [])

  const startRecording = useCallback(async (context?: string) => {
    try {
      console.log('Starting recording with context:', context)
      recordingContextRef.current = context
      setError(null)
      setTranscript('')
      setVolume(0)
      finalTranscriptRef.current = ''
      manuallyStoppedRef.current = false
      hasErrorRef.current = false

      // Check if Speech Recognition is available
      if (!isSpeechRecognitionAvailable()) {
        throw new Error('Speech recognition is not supported in this browser. Please use Chrome or Edge.')
      }

      // Get media stream for volume visualization
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
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

      // Start volume monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      isMonitoringRef.current = true
      const updateVolume = () => {
        if (analyserRef.current && isMonitoringRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          // Calculate RMS (Root Mean Square) for better volume representation
          const sum = dataArray.reduce((acc, value) => acc + value * value, 0)
          const rms = Math.sqrt(sum / dataArray.length)
          const normalizedVolume = Math.min(rms / 128, 1) // Normalize to 0-1
          setVolume(normalizedVolume)
          animationFrameRef.current = requestAnimationFrame(updateVolume)
        }
      }
      updateVolume()

      // Initialize Speech Recognition
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition

      recognition.continuous = true // Keep listening until manually stopped
      recognition.interimResults = true // Get interim results for real-time feedback
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        console.log('Speech recognition started')
        setIsRecording(true)
        setIsModelLoading(false)
        setModelLoadProgress(100)
        manuallyStoppedRef.current = false
        hasErrorRef.current = false
      }

      recognition.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        // Update final transcript ref
        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript
        }

        // Display interim + final transcript
        const displayText = (finalTranscriptRef.current + interimTranscript).trim()
        setTranscript(displayText)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event)
        hasErrorRef.current = true
        setIsRecording(false)
        setIsTranscribing(false)
        isMonitoringRef.current = false
        manuallyStoppedRef.current = false
        setVolume(0)
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        const errorMessages: { [key: string]: string } = {
          'network': 'Network error. Please check your internet connection and try again.',
          'no-speech': 'No speech was detected. Please try again.',
          'audio-capture': 'No microphone was found or microphone access was denied.',
          'not-allowed': 'Microphone permission was denied. Please allow microphone access.',
          'aborted': 'Speech recognition was aborted.',
          'default': 'An error occurred with speech recognition.'
        }

        const message = errorMessages[event.error] || errorMessages.default
        setError(message)
        
        // Clear any partial transcript on error
        finalTranscriptRef.current = ''
        setTranscript('')
        
        if (onError) {
          onError(new Error(message))
        }

        // Stop stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      recognition.onend = () => {
        console.log('Speech recognition ended, manually stopped:', manuallyStoppedRef.current, 'has error:', hasErrorRef.current)
        
        // Stop volume monitoring and stream first
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

        // Don't process transcript if there was an error
        if (hasErrorRef.current) {
          setIsRecording(false)
          setIsTranscribing(false)
          return
        }

        // Only process transcript if we manually stopped and have text
        if (manuallyStoppedRef.current && finalTranscriptRef.current.trim()) {
          setIsTranscribing(true)
          
          // Small delay to ensure final transcript is captured
          setTimeout(() => {
            const finalText = finalTranscriptRef.current.trim()
            setTranscript(finalText)
            setIsTranscribing(false)
            setIsRecording(false)

            if (onTranscriptionComplete && finalText) {
              const context = recordingContextRef.current
              console.log('Calling onTranscriptionComplete with context:', context)
              onTranscriptionComplete(finalText, context)
              recordingContextRef.current = undefined // Clear after use
            }
          }, 100)
        } else {
          // If not manually stopped, just reset state
          setIsRecording(false)
          setIsTranscribing(false)
          // Don't restart automatically - user must click record again
        }
      }

      recognition.start()
      console.log('Recording started')
    } catch (err) {
      console.error('Start recording error:', err)
      const error = err instanceof Error ? err : new Error('Failed to start recording')
      setError(error.message)
      if (onError) onError(error)
      setVolume(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      setIsRecording(false)
    }
  }, [isSpeechRecognitionAvailable, onTranscriptionComplete, onError])

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...')
    if (recognitionRef.current && isRecording) {
      manuallyStoppedRef.current = true
      recognitionRef.current.stop()
      // onend will handle the rest
    }
  }, [isRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors when stopping
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
    isModelLoading: false, // Web Speech API doesn't need model loading
    modelLoadProgress: 100, // Always "loaded"
    transcript,
    error,
    volume,
    startRecording,
    stopRecording
  }
}

