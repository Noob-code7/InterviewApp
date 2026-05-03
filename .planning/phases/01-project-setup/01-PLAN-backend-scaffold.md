---
id: 01-PLAN-backend-scaffold
wave: 1
depends_on: []
files_modified:
  - backend/package.json
  - backend/server.js
  - backend/app.js
  - backend/routes/.gitkeep
  - backend/controllers/.gitkeep
  - backend/models/.gitkeep
  - backend/middleware/.gitkeep
  - backend/jobs/.gitkeep
  - backend/services/.gitkeep
  - backend/utils/.gitkeep
  - backend/.env.example
  - backend/.gitignore
  - backend/config/db.js
autonomous: true
requirements:
  - REQ-platform-arch
---

# Plan: Backend Scaffold (Node.js + Express)

## Goal
Bootstrap the Express.js backend with MongoDB Atlas connection (via Mongoose), Redis connection check, CORS, Helmet, Morgan, and a clean folder structure.

## Tasks

<task id="2.1">
  <title>Initialize Node/Express project</title>
  <read_first>
    - (none — new directory)
  </read_first>
  <action>
    Create backend/ directory at workspace root.
    Inside backend/, run:
    ```
    npm init -y
    ```

    Install dependencies:
    ```
    npm install express mongoose dotenv cors helmet morgan bcryptjs jsonwebtoken cookie-parser express-rate-limit
    npm install -D nodemon
    ```

    Set backend/package.json scripts:
    ```json
    {
      "scripts": {
        "start": "node server.js",
        "dev": "nodemon server.js"
      },
      "type": "module"
    }
    ```

    Note: Use ES Modules (`"type": "module"`) for consistency with the frontend.
  </action>
  <acceptance_criteria>
    - backend/package.json exists and has `"type": "module"`
    - backend/node_modules/express exists
    - backend/node_modules/mongoose exists
    - backend/node_modules/helmet exists
  </acceptance_criteria>
</task>

<task id="2.2">
  <title>Create app.js with Express setup and middleware</title>
  <read_first>
    - backend/package.json
  </read_first>
  <action>
    Create backend/app.js:
    ```js
    import express from 'express'
    import cors from 'cors'
    import helmet from 'helmet'
    import morgan from 'morgan'
    import cookieParser from 'cookie-parser'
    import rateLimit from 'express-rate-limit'

    const app = express()

    // Security middleware
    app.use(helmet())
    app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    }))

    // Rate limiting on all routes (adjust per-route in Phase 2)
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
    })
    app.use(limiter)

    // Body parsing
    app.use(express.json({ limit: '10mb' }))
    app.use(express.urlencoded({ extended: true }))
    app.use(cookieParser())

    // HTTP logging
    app.use(morgan('dev'))

    // Health check
    app.get('/health', (req, res) => {
      res.json({ success: true, data: { status: 'OK', timestamp: new Date().toISOString() } })
    })

    // API route stubs — will be filled in per phase
    app.get('/api', (req, res) => {
      res.json({ success: true, data: { message: 'AI Interview API v1' } })
    })

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ success: false, error: 'Route not found' })
    })

    // Global error handler
    app.use((err, req, res, _next) => {
      console.error(err.stack)
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
      })
    })

    export default app
    ```
  </action>
  <acceptance_criteria>
    - backend/app.js exists
    - backend/app.js contains `helmet()`
    - backend/app.js contains `cors(`
    - backend/app.js contains `rateLimit(`
    - backend/app.js contains `app.get('/health'`
    - backend/app.js contains `export default app`
  </acceptance_criteria>
</task>

<task id="2.3">
  <title>Create MongoDB connection module</title>
  <read_first>
    - backend/app.js
  </read_first>
  <action>
    Create backend/config/ directory.
    Create backend/config/db.js:
    ```js
    import mongoose from 'mongoose'

    const connectDB = async () => {
      try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
        })
        console.log(`✅ MongoDB connected: ${conn.connection.host}`)
      } catch (error) {
        console.error(`❌ MongoDB connection error: ${error.message}`)
        process.exit(1)
      }
    }

    export default connectDB
    ```
  </action>
  <acceptance_criteria>
    - backend/config/db.js exists
    - backend/config/db.js contains `mongoose.connect(process.env.MONGODB_URI`
    - backend/config/db.js contains `export default connectDB`
  </acceptance_criteria>
</task>

<task id="2.4">
  <title>Create server.js entry point</title>
  <read_first>
    - backend/app.js
    - backend/config/db.js
  </read_first>
  <action>
    Create backend/server.js:
    ```js
    import 'dotenv/config'
    import app from './app.js'
    import connectDB from './config/db.js'

    const PORT = process.env.PORT || 5000

    // Connect to MongoDB, then start server
    connectDB().then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`)
        console.log(`   Health: http://localhost:${PORT}/health`)
      })
    })
    ```
  </action>
  <acceptance_criteria>
    - backend/server.js exists
    - backend/server.js contains `import 'dotenv/config'`
    - backend/server.js contains `connectDB().then(`
    - backend/server.js contains `app.listen(PORT`
  </acceptance_criteria>
</task>

<task id="2.5">
  <title>Create folder structure, .env.example, and .gitignore</title>
  <read_first>
    - backend/server.js
  </read_first>
  <action>
    Create empty directories with .gitkeep files:
    - backend/routes/.gitkeep
    - backend/controllers/.gitkeep
    - backend/models/.gitkeep
    - backend/middleware/.gitkeep
    - backend/jobs/.gitkeep
    - backend/services/.gitkeep
    - backend/utils/.gitkeep

    Create backend/utils/response.js (standard response helper):
    ```js
    /**
     * Standard JSON response format: { success, data, error }
     */
    export const sendSuccess = (res, data, statusCode = 200) => {
      return res.status(statusCode).json({ success: true, data })
    }

    export const sendError = (res, message, statusCode = 500) => {
      return res.status(statusCode).json({ success: false, error: message })
    }
    ```

    Create backend/.env.example:
    ```
    PORT=5000
    MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/interviewapp
    JWT_ACCESS_SECRET=your_access_token_secret_here
    JWT_REFRESH_SECRET=your_refresh_token_secret_here
    JWT_ACCESS_EXPIRES=15m
    JWT_REFRESH_EXPIRES=7d
    FRONTEND_URL=http://localhost:5173
    CLOUDINARY_CLOUD_NAME=
    CLOUDINARY_API_KEY=
    CLOUDINARY_API_SECRET=
    REDIS_URL=redis://localhost:6379
    ```

    Create backend/.gitignore:
    ```
    node_modules/
    .env
    ```
  </action>
  <acceptance_criteria>
    - backend/routes/ directory exists
    - backend/controllers/ directory exists
    - backend/models/ directory exists
    - backend/utils/response.js exists and contains `sendSuccess`
    - backend/.env.example exists and contains `MONGODB_URI`
    - backend/.env.example contains `JWT_ACCESS_SECRET`
    - backend/.gitignore contains `node_modules/`
  </acceptance_criteria>
</task>

## Verification

```bash
# Verify the server starts without crashing (MongoDB will fail without .env, that's OK)
cd backend && node --input-type=module --eval "import('./app.js').then(() => console.log('APP_OK'))"
```

## must_haves
- [ ] backend/app.js loads without syntax errors
- [ ] Helmet, CORS, rate limiter, morgan all mounted
- [ ] `/health` endpoint returns `{ success: true, data: { status: 'OK' } }`
- [ ] MongoDB connection module exists and references `process.env.MONGODB_URI`
- [ ] Standard response helper `sendSuccess` / `sendError` exists
- [ ] `.env.example` documents all required secrets
