import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card } from '../components/ui/index.js'

export default function ProcessingPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  
  useEffect(() => {
    // In a real application (Phase 5/7), this would poll the backend 
    // or listen to a WebSocket to know when the report is ready.
    // For now, we just simulate a 5 second processing delay and navigate to the dashboard.
    
    const timer = setTimeout(() => {
      navigate('/dashboard')
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [navigate])
  
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
