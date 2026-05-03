import { Routes, Route } from 'react-router-dom'

// Placeholder pages — replaced in later phases
const Placeholder = ({ name }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-white mb-2">{name}</h1>
      <p className="text-gray-400">Coming soon — being built in a later phase</p>
    </div>
  </div>
)

function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder name="Landing" />} />
      <Route path="/login" element={<Placeholder name="Login" />} />
      <Route path="/register" element={<Placeholder name="Register" />} />
      <Route path="/dashboard" element={<Placeholder name="Dashboard" />} />
      <Route path="/interview/setup" element={<Placeholder name="Interview Setup" />} />
      <Route path="/interview/live/:sessionId" element={<Placeholder name="Live Interview" />} />
      <Route path="/interview/writing/:sessionId" element={<Placeholder name="Writing Test" />} />
      <Route path="/interview/processing" element={<Placeholder name="Processing" />} />
      <Route path="/report/:sessionId" element={<Placeholder name="Report" />} />
      <Route path="/history" element={<Placeholder name="History" />} />
      <Route path="/profile" element={<Placeholder name="Profile" />} />
    </Routes>
  )
}

export default App
