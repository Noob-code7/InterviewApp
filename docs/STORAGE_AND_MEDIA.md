# Media Storage & Ephemeral Lifecycle — InterviewAI

## 1. Universal Storage Abstraction Layer

InterviewAI implements a unified storage service in [`backend/services/storageService.js`](file:///C:/Workspace/Workspace/InterviewApp/backend/services/storageService.js) that operates transparently across both **Cloud Object Storage (Cloudflare R2 / AWS S3)** and **Local Filesystem Storage**:

```mermaid
flowchart TD
    Client["Client / AI Microservice"] --> StorageAPI["storageService.js Abstraction"]
    
    StorageAPI --> CheckEnv{"R2 / S3 Credentials Set in .env?"}
    
    CheckEnv -- Yes --> Cloud["Cloudflare R2 / AWS S3"]
    Cloud --> Presigned["Generate Pre-Signed PUT / GET URLs"]
    Cloud --> S3Stream["Fetch Object Buffers via S3Client"]
    
    CheckEnv -- No --> Local["Local Disk Storage (backend/uploads/)"]
    Local --> LocalRoute["Express Static /uploads Middleware"]
    Local --> FsStream["fs.readFileSync / fs.writeFileSync"]
```

---

## 2. Cloudflare R2 / AWS S3 Direct Upload Flow

In production cloud environments, client browsers upload large video/audio WebM recordings **directly to Cloudflare R2** via pre-signed PUT URLs. This keeps video upload traffic off the Node.js API gateway, preventing CPU starvation and network bottlenecks:

```mermaid
sequenceDiagram
    autonumber
    actor Browser as Candidate Browser
    participant API as Express API (:5000)
    participant R2 as Cloudflare R2 Object Storage
    
    Browser->>API: GET /api/storage/presigned-upload-url?key=answers/123/q1.webm
    API->>API: Sign S3 PutObjectCommand (expires in 900s)
    API-->>Browser: Return { uploadUrl, key, fileUrl }
    Browser->>R2: HTTP PUT Binary WebM Stream (Direct)
    R2-->>Browser: 200 OK
    Browser->>API: POST /api/sessions/123/answers (key, transcript)
```

---

## 3. Ephemeral Media Lifecycle & Auto-Cleanup

Video files recorded during an interview are large (~10–30 MB per session). To prevent disk exhaustion and respect candidate data privacy:
1. Media is retained temporarily while the multi-modal analysis pipeline executes.
2. Once Face, Voice, and NLP analysis complete and scores are written to MongoDB, [`backend/services/storageService.js`](file:///C:/Workspace/Workspace/InterviewApp/backend/services/storageService.js) unlinks the raw video recordings from disk or triggers `DeleteObjectCommand` on R2.
