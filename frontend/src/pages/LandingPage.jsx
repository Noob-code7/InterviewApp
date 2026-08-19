import { useState, useEffect, useRef } from 'react'



import { useNavigate, Link } from 'react-router-dom'



import useAuthStore from '../store/authStore.js'



import { sessionsApi } from '../api/sessions.js'



import LiveAudioVisualizer from '../components/ui/LiveAudioVisualizer.jsx'







function WaveformBars({ active, audioStream, isRecording }) {



  return (



    <LiveAudioVisualizer



      audioStream={audioStream}



      isRecording={isRecording}



      active={active}



      color="#1D5DFF"



      inactiveColor="#6E6D68"



    />



  )



}







function HeroProduct() {



  const [phase, setPhase] = useState(0)



  const [typed, setTyped] = useState('')



  const question = "Tell me about a project you're particularly proud of."



  const timerRef = useRef(null)







  useEffect(() => {



    const startCycle = () => {



      setPhase(0)



      setTyped('')



      let i = 0



      const typeInterval = setInterval(() => {



        i++



        setTyped(question.slice(0, i))



        if (i >= question.length) {



          clearInterval(typeInterval)



          setTimeout(() =>setPhase(1), 400)



          setTimeout(() =>setPhase(2), 1200)



          setTimeout(() =>setPhase(3), 2800)



          timerRef.current = setTimeout(() =>startCycle(), 7000)



        }



      }, 28)



    }



    startCycle()



    return () => { if (timerRef.current) clearTimeout(timerRef.current) }



  }, [])







  const metrics = [



    { label: 'Confidence', value: '87%', delay: 0 },



    { label: 'Fluency', value: '92%', delay: 150 },



    { label: 'Answer Quality', value: '89%', delay: 300 },



  ]







  return (



    <div className="bg-[#0D0D0C] rounded-lg border border-[#2A2A28] overflow-hidden w-full max-w-2xl mx-auto shadow-2xl">



      {/* Header bar */}



      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2A2A28]">



        <div className="flex items-center gap-3">



          <div className="flex items-center gap-1.5">



            <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />



            <span className="font-mono text-xs text-red-400 tracking-widest">LIVE</span>



          </div>



          <span className="text-[#3A3A38] text-xs">|</span>



          <span className="font-mono text-xs text-[#6E6D68]">04:32</span>



        </div>



        <span className="font-mono text-xs text-[#6E6D68]">Question 04 / 10</span>



      </div>







      {/* Question area */}



      <div className="px-6 pt-6 pb-4">



        <div className="text-[10px] font-mono text-[#4A4A48] tracking-widest uppercase mb-3">AI Interviewer</div>



        <p className="text-[#F0EEE8] text-[15px] leading-relaxed font-medium min-h-[48px] font-sans">



          "{typed}<span className="cursor-blink text-[#1D5DFF]">|</span>"



        </p>



      </div>







      {/* Waveform */}



      <div className="px-6 py-4 border-t border-[#1A1A18]">



        <div className="flex items-center gap-3 mb-2">



          <div className="flex items-center gap-1.5">



            <span



              className="w-1.5 h-1.5 rounded-full"



              style={{



                backgroundColor: phase >= 1 ? '#1D5DFF' : '#3A3A38',



                animation: phase >= 1 ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',



              }}



            />



            <span className="font-mono text-xs" style={{ color: phase >= 1 ? '#1D5DFF' : '#4A4A48' }}>



              {phase >= 1 ? 'Listening...' : 'Waiting...'}



            </span>



          </div>



        </div>



        <WaveformBars active={phase >= 1} />



      </div>







      {/* Metrics row */}



      <div className="px-6 pb-5 grid grid-cols-3 gap-3">



        {metrics.map((m) => (



          <div



            key={m.label}



            className="rounded border border-[#2A2A28] px-3 py-2 transition-all duration-500 bg-[#161615]"



            style={{



              opacity: phase >= 3 ? 1 : 0,



              transform: phase >= 3 ? 'translateY(0)' : 'translateY(6px)',



              transitionDelay: `${m.delay}ms`,



            }}



          >



            <div className="text-[10px] font-mono text-[#6E6D68] mb-0.5">{m.label}</div>



            <div className="text-[#F0EEE8] text-sm font-semibold">{m.value}</div>



          </div>



        ))}



      </div>







      {/* Bottom controls */}



      <div className="px-6 pb-5 flex items-center gap-3">



        <div className="flex items-center gap-2 bg-[#161615] border border-[#2A2A28] rounded px-3 py-1.5">



          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />



          <span className="font-mono text-[10px] text-[#6E6D68]">Voice</span>



        </div>



        <div className="flex items-center gap-2 bg-[#161615] border border-[#2A2A28] rounded px-3 py-1.5">



          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />



          <span className="font-mono text-[10px] text-[#6E6D68]">Video</span>



        </div>



        <div className="flex items-center gap-2 bg-[#161615] border border-[#2A2A28] rounded px-3 py-1.5">



          <div className="w-1.5 h-1.5 rounded-full bg-[#1D5DFF]" />



          <span className="font-mono text-[10px] text-[#6E6D68]">Analysis</span>



        </div>



      </div>



    </div>



  )



}







function InterviewFlow() {



  const steps = ['INTRO', 'QUESTION', 'RESPONSE', 'FOLLOW-UP', 'ANALYSIS', 'FEEDBACK']



  const [activeStep, setActiveStep] = useState(0)







  useEffect(() => {



    const interval = setInterval(() => {



      setActiveStep((s) => (s + 1) % steps.length)



    }, 1400)



    return () =>clearInterval(interval)



  }, [])







  return (



    <div className="flex flex-col items-start gap-0">



      {steps.map((step, i) => (



        <div key={step} className="flex items-center">



          <div className="flex flex-col items-center">



            <div



              className="w-px h-7 transition-colors duration-500"



              style={{ backgroundColor: i <= activeStep ? '#111110' : '#E0DFD9', display: i === 0 ? 'none' : 'block' }}



            />



            <div



              className="w-2 h-2 rounded-full transition-all duration-300"



              style={{ backgroundColor: i === activeStep ? '#1D5DFF' : i < activeStep ? '#111110' : '#E0DFD9' }}



            />



          </div>



          <span



            className="ml-5 font-mono text-sm tracking-widest uppercase transition-colors duration-300"



            style={{ color: i === activeStep ? '#1D5DFF' : i < activeStep ? '#111110' : '#C0BFB9' }}



          >



            {step}



          </span>



        </div>



      ))}



    </div>



  )



}







function ScoreBar({ label, score, delay }) {



  const [visible, setVisible] = useState(false)



  const ref = useRef(null)







  useEffect(() => {



    const obs = new IntersectionObserver(



      ([e]) => { if (e.isIntersecting) { setTimeout(() =>setVisible(true), delay) } },



      { threshold: 0.3 }



    )



    if (ref.current) obs.observe(ref.current)



    return () =>obs.disconnect()



  }, [delay])







  return (



    <div ref={ref} className="flex items-center gap-4">



      <div className="w-36 text-sm text-[#6E6D68] font-medium shrink-0 font-inter">{label}</div>



      <div className="flex-1 h-px bg-[#E0DFD9] relative">



        <div



          className="absolute top-1/2 -translate-y-1/2 h-[3px] bg-[#111110] rounded-full transition-all duration-700 ease-out"



          style={{ width: visible ? `${score}%` : '0%' }}



        />



      </div>



      <div className="w-8 text-sm font-semibold text-[#111110] text-right shrink-0 font-mono">{score}</div>



    </div>



  )



}







export default function LandingPage() {



  const navigate = useNavigate()



  const { user, isAuthenticated, logout } = useAuthStore()



  const [stats, setStats] = useState(null)



  const [loadingStats, setLoadingStats] = useState(false)







  useEffect(() => {



    if (isAuthenticated) {



      setLoadingStats(true)



      sessionsApi.getStats()



        .then(({ data }) =>setStats(data.data))



        .catch(() =>setStats(null))



        .finally(() =>setLoadingStats(false))



    }



  }, [isAuthenticated])







  const INTERVIEW_TYPES = [



    { id: 'hr', label: 'HR Interview', desc: 'Behavioral & cultural fit questions', featured: true },



    { id: 'technical', label: 'Technical Interview', desc: 'Coding & systems architecture' },



    { id: 'resume', label: 'Resume-based', desc: 'Deep dive into your past roles' },



    { id: 'company', label: 'Company-specific', desc: 'FAANG & Fortune 500 patterns' },



    { id: 'writing', label: 'Written Test', desc: '10-minute timed response test' },



  ]







  return (



    <div className="bg-[#F6F5F0] text-[#111110] min-h-screen font-sans">







      {/*  AUTHENTICATED CANDIDATE DASHBOARD BANNER (When Logged In)  */}



      {isAuthenticated && (



        <section className="pt-24 pb-8 max-w-6xl mx-auto px-6">



          <div className="bg-[#111110] text-[#F0EEE8] border border-[#2A2A28] rounded-2xl p-8 relative overflow-hidden shadow-xl">



            <div className="absolute top-0 right-0 w-96 h-96 bg-[#1D5DFF]/15 rounded-full blur-3xl pointer-events-none"></div>







            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">



              <div>



                <div className="flex items-center gap-2 mb-2">



                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest bg-[#1D5DFF] text-white font-semibold">Authenticated Telemetry Hub



                  </span>



                  {user?.role && (



                    <span className="text-xs font-mono text-[#9A9990] capitalize">



                       {user.role}



                    </span>



                  )}



                </div>



                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Welcome back, {user?.name || "Candidate"}!



                </h1>



                <p className="text-sm text-[#9A9990] max-w-md mt-1 font-inter">Select an interview mode to launch your next session or inspect your historical multimodal reports.



                </p>



              </div>







              <div className="flex items-center gap-3 shrink-0">



                <button



                  onClick={() =>navigate('/interview/setup')}



                  className="bg-[#1D5DFF] hover:bg-blue-600 text-white text-sm px-6 py-3 rounded-xl font-semibold transition-colors duration-200 shadow-md"



                >Start New Interview 



                </button>



                <Link



                  to="/history"



                  className="bg-[#2A2A28] hover:bg-[#3A3A38] text-[#F0EEE8] text-sm px-5 py-3 rounded-xl font-medium transition-colors border border-[#3A3A38]"



                >View History



                </Link>



              </div>



            </div>







            {/* Candidate Telemetry Stats Row */}



            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#2A2A28]">



              <div className="bg-[#161615] border border-[#2A2A28] rounded-xl p-4">



                <span className="text-[10px] font-mono uppercase text-[#6E6D68] tracking-widest block mb-1">Interviews Completed



                </span>



                <span className="text-2xl font-bold text-white font-mono">



                  {loadingStats ? "--" : stats?.stats?.interviewsCompleted || 0}



                </span>



              </div>







              <div className="bg-[#161615] border border-[#2A2A28] rounded-xl p-4">



                <span className="text-[10px] font-mono uppercase text-[#6E6D68] tracking-widest block mb-1">Avg Confidence Score



                </span>



                <span className="text-2xl font-bold text-[#1D5DFF] font-mono">



                  {loadingStats ? "--" : stats?.stats?.avgConfidenceScore ? `${stats.stats.avgConfidenceScore}%` : "--"}



                </span>



              </div>







              <div className="bg-[#161615] border border-[#2A2A28] rounded-xl p-4">



                <span className="text-[10px] font-mono uppercase text-[#6E6D68] tracking-widest block mb-1">Avg Writing Score



                </span>



                <span className="text-2xl font-bold text-emerald-400 font-mono">



                  {loadingStats ? "--" : stats?.stats?.avgWritingScore ? `${stats.stats.avgWritingScore}%` : "--"}



                </span>



              </div>







              <div className="bg-[#161615] border border-[#2A2A28] rounded-xl p-4">



                <span className="text-[10px] font-mono uppercase text-[#6E6D68] tracking-widest block mb-1">Readiness Index



                </span>



                <span className="text-xl font-bold text-amber-400 font-mono">



                  {loadingStats ? "--" : stats?.stats?.avgOverallScore >= 80 ? "Market Ready" : "In Practice"}



                </span>



              </div>



            </div>



          </div>



        </section>



      )}







      {/*  HERO  */}



      <section id="product" className={`${isAuthenticated ? 'pt-4 pb-16' : 'pt-28 pb-20'} max-w-6xl mx-auto px-6`}>



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">



          <div>



            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6E6D68] mb-6 font-medium">Real-time AI interview simulator



            </div>



            <h1 className="text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6" style={{ letterSpacing: '-0.02em' }}>The interview<br />



              <em className="not-italic text-[#1D5DFF]">before</em>the<br />interview.



            </h1>



            <p className="text-[#6E6D68] text-lg leading-relaxed mb-10 max-w-md font-inter">Practice realistic interviews with an AI that listens to how you speak, what you say, and how you present yourself.



            </p>



            <div className="flex items-center gap-4 flex-wrap">



              <button



                onClick={() =>navigate(isAuthenticated ? '/interview/setup' : '/register')}



                className="bg-[#111110] text-[#F6F5F0] px-6 py-3 rounded text-sm font-semibold hover:bg-[#1D5DFF] transition-colors duration-200"



              >



                {isAuthenticated ? 'Launch Interview Practice ' : 'Start practicing '}



              </button>



              <a href="#how-it-works" className="text-sm text-[#6E6D68] hover:text-[#111110] transition-colors flex items-center gap-2">



                <div className="w-8 h-8 rounded-full bg-[#111110] flex items-center justify-center">



                  <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-[#F6F5F0] ml-0.5" />



                </div>See how it works



              </a>



            </div>



          </div>



          <div>



            <HeroProduct />



          </div>



        </div>



      </section>







      {/* DIVIDER */}



      <div className="max-w-6xl mx-auto px-6">



        <div className="border-t border-[#E0DFD9]" />



      </div>







      {/*  RECENT SESSIONS SECTION (For Authenticated Users)  */}



      {isAuthenticated && stats?.recentSessions?.length >0 && (



        <section className="py-16 max-w-6xl mx-auto px-6">



          <div className="flex items-center justify-between mb-8">



            <div>



              <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6E6D68] font-medium">Recent Telemetry</div>



              <h2 className="text-2xl font-bold tracking-tight text-[#111110] mt-1">Your Latest Assessment Reports</h2>



            </div>



            <Link to="/history" className="text-xs font-mono font-semibold text-[#1D5DFF] hover:underline">View All History 



            </Link>



          </div>







          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">



            {stats.recentSessions.slice(0, 3).map((session) => (



              <div



                key={session._id}



                onClick={() =>navigate(`/report/${session._id}`)}



                className="bg-white border border-[#E0DFD9] hover:border-[#111110] rounded-2xl p-5 transition-all cursor-pointer shadow-sm flex flex-col justify-between"



              >



                <div className="space-y-2">



                  <div className="flex items-center justify-between">



                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#111110] text-white">



                      {session.interviewType || "Practice"}



                    </span>



                    <span className="text-xs font-mono text-[#6E6D68]">



                      {new Date(session.completedAt || session.createdAt).toLocaleDateString()}



                    </span>



                  </div>



                  <h3 className="font-bold text-[#111110] text-base">{session.role}</h3>



                </div>







                <div className="pt-4 mt-4 border-t border-[#E0DFD9] flex items-center justify-between">



                  <span className="text-xs text-[#6E6D68] font-inter">Overall Performance</span>



                  <span className="text-lg font-bold font-mono text-[#1D5DFF]">



                    {session.overallScore ? `${session.overallScore}%` : "Processing"}



                  </span>



                </div>



              </div>



            ))}



          </div>



        </section>



      )}







      {/*  NOT A CHATBOT  */}



      <section id="how-it-works" className="py-24 max-w-6xl mx-auto px-6">



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">



          <div>



            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6E6D68] mb-8 font-medium">How it works</div>



            <h2 className="text-5xl md:text-6xl font-bold leading-tight mb-6 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Not a chatbot.



              <br />An actual



              <br />interview.



            </h2>



            <p className="text-[#6E6D68] text-base leading-relaxed max-w-md font-inter">InterviewAI simulates the structure, pressure, and follow-up dynamics of a real interview  not a question-answer loop. You respond verbally. It listens. Then it pushes back.



            </p>



          </div>



          <div className="lg:pt-16">



            <InterviewFlow />



          </div>



        </div>



      </section>







      {/*  MULTIMODAL ANALYSIS  */}



      <section id="features" className="py-24 bg-[#111110] text-[#F0EEE8]">



        <div className="max-w-6xl mx-auto px-6">



          <div className="mb-16">



            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6E6D68] mb-6 font-medium">Multimodal analysis</div>



            <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>It evaluates more<br />than your answer.



            </h2>



          </div>



          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-[#2A2A28]">



            {[



              { label: 'FACE', items: ['Eye contact', 'Facial expression', 'Visual presence'] },



              { label: 'VOICE', items: ['Confidence', 'Fluency', 'Speaking pace'] },



              { label: 'ANSWER', items: ['Technical depth', 'Relevance', 'Clarity'] },



              { label: 'BEHAVIOR', items: ['Communication', 'Structure', 'Pressure response'] },



            ].map((dim, i) => (



              <div



                key={dim.label}



                className="p-6 border-r border-[#2A2A28] last:border-r-0"



              >



                <div



                  className="font-mono text-[11px] tracking-[0.18em] uppercase mb-4 font-medium"



                  style={{ color: i === 0 ? '#1D5DFF' : '#6E6D68' }}



                >



                  {dim.label}



                </div>



                <div className="flex flex-col gap-2">



                  {dim.items.map((item) => (



                    <div key={item} className="text-[#9A9990] text-sm font-inter">{item}</div>



                  ))}



                </div>



              </div>



            ))}



          </div>



          <div className="mt-12 border border-[#2A2A28] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">



            <div>



              <div className="font-mono text-[10px] tracking-widest text-[#6E6D68] uppercase mb-2">Combined score</div>



              <div className="text-6xl font-bold text-[#F0EEE8] font-mono">86</div>



            </div>



            <div className="flex-1 md:px-16">



              <p className="text-[#9A9990] text-base leading-relaxed italic font-inter">



                "You give strong technical explanations, but your answers become less structured when discussing unfamiliar problems."



              </p>



            </div>



            <button



              onClick={() =>navigate(isAuthenticated ? '/interview/setup' : '/register')}



              className="text-sm text-[#F0EEE8] border border-[#2A2A28] px-5 py-2.5 rounded hover:border-[#6E6D68] transition-colors whitespace-nowrap"



            >Start practicing now 



            </button>



          </div>



        </div>



      </section>







      {/*  LIVE INTERVIEW DEMO  */}



      <section className="py-24 bg-[#0D0D0C]">



        <div className="max-w-6xl mx-auto px-6">



          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">



            <div>



              <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6E6D68] mb-6 font-medium">Live interview room</div>



              <h2 className="text-4xl font-bold text-[#F0EEE8] tracking-tight" style={{ letterSpacing: '-0.02em' }}>The real experience.



              </h2>



            </div>



            <button



              onClick={() =>navigate(isAuthenticated ? '/interview/setup' : '/register')}



              className="bg-[#1D5DFF] text-white text-sm px-5 py-2.5 rounded hover:bg-[#154BD8] transition-colors self-start md:self-auto font-semibold"



            >Enter interview room 



            </button>



          </div>







          <div className="border border-[#2A2A28] rounded-lg overflow-hidden">



            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2A2A28] bg-[#161615]">



              <div className="flex items-center gap-3">



                <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />



                <span className="font-mono text-xs text-red-400 tracking-widest">LIVE INTERVIEW</span>



              </div>



              <div className="flex items-center gap-6">



                <span className="font-mono text-xs text-[#6E6D68]">04:32</span>



                <span className="font-mono text-xs text-[#6E6D68]">Question 04 / 10</span>



              </div>



            </div>



            <div className="grid grid-cols-1 md:grid-cols-3 min-h-[360px]">



              {/* Question */}



              <div className="col-span-2 p-8 border-r border-[#2A2A28] flex flex-col justify-between">



                <div>



                  <div className="font-mono text-[10px] text-[#6E6D68] tracking-widest uppercase mb-4">AI Interviewer</div>



                  <p className="text-[#F0EEE8] text-xl leading-relaxed font-medium mb-8 font-sans">



                    "Why did you choose MongoDB for this project?"



                  </p>



                  <div className="flex items-center gap-2 mb-4">



                    <span className="w-1.5 h-1.5 rounded-full bg-[#1D5DFF] inline-block animate-ping" />



                    <span className="font-mono text-xs text-[#1D5DFF]">Listening...</span>



                  </div>



                  <WaveformBars active={true} />



                </div>



                <div className="flex items-center gap-3 mt-8">



                  <div className="flex items-center gap-2 bg-[#1A1A18] border border-[#2A2A28] rounded px-3 py-2">



                    <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />



                    <span className="font-mono text-[10px] text-[#6E6D68]">Mic</span>



                  </div>



                  <div className="flex items-center gap-2 bg-[#1A1A18] border border-[#2A2A28] rounded px-3 py-2">



                    <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />



                    <span className="font-mono text-[10px] text-[#6E6D68]">Camera</span>



                  </div>



                  <button onClick={() =>navigate(isAuthenticated ? '/interview/setup' : '/register')} className="ml-auto font-mono text-[10px] text-red-400 border border-red-900/40 rounded px-3 py-2 hover:border-red-600/40 transition-colors">End interview



                  </button>



                </div>



              </div>



              {/* Analysis sidebar */}



              <div className="p-6 flex flex-col gap-5 bg-[#121211]">



                <div className="font-mono text-[10px] text-[#6E6D68] tracking-widest uppercase">Live analysis</div>



                {[



                  { label: 'Confidence', val: 87, color: '#1D5DFF' },



                  { label: 'Eye Contact', val: 74, color: '#22c55e' },



                  { label: 'Speaking Pace', val: 91, color: '#1D5DFF' },



                ].map((m) => (



                  <div key={m.label}>



                    <div className="flex justify-between text-[11px] mb-1.5 font-inter">



                      <span className="text-[#6E6D68]">{m.label}</span>



                      <span className="font-mono text-[#9A9990]">{m.val}</span>



                    </div>



                    <div className="h-px bg-[#2A2A28] relative">



                      <div className="absolute top-0 left-0 h-full" style={{ width: `${m.val}%`, backgroundColor: m.color, opacity: 0.7 }} />



                    </div>



                  </div>



                ))}



                <div className="mt-auto pt-4 border-t border-[#2A2A28]">



                  <div className="font-mono text-[10px] text-[#6E6D68] tracking-widest uppercase mb-2">Overall</div>



                  <div className="text-4xl font-bold text-[#F0EEE8] font-mono">84</div>



                </div>



              </div>



            </div>



          </div>



        </div>



      </section>







      {/*  PERFORMANCE REPORT  */}



      <section id="reports" className="py-24 max-w-6xl mx-auto px-6">



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">



          <div>



            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6E6D68] mb-6 font-medium">Performance reports</div>



            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" style={{ letterSpacing: '-0.02em' }}>Know exactly<br />what to improve.



            </h2>



            <p className="text-[#6E6D68] text-base leading-relaxed mb-8 max-w-sm font-inter">Every session generates a precise, actionable report  not vague encouragement. You'll know which dimension held you back and how to fix it.



            </p>



            <button



              onClick={() =>navigate(isAuthenticated ? '/interview/setup' : '/register')}



              className="text-sm text-[#111110] border border-[#E0DFD9] px-5 py-2.5 rounded hover:border-[#111110] transition-colors font-medium"



            >Start for free 



            </button>



          </div>



          <div className="border border-[#E0DFD9] rounded-lg p-8 bg-white shadow-sm">



            <div className="flex items-end justify-between mb-8 pb-6 border-b border-[#E0DFD9]">



              <div>



                <div className="font-mono text-[10px] tracking-widest text-[#6E6D68] uppercase mb-1">Interview Performance</div>



                <div className="text-[11px] text-[#9A9990] font-inter">Technical Interview  Today</div>



              </div>



              <div className="text-right">



                <div className="text-5xl font-bold font-mono">86</div>



                <div className="font-mono text-[10px] text-[#6E6D68] uppercase tracking-widest">Overall</div>



              </div>



            </div>



            <div className="flex flex-col gap-4 mb-8">



              <ScoreBar label="Communication" score={91} delay={0} />



              <ScoreBar label="Confidence" score={84} delay={80} />



              <ScoreBar label="Technical Depth" score={88} delay={160} />



              <ScoreBar label="Clarity" score={93} delay={240} />



              <ScoreBar label="Problem Solving" score={79} delay={320} />



            </div>



            <div className="bg-[#EBF1FF] border border-[#C6D8FF] rounded p-4">



              <div className="font-mono text-[10px] tracking-widest text-[#1D5DFF] uppercase mb-2 font-semibold">AI Insight</div>



              <p className="text-[#111110] text-sm leading-relaxed italic font-inter">



                "You give strong technical explanations, but your answers become less structured when discussing unfamiliar problems."



              </p>



            </div>



          </div>



        </div>



      </section>







      {/*  INTERVIEW TYPES  */}



      <section className="py-24 border-t border-[#E0DFD9]">



        <div className="max-w-6xl mx-auto px-6">



          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6E6D68] mb-8 font-medium">Interview modes</div>



          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-0 border border-[#E0DFD9]">



            {INTERVIEW_TYPES.map((type, i) => (



              <button



                key={type.label}



                onClick={() =>navigate('/interview/setup', { state: { type: type.id } })}



                className="p-6 text-left border-r border-[#E0DFD9] last:border-r-0 hover:bg-[#EDECE7] transition-colors group"



                style={{ backgroundColor: type.featured ? '#111110' : undefined }}



              >



                <div



                  className="font-mono text-[10px] tracking-[0.15em] uppercase mb-3"



                  style={{ color: type.featured ? '#1D5DFF' : '#6E6D68' }}



                >0{i + 1}



                </div>



                <div



                  className="font-semibold text-sm mb-2 group-hover:text-[#111110] transition-colors"



                  style={{ color: type.featured ? '#F0EEE8' : '#111110' }}



                >



                  {type.label}



                </div>



                <div



                  className="text-xs leading-relaxed font-inter"



                  style={{ color: type.featured ? '#6E6D68' : '#9A9990' }}



                >



                  {type.desc}



                </div>



              </button>



            ))}



          </div>



        </div>



      </section>







      {/*  FINAL CTA  */}



      <section className="py-32 max-w-6xl mx-auto px-6 text-center">



        <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6E6D68] mb-8 font-medium font-semibold">Get started</div>



        <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6" style={{ letterSpacing: '-0.02em' }}>Your next interview<br />starts here.



        </h2>



        <p className="text-[#6E6D68] text-lg mb-10 max-w-md mx-auto font-inter">Practice under pressure. Understand your weaknesses. Walk into the real interview prepared.



        </p>



        <button



          onClick={() =>navigate(isAuthenticated ? '/interview/setup' : '/register')}



          className="bg-[#111110] text-[#F6F5F0] px-8 py-4 rounded text-base font-semibold hover:bg-[#1D5DFF] transition-colors duration-200 shadow-md"



        >



          {isAuthenticated ? 'Launch Interview Practice ' : 'Start practicing '}



        </button>



      </section>







      {/*  FOOTER  */}



      <footer className="border-t border-[#E0DFD9] bg-[#F6F5F0]">



        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">



          <div className="col-span-2 md:col-span-1">



            <div className="font-mono text-sm font-semibold tracking-wider mb-3">INTERVIEWAI</div>



            <p className="text-xs text-[#9A9990] leading-relaxed font-inter">The interview before the interview.



            </p>



          </div>



          {[



            { label: 'Product', links: ['Features', 'How it works', 'Reports'] },



            { label: 'Resources', links: ['Documentation', 'Help'] },



            { label: 'Company', links: ['About', 'Privacy', 'Terms'] },



          ].map((col) => (



            <div key={col.label}>



              <div className="font-mono text-[10px] tracking-widest uppercase text-[#6E6D68] mb-4">{col.label}</div>



              <div className="flex flex-col gap-3">



                {col.links.map((l) => (



                  <a key={l} href="#" className="text-sm text-[#9A9990] hover:text-[#111110] transition-colors font-inter">{l}</a>



                ))}



              </div>



            </div>



          ))}



        </div>



        <div className="border-t border-[#E0DFD9] px-6 py-4 max-w-6xl mx-auto flex justify-between items-center">



          <span className="font-mono text-[10px] text-[#9A9990]"> 2026 InterviewAI</span>



          <span className="font-mono text-[10px] text-[#C0BFB9]">All rights reserved</span>



        </div>



      </footer>



    </div>



  )



}



