# Media Storage Abstraction & Ephemeral Lifecycle — InterviewAI

## 1. Storage Abstraction Architecture

InterviewAI implements a unified storage service in [`backend/services/storageService.js`](file:///C:/Workspace/Workspace/InterviewApp/backend/services/storageService.js) that operates transparently across both **Cloud Object Storage (Cloudflare R2 / AWS S3)** and **Local Filesystem Storage**:

```mermaid
flowchart TD
    Client["Client Browser / AI Microservice"] --> StorageAPI["storageService.js Abstraction"]
    
    StorageAPI --> CheckEnv{"R2 / S3 Credentials Set in .env?"}
    
    CheckEnv -- Yes --> CloudStorage["Cloudflare R2 / AWS S3 Storage"]
    CloudStorage --> PresignedURL["Generate Pre-Signed Direct PUT URLs (expires in 900s)"]
    CloudStorage --> S3Buffer["Fetch Object Buffers via S3 GetObjectCommand"]
    CloudStorage --> S3Delete["Delete Object via DeleteObjectCommand"]
    
    CheckEnv -- No --> LocalDisk["Local Disk Storage (backend/uploads/)"]
    LocalDisk --> LocalStatic["Express Static /uploads Middleware"]
    LocalDisk --> LocalBuffer["fs.readFileSync / fs.writeFileSync"]
    LocalDisk --> LocalDelete["fs.unlinkSync"]
```

---

## 2. Cloudflare R2 / AWS S3 Direct Upload Flow

In production cloud environments, client browsers upload large video/audio WebM recordings **directly to Cloudflare R2** via pre-signed PUT URLs. This keeps video upload traffic completely off the Node.js API gateway, preventing CPU starvation:

```mermaid
sequenceDiagram
    autonumber
    actor Browser as Candidate Browser
    participant API as Express API (:5000)
    participant R2 as Cloudflare R2 Storage
    
    Browser->>API: GET /api/storage/presigned-upload-url?key=answers/123/q1.webm
    API->>API: Sign S3 PutObjectCommand (expires in 900s)
    API-->>Browser: Return { uploadUrl, key, fileUrl }
    Browser->>R2: HTTP PUT Binary WebM Stream (Direct)
    R2-->>Browser: 200 OK
    Browser->>API: POST /api/sessions/123/answers (key, transcript)
```

---

## 3. Ephemeral Media Lifecycle & Auto-Cleanup

Video files recorded during an interview are large (~10–30 MB per session). To prevent disk exhaustion:
1. Media is retained temporarily while the multi-modal analysis pipeline executes.
2. Once Face, Voice, and NLP analysis complete and scores are written to MongoDB, [`backend/services/storageService.js`](file:///C:/Workspace/Workspace/InterviewApp/backend/services/storageService.js) unlinks the raw video recordings from disk or deletes the object from R2.
