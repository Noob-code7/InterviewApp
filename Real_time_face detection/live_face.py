import threading
import time
import cv2
from deepface import DeepFace

# ─────────────────────────────────────────────────────────────
#  CONFIGURATION
# ─────────────────────────────────────────────────────────────
SNAPSHOT_COUNTDOWN_SECS = 3    # seconds to wait before auto-capturing reference
VERIFY_EVERY            = 90   # run identity check every N frames  (~3s @ 30fps)
EMOTION_EVERY           = 30   # run emotion analysis every N frames (~1s @ 30fps)

# ─────────────────────────────────────────────────────────────
#  CAMERA SETUP
# ─────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

# ─────────────────────────────────────────────────────────────
#  STATE MACHINE
#  Phase 0 → countdown before snapshot
#  Phase 1 → snapshot captured, interview running
# ─────────────────────────────────────────────────────────────
phase            = 0           # 0 = pre-interview countdown, 1 = live interview
reference_frame  = None        # in-memory snapshot (no file needed)
snapshot_time    = time.time() + SNAPSHOT_COUNTDOWN_SECS

counter          = 0
face_match       = True        # assume match until first check completes
face_alert       = False       # True if substitution is detected
emotions         = {}
confidence_score = 0
dominant_emotion = "N/A"

state_lock = threading.Lock()


# ─────────────────────────────────────────────────────────────
#  CONFIDENCE FORMULA
# ─────────────────────────────────────────────────────────────
def compute_confidence(emotion_dict):
    high = (emotion_dict.get("neutral",  0)
          + emotion_dict.get("happy",    0)
          + emotion_dict.get("surprise", 0) * 0.5)
    low  = (emotion_dict.get("fear",    0)
          + emotion_dict.get("sad",     0)
          + emotion_dict.get("angry",   0)
          + emotion_dict.get("disgust", 0))
    return max(0, min(100, int(high - low)))


# ─────────────────────────────────────────────────────────────
#  THREAD: IDENTITY VERIFICATION (against in-memory snapshot)
# ─────────────────────────────────────────────────────────────
def verify_identity(frame, ref_frame):
    global face_match, face_alert
    try:
        result = DeepFace.verify(
            frame,
            ref_frame.copy(),
            enforce_detection=False,
            silent=True
        )
        matched = result.get("verified", False)
        with state_lock:
            face_match = matched
            face_alert = not matched
    except Exception:
        # If DeepFace can't detect a face at all → flag it
        with state_lock:
            face_match = False
            face_alert = True


# ─────────────────────────────────────────────────────────────
#  THREAD: EMOTION + CONFIDENCE ANALYSIS
# ─────────────────────────────────────────────────────────────
def analyze_emotion(frame):
    global emotions, confidence_score, dominant_emotion
    try:
        results = DeepFace.analyze(
            frame,
            actions=["emotion"],
            enforce_detection=False,
            silent=True
        )
        result      = results[0] if isinstance(results, list) else results
        raw_emotions = result.get("emotion", {})
        dom_emotion  = result.get("dominant_emotion", "N/A")
        score        = compute_confidence(raw_emotions)

        with state_lock:
            emotions         = raw_emotions
            confidence_score = score
            dominant_emotion = dom_emotion
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────
#  DRAW HELPERS
# ─────────────────────────────────────────────────────────────
def draw_countdown(frame, seconds_left):
    """Full-screen overlay during the pre-interview snapshot phase."""
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (640, 480), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.45, frame, 0.55, 0, frame)

    # Title
    cv2.putText(frame, "Get Ready!", (170, 160),
                cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)

    # Instruction
    cv2.putText(frame, "Look directly at the camera.", (120, 210),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (200, 200, 200), 2)

    # Countdown number
    colour = (0, 220, 0) if seconds_left == 1 else (0, 200, 255)
    cv2.putText(frame, str(seconds_left), (295, 340),
                cv2.FONT_HERSHEY_SIMPLEX, 5, colour, 8)

    # Progress bar
    progress = 1.0 - (seconds_left - 1) / SNAPSHOT_COUNTDOWN_SECS
    bar_w    = int(580 * progress)
    cv2.rectangle(frame, (30, 390), (610, 410), (60, 60, 60), -1)
    cv2.rectangle(frame, (30, 390), (30 + bar_w, 410), (0, 220, 0), -1)


def draw_snapshot_flash(frame):
    """Bright white flash to indicate the snapshot was taken."""
    cv2.rectangle(frame, (0, 0), (640, 480), (255, 255, 255), -1)
    cv2.putText(frame, "Snapshot Captured!", (130, 250),
                cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 150, 0), 3)


def draw_confidence_bar(frame, score):
    bar_x, bar_y = 460, 20
    bar_w, bar_h = 160, 20
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (50, 50, 50), -1)
    fill_w = int(bar_w * score / 100)
    colour = (0, 220, 0) if score >= 65 else (0, 200, 255) if score >= 35 else (0, 0, 220)
    if fill_w > 0:
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), colour, -1)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (200, 200, 200), 1)
    cv2.putText(frame, f"Confidence: {score}%",
                (bar_x, bar_y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)


def draw_emotion_panel(frame, emotion_dict, dom_emotion):
    panel_x, panel_y = 10, 20
    cv2.putText(frame, "Emotions", (panel_x, panel_y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
    for i, (label, val) in enumerate(emotion_dict.items()):
        y      = panel_y + 22 + i * 20
        bar_w  = int(val * 1.2)
        colour = (0, 200, 100) if label == dom_emotion else (80, 80, 180)
        cv2.rectangle(frame, (panel_x, y - 12), (panel_x + bar_w, y), colour, -1)
        cv2.putText(frame, f"{label}: {int(val)}%",
                    (panel_x + 2, y - 1), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)


def draw_identity_badge(frame, matched, alert):
    if alert:
        text   = "⚠  FACE SUBSTITUTION DETECTED"
        colour = (0, 0, 255)
        # Flashing red border
        cv2.rectangle(frame, (0, 0), (639, 479), (0, 0, 255), 4)
    elif matched:
        text   = "Identity: VERIFIED ✓"
        colour = (0, 220, 0)
    else:
        text   = "Identity: Checking..."
        colour = (0, 200, 255)
    cv2.putText(frame, text, (10, 465),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, colour, 2)


# ─────────────────────────────────────────────────────────────
#  MAIN LOOP
# ─────────────────────────────────────────────────────────────
print("[INFO] Camera opened. Auto-snapshot will be taken in "
      f"{SNAPSHOT_COUNTDOWN_SECS} seconds...")

flash_frames = 0   # used to show the white flash for a few frames

while True:
    ret, frame = cap.read()
    if not ret:
        break

    now = time.time()

    # ── PHASE 0: COUNTDOWN ───────────────────────────────────
    if phase == 0:
        seconds_left = max(1, int(snapshot_time - now) + 1)

        if now >= snapshot_time:
            # ── TAKE SNAPSHOT ──────────────────────────────
            reference_frame = frame.copy()
            phase           = 1
            flash_frames    = 5   # show flash for 5 frames
            print("[INFO] Snapshot captured — interview analysis started.")
        else:
            draw_countdown(frame, seconds_left)

    # ── PHASE 1: LIVE INTERVIEW ───────────────────────────────
    else:
        # Flash effect right after snapshot
        if flash_frames > 0:
            draw_snapshot_flash(frame)
            flash_frames -= 1
        else:
            # Spawn analysis threads at configured intervals
            if counter % EMOTION_EVERY == 0:
                threading.Thread(
                    target=analyze_emotion,
                    args=(frame.copy(),),
                    daemon=True
                ).start()

            if counter % VERIFY_EVERY == 0 and reference_frame is not None:
                threading.Thread(
                    target=verify_identity,
                    args=(frame.copy(), reference_frame),
                    daemon=True
                ).start()

            counter += 1

            # Read shared state safely
            with state_lock:
                _emotions = dict(emotions)
                _score    = confidence_score
                _dom      = dominant_emotion
                _matched  = face_match
                _alert    = face_alert

            # Draw all overlays
            draw_emotion_panel(frame, _emotions, _dom)
            draw_confidence_bar(frame, _score)
            draw_identity_badge(frame, _matched, _alert)

            cv2.putText(frame, f"Mood: {_dom.upper()}", (220, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 0), 2)

    cv2.imshow("AI Interview — Face Analysis", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("[INFO] Session ended.")
