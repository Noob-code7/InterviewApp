# Multi-Modal AI Pipelines — InterviewAI

## 1. Overview

InterviewAI evaluates candidate performance across three independent AI microservices running on dedicated ports:

```text
ai-services/
├── face-service/     (:8001)  -> OpenCV + DeepFace (VGG-Face)
├── voice-service/    (:8002)  -> Wav2Vec 2.0 PyTorch SER + Kokoro-82M ONNX TTS
└── nlp-service/      (:8003)  -> Calibrated Local NLP + Resume Parser + LLM Router
```

---

## 2. Face Analysis Pipeline (`ai-services/face-service/`)

### 2.1 Video Ingestion & Frame Sampling
- **Input**: Spoken answer video recording (`.webm` or `.mp4`).
- **Processing**: OpenCV reads video frames at adaptive intervals (every $N = 30$ frames at 30 fps $\approx 1$ frame/sec).
- **Face Detection**: Extracts bounding boxes and facial landmark coordinates.

### 2.2 Emotion & Expressiveness Scoring
- **Emotions Extracted**: `neutral`, `happy`, `surprise`, `fear`, `sad`, `angry`, `disgust`.
- **Confidence Computation**:
  $$\text{Confidence} = (\text{neutral} \times 0.7 + \text{happy} \times 0.9 + \text{surprise} \times 0.3) - (1.2 \times \text{fear} + 1.2 \times \text{sad} + 1.5 \times \text{angry} + 1.5 \times \text{disgust})$$

### 2.3 Gaze, Attention & Face Substitution Guard
- **Eye Contact & Attention**: Evaluates face pose angle and bounding box centrality.
- **Identity Verification**: If an initial reference photo was captured at interview start, DeepFace runs `VGG-Face` cosine distance verification against candidate frames. If the identity shifts mid-interview, `faceSubstitutionAlert: true` is flagged in the report.
- **Zero-Latency Pre-Bake**: Model weights are pre-baked during Docker image build and eagerly warmed up on server boot (`@app.on_event("startup")`), eliminating the 60-second first-request delay.

---

## 3. Voice Analysis Pipeline (`ai-services/voice-service/`)

### 3.1 Speech Emotion Recognition (SER)
- **Model**: Fine-tuned **Wav2Vec 2.0** PyTorch model (`best_model_path.pth`).
- **Input**: 16kHz mono audio waveform extracted from candidate answers.
- **Metrics Extracted**:
  - `confidenceScore`: Vocal stability and clarity index ($0 - 100$).
  - `nervousnessScore`: Jitter, pitch variance, and vocal hesitation markers.
  - `toneDistribution`: Granular breakdown of emotional probabilities.

### 3.2 Kokoro-82M ONNX Neural TTS
- **Engine**: High-speed ONNX runtime executing Kokoro-82M fp16 model (`kokoro-v1.0.fp16.onnx` + `voices-v1.0.bin`).
- **Performance**: Synthesizes 24kHz studio-quality natural interviewer speech in $< 150\text{ms}$ latency.
- **Client Delivery**: Streamed as raw WAV audio through Express API proxy with client-side memory caching.

---

## 4. Multi-Modal Score Aggregation

The final performance report synthesizes metrics from all three modalities:

$$\text{Overall Score} = (\text{Verbal NLP} \times 0.40) + (\text{Voice SER} \times 0.20) + (\text{Face Visual} \times 0.20) + (\text{Writing Assessment} \times 0.20)$$

*If the candidate opted out of the technical writing test, the weights are dynamically re-balanced to NLP 50%, Voice 25%, and Face 25%.*
