
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO
from werkzeug.utils import secure_filename

import cv2
import os
import uuid

app = Flask(__name__)
CORS(app)

# =====================================
# CONFIGURATION
# =====================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
RESULT_FOLDER = os.path.join(BASE_DIR, "results")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

ALLOWED_EXTENSIONS = {"mp4", "avi", "mov", "mkv"}

# COCO vehicle class IDs
VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

# Processing settings
MAX_FRAME_SIZE = 640
CONFIDENCE = 0.30

# =====================================
# LOAD YOLO MODEL
# =====================================

print("Loading YOLO model...")

model = YOLO("yolo11n.pt")

print("TRAFFICMIND AI vehicle detection engine ready!")


# =====================================
# HELPER FUNCTION
# =====================================

def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


# =====================================
# HOME API
# =====================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "online",
        "project": "TRAFFICMIND AI",
        "message": "Vehicle detection backend is running"
    })


# =====================================
# VEHICLE DETECTION API
# =====================================

@app.route("/api/detect", methods=["POST"])
def detect_vehicles():

    if "video" not in request.files:
        return jsonify({
            "error": "Please upload a traffic video."
        }), 400

    video = request.files["video"]

    if video.filename == "":
        return jsonify({
            "error": "No video selected."
        }), 400

    if not allowed_file(video.filename):
        return jsonify({
            "error": "Unsupported video format."
        }), 400

    # Generate unique filenames
    filename = secure_filename(video.filename)
    unique_id = uuid.uuid4().hex

    input_path = os.path.join(
        UPLOAD_FOLDER,
        unique_id + "_" + filename
    )

    output_filename = unique_id + "_detected.mp4"

    output_path = os.path.join(
        RESULT_FOLDER,
        output_filename
    )

    video.save(input_path)

    cap = cv2.VideoCapture(input_path)

    if not cap.isOpened():
        cap.release()
        os.remove(input_path)

        return jsonify({
            "error": "Unable to open the uploaded video."
        }), 400

    # Read video properties
    fps = cap.get(cv2.CAP_PROP_FPS)

    if fps <= 0:
        fps = 25

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    writer = None

    # Vehicle statistics
    vehicle_counts = {
        "car": 0,
        "motorcycle": 0,
        "bus": 0,
        "truck": 0
    }

    unique_vehicle_ids = set()
    total_frames = 0

    try:

        # =====================================
        # CREATE OUTPUT VIDEO
        # =====================================

        writer = cv2.VideoWriter(
            output_path,
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (width, height)
        )

        if not writer.isOpened():
            raise RuntimeError("Could not create output video.")

        # =====================================
        # PROCESS VIDEO FRAME BY FRAME
        # =====================================

        while True:

            success, frame = cap.read()

            if not success:
                break

            # Original dimensions
            original_height, original_width = frame.shape[:2]

            # ---------------------------------
            # RESIZE FRAME FOR FASTER YOLO
            # ---------------------------------

            scale = min(
                MAX_FRAME_SIZE / original_width,
                MAX_FRAME_SIZE / original_height,
                1.0
            )

            new_width = max(1, int(original_width * scale))
            new_height = max(1, int(original_height * scale))

            small_frame = cv2.resize(
                frame,
                (new_width, new_height),
                interpolation=cv2.INTER_AREA
            ) if scale < 1.0 else frame

            # ---------------------------------
            # YOLO VEHICLE TRACKING
            # ---------------------------------

            results = model.track(
                small_frame,
                persist=True,
                classes=list(VEHICLE_CLASSES.keys()),
                conf=CONFIDENCE,
                tracker="bytetrack.yaml",
                imgsz=MAX_FRAME_SIZE,
                verbose=False
            )

            result = results[0]

            # ---------------------------------
            # COUNT UNIQUE VEHICLES
            # ---------------------------------

            if result.boxes is not None:

                boxes = result.boxes

                if boxes.id is not None:

                    track_ids = boxes.id.int().cpu().tolist()
                    class_ids = boxes.cls.int().cpu().tolist()

                    for track_id, class_id in zip(
                        track_ids,
                        class_ids
                    ):

                        if class_id not in VEHICLE_CLASSES:
                            continue

                        vehicle_key = (class_id, track_id)

                        if vehicle_key not in unique_vehicle_ids:

                            unique_vehicle_ids.add(vehicle_key)

                            vehicle_name = VEHICLE_CLASSES[class_id]

                            vehicle_counts[vehicle_name] += 1

            # ---------------------------------
            # DRAW DETECTION BOXES
            # ---------------------------------

            annotated_frame = result.plot()

            # Restore original video dimensions
            if (
                annotated_frame.shape[1] != original_width
                or annotated_frame.shape[0] != original_height
            ):

                annotated_frame = cv2.resize(
                    annotated_frame,
                    (original_width, original_height),
                    interpolation=cv2.INTER_LINEAR
                )

            writer.write(annotated_frame)

            total_frames += 1

            if total_frames % 100 == 0:
                print(f"Processed {total_frames} frames...")

        # =====================================
        # RELEASE VIDEO RESOURCES
        # =====================================

        cap.release()
        writer.release()

        # =====================================
        # CALCULATE TRAFFIC DENSITY
        # =====================================

        total_vehicles = sum(vehicle_counts.values())

        if total_vehicles < 10:
            density = "Low"

        elif total_vehicles < 30:
            density = "Moderate"

        else:
            density = "High"

        print("Detection completed!")
        print("Total vehicles:", total_vehicles)
        print("Vehicle counts:", vehicle_counts)

        # =====================================
        # RETURN RESULTS TO FRONTEND
        # =====================================

        return jsonify({

            "success": True,

            "message": "Vehicle detection completed.",

            "counts": vehicle_counts,

            "total_vehicles": total_vehicles,

            "density": density,

            "frames_processed": total_frames,

            "video_url": (
                f"http://127.0.0.1:5000/results/{output_filename}"
            )

        })

    except Exception as error:

        print("Detection error:", str(error))

        return jsonify({
            "error": str(error)
        }), 500

    finally:

        cap.release()

        if writer is not None:
            writer.release()

        if os.path.exists(input_path):
            os.remove(input_path)

        # Remove incomplete output video after an error
        if os.path.exists(output_path) and total_frames == 0:
            os.remove(output_path)


# =====================================
# SERVE PROCESSED VIDEO
# =====================================

@app.route("/results/<filename>")
def get_result(filename):

    return send_from_directory(
        RESULT_FOLDER,
        filename
    )


# =====================================
# START FLASK SERVER
# =====================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
        threaded=False
    )
