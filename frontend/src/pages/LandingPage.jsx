import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
    title: 'Live Video Analysis',
    desc: 'AI monitors your facial expressions and confidence posture in real time during the interview.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    title: 'Voice Confidence Score',
    desc: 'Whisper AI transcribes your speech and scores clarity, pace, filler words, and tone.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'NLP Answer Scoring',
    desc: 'GPT-4 evaluates the relevance, structure, grammar, and completeness of every answer.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    title: 'Writing Assessment',
    desc: 'Timed email and communication tasks with live grammar, tone, and clarity scoring.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Detailed Reports',
    desc: 'Full performance breakdown with strengths, weaknesses, and personalised action plans.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Progress Tracking',
    desc: 'Track your confidence score, fluency, and answer quality across sessions over time.',
  },
]

const STATS = [
  { value: '10K+', label: 'Job seekers helped' },
  { value: '85%',  label: 'Saw confidence increase' },
  { value: '3×',   label: 'More interview callbacks' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">

      {/* ── Navbar (minimal, no auth) ─────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-brand-border">
        <div className="page-container flex items-center justify-between h-16">
          <span className="text-xl font-bold">
            <span className="text-brand-text">Interview</span>
            <span className="text-primary">AI</span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Log in
            </Button>
            <Button size="sm" onClick={() => navigate('/register')}>
              Get started free
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="page-container pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 badge badge-primary mb-6 text-sm">
          <span>✨</span>
          <span>AI-Powered Interview Coach</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold text-brand-text leading-tight mb-6">
          Practice Smarter.<br />
          <span className="text-primary">Get Hired Faster.</span>
        </h1>

        <p className="text-lg text-brand-muted max-w-2xl mx-auto mb-10 leading-relaxed">
          Real-time AI analyzes your face, voice, and answers during mock interviews.
          Get detailed feedback on confidence, communication, and technical depth.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap mb-6">
          <Button size="lg" onClick={() => navigate('/register')} className="px-8">
            Start for free →
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </div>

        <p className="text-xs text-brand-subtle">
          No credit card required · 3 free sessions included · Cancel anytime
        </p>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-extrabold text-primary">{value}</p>
              <p className="text-xs text-brand-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────── */}
      <section className="bg-brand-bg py-20">
        <div className="page-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-brand-text mb-4">
              Everything you need to ace your interview
            </h2>
            <p className="text-brand-muted max-w-xl mx-auto">
              From HR rounds to technical panels — our AI coach analyses every dimension of your performance.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="card p-6 hover:shadow-modal transition-shadow duration-200 group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                  {icon}
                </div>
                <h3 className="font-semibold text-brand-text mb-2">{title}</h3>
                <p className="text-sm text-brand-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA section ──────────────────────────────────────────── */}
      <section className="page-container py-20 text-center">
        <div className="card p-14 bg-gradient-to-br from-primary to-primary-dark text-white border-0">
          <h2 className="text-3xl font-bold mb-4">
            Ready to land your dream job?
          </h2>
          <p className="text-white/80 mb-8 max-w-md mx-auto">
            Join thousands of candidates who improved their interview confidence with AI coaching.
          </p>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/register')}
            className="bg-white text-primary border-white hover:bg-white/90 px-10"
          >
            Get started for free
          </Button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-brand-border py-8">
        <div className="page-container flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold">
            <span className="text-brand-text">Interview</span>
            <span className="text-primary">AI</span>
          </span>
          <p className="text-xs text-brand-subtle">© 2026 InterviewAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
