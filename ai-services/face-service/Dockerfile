FROM python:3.11-slim

WORKDIR /app

# System dependencies for OpenCV and facial analysis libs
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgl1-mesa-glx ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download DeepFace emotion and VGG-Face model weights into /root/.deepface/
RUN python -c "from deepface import DeepFace; DeepFace.build_model('Emotion'); DeepFace.build_model('VGG-Face')"

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
