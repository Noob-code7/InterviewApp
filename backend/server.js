import 'dotenv/config'
import app from './app.js'
import connectDB from './config/db.js'

const PORT = process.env.PORT || 5000

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`   Health: http://localhost:${PORT}/health`)
    console.log(`   API:    http://localhost:${PORT}/api`)
  })
})
