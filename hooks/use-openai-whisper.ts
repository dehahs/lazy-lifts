import { useRef, useState, useCallback, useEffect } from 'react'

interface UseOpenAIWhisperOptions {
  onTranscriptionComplete?: (text: string, context?: string) => void
  onError?: (error: Error) => void
}

interface UseOpenAIWhisperReturn {
  isRecording: boolean
  isTranscribing: boolean
  isModelLoading: boolean
  modelLoadProgress: number
  transcript: string
  error: string | null
  volume: number
  startRecording: (context?: string) => Promise<void>
  stopRecording: () => Promise<void>
}

export function useOpenAIWhisper(options: UseOpenAIWhisperOptions = {}): UseOpenAIWhisperReturn {
  const {
    onTranscriptionComplete,
    onError
  } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [volume, setVolume] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const recordingContextRef = useRef<string | undefined>(undefined)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isMonitoringRef = useRef<boolean>(false)
  const recordingStartTimeRef = useRef<number>(0)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)

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
          const sum = dataArray.reduce((acc, value) => acc + value * value, 0)
          const rms = Math.sqrt(sum / dataArray.length)
          const normalizedVolume = Math.min(rms / 128, 1)
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
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        isMonitoringRef.current = false
        const recordingDuration = Date.now() - recordingStartTimeRef.current

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('Recording stopped, duration:', recordingDuration, 'ms, size:', audioBlob.size, 'bytes')

        // Check if recording is too short
        if (recordingDuration < 1000) {
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

        // Transcribe using OpenAI API
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error('Transcription failed')
          }

          const data = await response.json()
          const text = data.text.trim()
          console.log('Transcribed text:', text)

          setTranscript(text)
          setIsTranscribing(false)

          if (onTranscriptionComplete && text) {
            const context = recordingContextRef.current
            onTranscriptionComplete(text, context)
            recordingContextRef.current = undefined
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
  }, [onTranscriptionComplete, onError])

  const stopRecording = useCallback(async () => {
    console.log('Stopping recording...')
    if (mediaRecorderRef.current && isRecording) {
      isMonitoringRef.current = false
      setIsTranscribing(true)
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
    }
  }, [isRecording])

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
    isModelLoading: false,
    modelLoadProgress: 100,
    transcript,
    error,
    volume,
    startRecording,
    stopRecording
  }
}
