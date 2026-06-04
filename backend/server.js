import 'dotenv/config'
import app from './app.js'
import connectDB from './config/db.js'
import { recoverJobs } from './services/analysisService.js'

const PORT = process.env.PORT || 5000

connectDB().then(async () => {
  // Start job recovery for any stuck jobs
  try {
    await recoverJobs()
  } catch (err) {
    console.error('Failed to run job recovery:', err)
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`   Health: http://localhost:${PORT}/health`)
    console.log(`   API:    http://localhost:${PORT}/api`)
  })
})
