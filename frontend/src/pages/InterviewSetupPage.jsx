import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { sessionsApi } from '../api/sessions.js'
import api from '../api/axios.js'
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
  
  // Step 2: Student Identification & Role
  const [candidateName, setCandidateName] = useState('')
  const [department, setDepartment] = useState('Computer Science')
  const [rollNo, setRollNo] = useState('')
  const [graduationYear, setGraduationYear] = useState('2026')
  const [role, setRole] = useState('')
  const [questionCount, setQuestionCount] = useState(5)
  const [company, setCompany] = useState('')

  // Resume Mode state
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [resumeStatus, setResumeStatus] = useState('')
  
  // Step 3: Equipment Check
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
    if (role.trim() && candidateName.trim()) setStep(3)
  }

  const handleResumeFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setResumeFile(file)
    setResumeStatus(`Parsing ${file.name}...`)

    try {
      const formData = new FormData()
      formData.append("resume", file)
      formData.append("role", role || "Software Engineer")
      formData.append("count", questionCount || 5)

      const { data } = await api.post("/api/sessions/parse-resume", formData)

      const extracted = data.data?.extractedText || ""
      setResumeText(extracted)
      setResumeStatus(`✓ Parsed ${file.name} successfully (${extracted.length} characters extracted)`)
    } catch (err) {
      console.error("Resume backend parsing error:", err.response?.data || err.message)
      setResumeStatus(`⚠️ Failed to parse ${file.name}: ${err.response?.data?.error || err.message}`)
      setResumeText(`Candidate resume file: ${file.name}`)
    }
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
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        referenceImage = canvas.toDataURL('image/jpeg', 0.8);
      }

      const { data } = await sessionsApi.create({ 
        candidateName: candidateName.trim(),
        department: department.trim(),
        rollNo: rollNo.trim(),
        graduationYear: graduationYear.trim(),
        role: interviewType === 'company' && company.trim() ? `${company} - ${role}` : role, 
        interviewType, 
        questionCount,
        referenceImage,
        resumeText: resumeText || `${role} Candidate Resume Background`
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
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
            className="text-brand-muted hover:text-brand-text mb-6 flex items-center gap-1 text-sm font-medium transition-colors"
          >
            ← {step > 1 ? 'Back' : 'Back to Home'}
          </button>
          
          <h1 className="text-3xl font-bold text-brand-text mb-2">Configure Your Session</h1>
          <p className="text-brand-muted">Customize your mock interview experience.</p>
          
          <div className="flex gap-2 mt-6">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Type Selection */}
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <h2 className="text-xl font-semibold text-brand-text">1. Select Interview Format</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INTERVIEW_TYPES.map((type) => (
                <Card
                  key={type.id}
                  hover
                  onClick={() => setInterviewType(type.id)}
                  className={`cursor-pointer transition-all ${
                    interviewType === type.id
                      ? 'border-primary shadow-md ring-2 ring-primary/20 bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                >
                  <div className="text-3xl mb-3">{type.icon}</div>
                  <h3 className="font-semibold text-brand-text mb-1">{type.label}</h3>
                  <p className="text-xs text-brand-muted">{type.desc}</p>
                </Card>
              ))}
            </div>
            
            <div className="flex justify-end pt-4">
              <Button size="lg" onClick={handleStep1} disabled={!interviewType}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Student Identification & Target Role */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="animate-fade-in space-y-6">
            <h2 className="text-xl font-semibold text-brand-text">2. Student Identification & Target Role</h2>
            
            <Card className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Candidate Full Name *"
                  placeholder="e.g. Rahul Sharma"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  required
                />
                
                <Input
                  label="Roll Number / Student ID *"
                  placeholder="e.g. 21CS045"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#6E6D68] uppercase tracking-wider block mb-1">
                    Department / Branch
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="Computer Science">Computer Science & Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics & Comm">Electronics & Comm (ECE)</option>
                    <option value="Electrical Engineering">Electrical Engineering (EEE)</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#6E6D68] uppercase tracking-wider block mb-1">
                    Graduation Year
                  </label>
                  <select
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(e.target.value)}
                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                  </select>
                </div>
              </div>

              {interviewType === 'resume' && (
                <div className="space-y-3 bg-[#FAF9F5] p-4 rounded-xl border border-[#E2DFD8]">
                  <label className="text-xs font-bold text-[#161615] uppercase tracking-wider block">
                    Upload Candidate Resume (PDF / DOCX / TXT)
                  </label>
                  <p className="text-xs text-[#6E6D68]">
                    Questions will be synthesized specifically grounded in your resume projects, tools, and work experience.
                  </p>
                  <div className="border-2 border-dashed border-[#E2DFD8] bg-white rounded-xl p-4 text-center hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleResumeFileUpload}
                      className="hidden"
                      id="resume-file-input"
                    />
                    <label htmlFor="resume-file-input" className="cursor-pointer flex flex-col items-center">
                      <span className="text-2xl mb-1">📄</span>
                      <span className="text-xs font-semibold text-[#161615]">
                        {resumeFile ? resumeFile.name : "Click to select resume file"}
                      </span>
                    </label>
                  </div>

                  {resumeStatus && (
                    <div className="text-[11px] font-mono text-emerald-600">
                      ✓ {resumeStatus}
                    </div>
                  )}

                  {/* Extracted Resume Text Preview Box */}
                  {resumeText && (
                    <div className="mt-3 space-y-1">
                      <span className="text-[11px] font-bold text-[#161615] block uppercase tracking-wider">
                        📄 Extracted Resume Text Preview:
                      </span>
                      <textarea
                        readOnly
                        value={resumeText}
                        className="w-full h-32 p-3 bg-white border border-[#E2DFD8] rounded-xl text-xs font-mono text-[#161615] leading-relaxed resize-none focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {interviewType === 'company' && (
                <Input
                  label="Target Company"
                  placeholder="e.g. Google, Microsoft, TCS"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              )}
              
              <Input
                label="Target Engineering Role *"
                placeholder="e.g. Fullstack Engineer, Frontend Developer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />

              <div>
                <label className="text-sm font-medium text-brand-text block mb-3">
                  Number of Practice Questions
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
              </div>
            </Card>
            
            <div className="flex justify-end">
              <Button size="lg" type="submit" disabled={!role.trim() || !candidateName.trim()}>
                Continue to Equipment Check →
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Equipment Check */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <h2 className="text-xl font-semibold text-brand-text">3. Equipment Check</h2>
            <p className="text-brand-muted text-sm">
              Verify your camera and microphone to enable real-time emotion recognition and speech transcript analysis.
            </p>

            <Card className="space-y-6">
              <div className="aspect-video bg-black/40 rounded-xl overflow-hidden relative flex items-center justify-center border border-white/10">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform scale-x-[-1] ${permissionGranted ? 'block' : 'hidden'}`}
                />
                
                {!permissionGranted && (
                  <div className="text-center p-6 space-y-3">
                    <div className="text-4xl mb-2">📹</div>
                    <p className="text-sm text-brand-muted">Camera preview will appear here once enabled.</p>
                    <Button onClick={requestPermissions} type="button">
                      Allow Camera & Microphone Access
                    </Button>
                  </div>
                )}
              </div>

              {permissionError && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  {permissionError}
                </div>
              )}
            </Card>

            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => setStep(2)}>
                ← Back
              </Button>
              
              <Button 
                size="lg" 
                onClick={handleStart}
                disabled={!permissionGranted || creating}
              >
                {creating ? 'Launching Room...' : 'Start Interview Session →'}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
