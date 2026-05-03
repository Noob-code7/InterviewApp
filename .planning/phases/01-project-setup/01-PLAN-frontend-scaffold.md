---
id: 01-PLAN-frontend-scaffold
wave: 1
depends_on: []
files_modified:
  - frontend/package.json
  - frontend/vite.config.js
  - frontend/tailwind.config.js
  - frontend/postcss.config.js
  - frontend/index.html
  - frontend/src/main.jsx
  - frontend/src/App.jsx
  - frontend/src/index.css
  - frontend/src/pages/.gitkeep
  - frontend/src/components/.gitkeep
  - frontend/src/store/.gitkeep
  - frontend/src/hooks/.gitkeep
  - frontend/src/utils/.gitkeep
  - frontend/src/api/.gitkeep
  - frontend/.env.example
  - frontend/.gitignore
autonomous: true
requirements:
  - REQ-platform-arch
---

# Plan: Frontend Scaffold (React + Vite + Tailwind)

## Goal
Bootstrap the React + Vite frontend with Tailwind CSS, React Router v6, Zustand, and Axios. Create the complete folder structure with placeholder files and a working dev server.

## Tasks

<task id="1.1">
  <title>Bootstrap Vite React app</title>
  <read_first>
    - package.json (root, if exists)
  </read_first>
  <action>
    Run in the workspace root:
    ```
    npm create vite@latest frontend -- --template react
    cd frontend
    npm install
    ```
    This produces: frontend/package.json, frontend/vite.config.js, frontend/index.html, frontend/src/main.jsx, frontend/src/App.jsx, frontend/src/App.css, frontend/src/index.css.

    Delete the boilerplate files: frontend/src/App.css, frontend/src/assets/react.svg, frontend/public/vite.svg.

    Clear frontend/src/App.jsx to a minimal shell:
    ```jsx
    function App() {
      return <div>AI Interview Practice Platform</div>;
    }
    export default App;
    ```

    Clear frontend/src/index.css to just the Tailwind directives (will be added in task 1.2).
  </action>
  <acceptance_criteria>
    - frontend/package.json exists and contains `"name": "frontend"`
    - frontend/vite.config.js exists
    - frontend/src/main.jsx exists
    - frontend/src/App.jsx contains `export default App`
    - Running `npm run dev` inside frontend/ starts a server on port 5173 without errors
  </acceptance_criteria>
</task>

<task id="1.2">
  <title>Install and configure Tailwind CSS</title>
  <read_first>
    - frontend/package.json
    - frontend/vite.config.js
  </read_first>
  <action>
    Inside frontend/:
    ```
    npm install -D tailwindcss postcss autoprefixer
    npx tailwindcss init -p
    ```

    Set frontend/tailwind.config.js content:
    ```js
    /** @type {import('tailwindcss').Config} */
    export default {
      content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
      ],
      theme: {
        extend: {},
      },
      plugins: [],
    }
    ```

    Set frontend/src/index.css content:
    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    ```

    Set frontend/postcss.config.js content:
    ```js
    export default {
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/tailwind.config.js exists and contains `content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]`
    - frontend/postcss.config.js exists and contains `tailwindcss` and `autoprefixer` keys
    - frontend/src/index.css starts with `@tailwind base;`
    - `npm run build` inside frontend/ exits with code 0
  </acceptance_criteria>
</task>

<task id="1.3">
  <title>Install React Router v6, Zustand, Axios</title>
  <read_first>
    - frontend/package.json
  </read_first>
  <action>
    Inside frontend/:
    ```
    npm install react-router-dom@6 zustand axios react-hot-toast
    ```

    Wrap App with BrowserRouter in frontend/src/main.jsx:
    ```jsx
    import React from 'react'
    import ReactDOM from 'react-dom/client'
    import { BrowserRouter } from 'react-router-dom'
    import App from './App.jsx'
    import './index.css'

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    )
    ```

    Update frontend/src/App.jsx to scaffold all route placeholders:
    ```jsx
    import { Routes, Route } from 'react-router-dom'

    // Placeholder pages — will be replaced in later phases
    const Placeholder = ({ name }) => <div className="p-8 text-2xl">{name} — Coming Soon</div>

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
    ```
  </action>
  <acceptance_criteria>
    - frontend/package.json dependencies contain `"react-router-dom"`, `"zustand"`, `"axios"`, `"react-hot-toast"`
    - frontend/src/main.jsx contains `BrowserRouter`
    - frontend/src/App.jsx contains `Routes` and route for `/dashboard`
    - `npm run build` exits with code 0
  </acceptance_criteria>
</task>

<task id="1.4">
  <title>Create folder structure and placeholder files</title>
  <read_first>
    - frontend/src/App.jsx
  </read_first>
  <action>
    Create the following directory structure inside frontend/src/:
    - pages/ (with .gitkeep)
    - components/ (with .gitkeep)
    - store/ (with .gitkeep)
    - hooks/ (with .gitkeep)
    - utils/ (with .gitkeep)
    - api/ (with .gitkeep)

    Create frontend/src/store/authStore.js (minimal Zustand stub):
    ```js
    import { create } from 'zustand'

    const useAuthStore = create((set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null }),
    }))

    export default useAuthStore
    ```

    Create frontend/src/api/axios.js:
    ```js
    import axios from 'axios'

    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      withCredentials: true,
    })

    // Request interceptor: attach token if present
    api.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken')
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })

    export default api
    ```

    Create frontend/.env.example:
    ```
    VITE_API_URL=http://localhost:5000
    ```

    Create frontend/.gitignore (if not already present from Vite):
    ```
    node_modules/
    dist/
    .env
    .env.local
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/store/authStore.js exists and contains `useAuthStore`
    - frontend/src/api/axios.js exists and contains `baseURL`
    - frontend/.env.example exists and contains `VITE_API_URL`
    - frontend/src/pages/ directory exists
    - frontend/src/components/ directory exists
  </acceptance_criteria>
</task>

## Verification

```bash
cd frontend && npm run build
```
Exit code 0. No TypeScript/lint errors.

## must_haves
- [ ] Vite dev server starts without errors (`npm run dev`)
- [ ] All 11 route placeholders are defined in App.jsx
- [ ] Tailwind CSS is configured and processes utility classes
- [ ] Zustand auth store stub exists
- [ ] Axios API client stub with baseURL exists
