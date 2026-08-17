FROM python:3.11-slim

WORKDIR /app

# libsndfile1 needed for audio processing (soundfile/librosa)
RUN apt-get update && apt-get install -y \
    libsndfile1 ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Download SER model weights at build time, verified by SHA256 checksum.
# Fall back to runtime auto-download (ensure_ser_model) if args are unset.
ARG SER_MODEL_URL=
ARG SER_MODEL_SHA256=
RUN mkdir -p /app/SER_model && \
    if [ -n "$SER_MODEL_URL" ]; then \
        curl -fsSL -o /app/SER_model/best_model_path.pth "$SER_MODEL_URL" && \
        echo "$SER_MODEL_SHA256  /app/SER_model/best_model_path.pth" | sha256sum -c - ; \
    fi
ENV SER_MODEL_PATH=/app/SER_model/best_model_path.pth

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
