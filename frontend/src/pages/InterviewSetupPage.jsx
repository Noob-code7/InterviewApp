import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { sessionsApi } from '../api/sessions.js'
import { Button, Input, Card } from '../components/ui/index.js'

const INTERVIEW_TYPES = [
  { id: 'hr',        label: 'HR Interview',              desc: 'Behavioral & Cultural fit',        icon: '👥' },
  { id: 'technical', label: 'Technical Interview',       desc: 'Coding & Systems design',          icon: '💻' },
  { id: 'resume',    label: 'Resume Based Interview',    desc: 'Deep dive into your past roles',   icon: '📄' },
  { id: 'company',   label: 'Company Specific Practice', desc: 'FAANG & Fortune 500 patterns',     icon: '🏢' },
]

export default function InterviewSetupPage() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const [step, setStep] = useState(1)
  
  // Step 1
  const [interviewType, setInterviewType] = useState(state?.type || '')
  
  // Step 2
  const [role, setRole] = useState('')
  const [questionCount, setQuestionCount] = useState(5)
  const [company, setCompany] = useState('')
  
  // Step 3
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [creating, setCreating] = useState(false)
  const streamRef = useRef(null)
  const videoRef = useRef(null)

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const handleStep1 = () => {
    if (interviewType) setStep(2)
  }

  const handleStep2 = (e) => {
    e.preventDefault()
    if (role.trim()) setStep(3)
  }

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setPermissionGranted(true)
      setPermissionError('')
    } catch {
      setPermissionError('Camera or microphone access was denied. Please allow access in your browser settings and try again.')
    }
  }

  const handleStart = async () => {
    setCreating(true)
    try {
      let referenceImage = null;
      if (videoRef.current && videoRef.current.readyState === 4) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        // Handle mirroring because the video has scale-x-[-1]
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        referenceImage = canvas.toDataURL('image/jpeg', 0.8);
      }

      const { data } = await sessionsApi.create({ 
        role: interviewType === 'company' && company.trim() ? `${company} - ${role}` : role, 
        interviewType, 
        questionCount,
        referenceImage
      })
      navigate(`/interview/live/${data.data.session._id}`)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create session')
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg py-12 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Header & Step Indicator */}
        <div className="mb-8">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/dashboard')}
            className="text-brand-muted hover:text-brand-text mb-6 flex items-center gap-1 text-sm font-medium transition-colors"
          >
            ← {step > 1 ? 'Back' : 'Back to Dashboard'}
          </button>
          
          <h1 className="text-3xl font-bold text-brand-text mb-2">Configure Your Session</h1>
          <p className="text-brand-muted">Customize your mock interview experience.</p>
          
          <div className="flex items-center gap-2 mt-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  s < step ? 'bg-primary' : s === step ? 'bg-primary/50' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Interview Type */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-semibold mb-4 text-brand-text">1. Select Interview Type</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {INTERVIEW_TYPES.map(({ id, label, desc, icon }) => (
                <button
                  key={id}
                  onClick={() => setInterviewType(id)}
                  className={`card p-5 flex items-start gap-4 text-left transition-all active:scale-[0.99] ${
                    interviewType === id 
                      ? 'border-primary ring-1 ring-primary shadow-md bg-primary-light/10' 
                      : 'hover:border-primary/50 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 transition-colors ${
                    interviewType === id ? 'bg-primary text-white' : 'bg-brand-bg text-brand-text'
                  }`}>
                    {icon}
                  </div>
                  <div>
                    <h3 className={`font-semibold mb-1 ${interviewType === id ? 'text-primary-dark' : 'text-brand-text'}`}>{label}</h3>
                    <p className="text-sm text-brand-muted">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button size="lg" onClick={handleStep1} disabled={!interviewType}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Role & Questions */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="animate-fade-in space-y-6">
            <h2 className="text-xl font-semibold text-brand-text">2. Target Role & Format</h2>
            
            <Card className="space-y-6">
              {interviewType === 'company' && (
                <Input
                  label="Target Company"
                  placeholder="e.g. Google, Microsoft, Stripe"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoFocus
                />
              )}
              
              <Input
                label="Target Role"
                placeholder="e.g. Senior Frontend Engineer, Product Manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                autoFocus={interviewType !== 'company'}
              />

              <div>
                <label className="text-sm font-medium text-brand-text block mb-3">
                  Number of Questions
                </label>
                <div className="flex flex-wrap gap-3">
                  {[3, 5, 8, 10].map(n => (
                    <button 
                      key={n}
                      type="button"
                      onClick={() => setQuestionCount(n)}
                      className={`px-5 py-2.5 rounded-full border text-sm font-medium transition-colors ${
                        questionCount === n
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-brand-text border-brand-border hover:border-primary/50'
                      }`}
                    >
                      {n} questions
                    </button>
                  ))}
                </div>
                <p className="text-xs text-brand-subtle mt-3">
                  Estimated duration: ~{questionCount * 3} minutes
                </p>
              </div>
            </Card>
            
            <div className="flex justify-end">
              <Button size="lg" type="submit" disabled={!role.trim()}>
                Continue →
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Camera & Mic Check */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <h2 className="text-xl font-semibold text-brand-text">3. Equipment Check</h2>
            <p className="text-brand-muted text-sm">
              We need access to your camera and microphone for AI face and voice analysis.
            </p>

            <Card className="overflow-hidden p-0 border-0 shadow-lg bg-black/5">
              <div className="relative aspect-video bg-black flex items-center justify-center rounded-lg overflow-hidden border border-brand-border">
                {/* Video Preview */}
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${permissionGranted ? 'opacity-100' : 'opacity-0'}`}
                />
                
                {/* Placeholder / Grant Button overlay */}
                {!permissionGranted && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-black/40 backdrop-blur-sm">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 text-white">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                    </div>
                    <Button onClick={requestPermissions} variant="primary" className="mb-2 shadow-lg hover:scale-105">
                      Allow Camera & Microphone
                    </Button>
                    {permissionError && (
                      <p className="text-sm text-red-400 mt-2 max-w-sm">{permissionError}</p>
                    )}
                  </div>
                )}

                {/* Success overlay elements */}
                {permissionGranted && (
                  <>
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs text-white font-medium tracking-wide">CAMERA ACTIVE</span>
                    </div>
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md rounded-full p-2 border border-white/10">
                       <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                  </>
                )}
              </div>
              
              {permissionGranted && (
                 <div className="p-4 bg-white flex items-start gap-3 border-t border-brand-border">
                   <span className="text-green-500 text-xl">✓</span>
                   <div>
                     <h4 className="font-semibold text-brand-text text-sm">Permissions granted</h4>
                     <p className="text-xs text-brand-muted">Your audio and video are working perfectly. Make sure you are in a quiet, well-lit room.</p>
                   </div>
                 </div>
              )}
            </Card>

            <div className="flex justify-end pt-4">
              <Button 
                size="lg" 
                onClick={handleStart} 
                disabled={!permissionGranted || creating}
                loading={creating}
                className={permissionGranted ? 'animate-pulse-ring' : ''}
              >
                {creating ? 'Preparing Session...' : 'Start Interview'}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
