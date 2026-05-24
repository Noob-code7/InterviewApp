import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../utils/api.js'
import { Card } from '../components/ui/index.js'

export default function ProcessingPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const sessionId = state?.sessionId
  const [error, setError] = useState(null)
  const errorRef = useRef(null)

  const setAndRefError = (errMsg) => {
    errorRef.current = errMsg
    setError(errMsg)
  }
  
  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard')
      return
    }

    let intervalId
    let isCancelled = false

    const triggerAnalysis = async () => {
      try {
        await api.post(`/analysis/${sessionId}/start`)
      } catch (err) {
        if (!isCancelled) {
          setAndRefError(err.response?.data?.message || 'Failed to start analysis')
        }
      }
    }

    const checkStatus = async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}`)
        if (data.data.session.status === 'completed') {
          if (!isCancelled) navigate('/dashboard')
        } else if (data.data.session.status === 'failed') {
          if (!isCancelled) setAndRefError('Analysis failed. Please try again.')
        }
      } catch (err) {
        console.error('Status check error:', err)
      }
    }

    triggerAnalysis().then(() => {
      if (!isCancelled) {
        intervalId = setInterval(() => {
          if (!errorRef.current) checkStatus()
        }, 3000)
      }
    })
    
    return () => {
      isCancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [navigate, sessionId])
  
  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-brand-bg p-4">
        <Card className="max-w-md w-full text-center p-12 space-y-6 shadow-xl border-danger/20">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-danger mb-2">Analysis Failed</h1>
          <p className="text-brand-muted text-sm">{error}</p>
          <button 
            onClick={() => { setError(null); navigate('/dashboard') }}
            className="mt-4 px-6 py-2 bg-primary text-white rounded-md font-medium"
          >
            Back to Dashboard
          </button>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-brand-bg p-4">
      <Card className="max-w-md w-full text-center p-12 space-y-6 shadow-xl border-primary/20">
        <div className="relative w-24 h-24 mx-auto">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-[spin_2s_linear_infinite]"></div>
          {/* Inner rotating ring */}
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-primary-dark border-l-primary-dark animate-[spin_1.5s_linear_infinite_reverse]"></div>
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center text-3xl">
            🤖
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-brand-text mb-2">Analyzing Performance</h1>
          <p className="text-brand-muted text-sm">
            AI is evaluating your video, voice confidence, and answers...
          </p>
        </div>
        
        <div className="pt-6">
          <div className="progress-bar w-full">
            <div className="progress-bar-fill animate-[shimmer_2s_infinite]" style={{ width: '100%', backgroundImage: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-dark) 50%, var(--color-primary) 100%)', backgroundSize: '200% 100%' }}></div>
          </div>
        </div>
      </Card>
    </div>
  )
}
