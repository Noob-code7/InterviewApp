import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsApi } from '../api/sessions.js'
import useAuthStore from '../store/authStore.js'
import { Button, Card } from '../components/ui/index.js'

const INTERVIEW_TYPES = [
  { id: 'hr',        label: 'Start HR Interview',        desc: 'Behavioral & Cultural fit',        icon: '👥' },
  { id: 'technical', label: 'Start Technical Interview', desc: 'Coding & Systems design',          icon: '💻' },
  { id: 'resume',    label: 'Resume Based Interview',    desc: 'Deep dive into your past roles',   icon: '📄' },
  { id: 'company',   label: 'Company Specific Practice', desc: 'FAANG & Fortune 500 patterns',     icon: '🏢' },
]

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sessionsApi.getStats()
      .then(({ data }) => setStats(data.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-brand-border py-10">
        <div className="page-container flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold text-brand-text leading-tight mb-2">
              Practice Smarter.<br />
              <span className="text-primary">Get Hired Faster.</span>
            </h1>
            <p className="text-brand-muted mb-6 max-w-md">
              AI-powered mock interviews with voice, video, and writing analysis.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/interview/setup')}>Start Interview</Button>
              <Button variant="outline" onClick={() => navigate('/history')}>View Reports</Button>
            </div>
          </div>

          {/* AI Coach image placeholder — replaced when video model is integrated */}
          <div className="w-full md:w-96 h-56 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white/40 text-sm font-medium shrink-0 relative overflow-hidden">
            <div className="text-center z-10">
              <div className="text-4xl mb-2">🤖</div>
              <span>AI Coach Active</span>
            </div>
            {/* Decorative circles */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-2xl"></div>
          </div>
        </div>
      </section>

      <div className="page-container py-8 space-y-8">
        
        {/* ── Stats Row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="flex flex-col gap-2">
            <span className="stat-label">Interviews Completed</span>
            {loading ? <div className="skeleton h-8 w-16 mt-1" /> : (
              <span className="text-3xl font-bold text-brand-text">{stats?.stats?.interviewsCompleted || 0}</span>
            )}
          </Card>
          
          <Card className="flex flex-col gap-2">
            <span className="stat-label">Confidence Score</span>
            {loading ? <div className="skeleton h-8 w-16 mt-1" /> : (
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-3xl font-bold text-brand-text">
                  {stats?.stats?.avgConfidenceScore ? `${stats.stats.avgConfidenceScore}%` : '--'}
                </span>
                <div className="progress-bar w-full">
                  <div className="progress-bar-fill" style={{ width: `${stats?.stats?.avgConfidenceScore || 0}%` }}></div>
                </div>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2">
            <span className="stat-label">Writing Score</span>
            {loading ? <div className="skeleton h-8 w-16 mt-1" /> : (
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-3xl font-bold text-brand-text">
                  {stats?.stats?.avgWritingScore ? `${stats.stats.avgWritingScore}%` : '--'}
                </span>
                <div className="progress-bar w-full">
                  <div className="progress-bar-fill bg-cyan-400" style={{ width: `${stats?.stats?.avgWritingScore || 0}%` }}></div>
                </div>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2">
            <span className="stat-label">Readiness Score</span>
            {loading ? <div className="skeleton h-8 w-24 mt-1" /> : (
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-3xl font-bold text-primary">
                  {stats?.stats?.avgOverallScore ? (stats.stats.avgOverallScore >= 80 ? 'High' : 'Medium') : '--'}
                </span>
                <span className="text-sm font-medium text-brand-text flex items-center gap-1">
                  {stats?.stats?.avgOverallScore >= 80 ? '✅ Market Ready' : 'Needs Practice'}
                </span>
              </div>
            )}
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* ── Main Content (Left 2/3) ──────────────────────────────────────── */}
          <div className="md:col-span-2 space-y-8">
            
            {/* Interview Types */}
            <div className="grid sm:grid-cols-2 gap-4">
              {INTERVIEW_TYPES.map(({ id, label, desc, icon }) => (
                <button
                  key={id}
                  onClick={() => navigate('/interview/setup', { state: { type: id } })}
                  className="card p-5 flex items-start gap-4 text-left hover:border-primary hover:shadow-md transition-all active:scale-[0.99] group"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-bg flex items-center justify-center text-xl shrink-0 group-hover:bg-primary-light transition-colors">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand-text mb-1">{label}</h3>
                    <p className="text-sm text-brand-muted">{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Weekly Chart */}
            <Card className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-brand-text text-lg">Confidence Improvement</h3>
                  <p className="text-sm text-brand-muted">Weekly progress over time</p>
                </div>
                <span className="badge badge-primary">AI INSIGHTS</span>
              </div>

              {/* Dummy chart for Phase 3 */}
              <div className="h-48 flex items-end justify-between gap-2 pt-4 border-b border-brand-border pb-2 px-2">
                {[45, 52, 40, 68, 55, 78, 85].map((score, i) => (
                  <div key={i} className="w-full flex flex-col items-center gap-2 group">
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80 ${i === 6 ? 'bg-primary' : i === 3 ? 'bg-primary/40' : 'bg-brand-border/60'}`} 
                      style={{ height: `${score}%` }}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-2">
                {['MON','TUE','WED','THU','FRI','SAT','TODAY'].map((day, i) => (
                  <span key={day} className={`text-[10px] font-semibold tracking-wider ${i === 6 ? 'text-primary' : 'text-brand-subtle'}`}>{day}</span>
                ))}
              </div>

              <div className="bg-primary-light rounded-lg p-4 flex gap-3 text-sm">
                <span className="text-primary text-xl leading-none">✨</span>
                <p className="text-primary-dark">
                  <strong>AI Tip:</strong> You've shown significant improvement in articulation. Focusing on your "Impact Statements" could boost your confidence by another 12%.
                </p>
              </div>
            </Card>

          </div>

          {/* ── Sidebar (Right 1/3) ──────────────────────────────────────────── */}
          <div className="space-y-4">
            <h3 className="font-bold text-brand-text text-lg mb-1">Recent Reports</h3>
            <p className="text-sm text-brand-muted mb-4">Your last 3 sessions</p>

            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="skeleton h-24 w-full" />)
            ) : stats?.recentSessions?.length > 0 ? (
              <div className="space-y-3">
                {stats.recentSessions.map(session => (
                  <Card key={session._id} className="p-4 hover:border-brand-text/20 transition-colors cursor-pointer" onClick={() => navigate(`/report/${session._id}`)}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-brand-text line-clamp-1">{session.role}</h4>
                      {session.overallScore && (
                        <span className={`badge ${session.overallScore >= 80 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {session.overallScore}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-brand-subtle font-medium">
                      <span className="flex items-center gap-1">
                        📅 {new Date(session.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {session.durationLabel && (
                        <span className="flex items-center gap-1">
                          ⏱️ {session.durationLabel}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
                <Button variant="ghost" className="w-full text-primary" onClick={() => navigate('/history')}>
                  See All History →
                </Button>
              </div>
            ) : (
              <Card className="text-center py-10 bg-brand-bg/50 border-dashed">
                <span className="text-3xl mb-2 block">📄</span>
                <p className="text-sm text-brand-muted font-medium mb-1">No sessions yet</p>
                <p className="text-xs text-brand-subtle">Complete an interview to see reports here.</p>
              </Card>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
