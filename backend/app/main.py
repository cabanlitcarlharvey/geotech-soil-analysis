from dotenv import load_dotenv
from pathlib import Path
import os
from fastapi import FastAPI, HTTPException, Request, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import asyncio  # ✅ para sa non-blocking sleep
import json
from supabase import create_client, Client
import base64
import cv2
import numpy as np
from datetime import datetime
import uuid
import os
import tensorflow as tf
from tensorflow import keras
from pydantic import BaseModel
from typing import Optional

class CommandRequest(BaseModel):
    input: str
    image_soil_type: Optional[str] = None
    image_data: Optional[str] = None
    location: Optional[str] = None

# Load backend/.env explicitly
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# ========================================
# GLOBAL VARIABLES (Initialisation)
# ========================================
cnn_model = None
cnn_status = "model_not_loaded"

# ✅ REMOVED: ESP32_IP and ESP32_COMMAND_URL — hindi na kailangan!
# Ang ESP32 na mismo ang mag-poll sa backend, hindi na tayo mag-call sa kanya.

# MobileNetV2 preprocessing function
def mobilenet_v2_preprocess(image):
    x = image.astype('float32')
    x = x / 127.5
    x = x - 1.0
    return x

# ============================================
# CORS CONFIGURATION
# ============================================
app = FastAPI()

ALLOWED_ORIGINS = [
    "https://geotech-soil-analysis-app.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"DEBUG: SUPABASE_URL (ENV): {SUPABASE_URL}")
if SUPABASE_SERVICE_ROLE_KEY:
    print(f"DEBUG: SUPABASE_SERVICE_ROLE_KEY (ENV) First 5 chars: {SUPABASE_SERVICE_ROLE_KEY[:5]}...")
else:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable not loaded!")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("FATAL: Supabase credentials are not loaded from environment variables!")
    supabase: Client = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

try:
    if supabase:
        response = supabase.table('soil_analysis_results').select('*').limit(1).execute()
        print("Supabase connection successful:", response)
    else:
        print("Supabase client not initialized due to missing credentials.")
except Exception as e:
    print("Supabase connection error:", str(e))

# ========================================
# CNN Model Configuration
# ========================================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
CNN_MODEL_PATH = os.path.join(CURRENT_DIR, "models", "cnn_soil_classifier.keras")
IMG_SIZE = (224, 224)
CLASSES = ["Clay Sand", "Silty Sand", "Unclassified"]

print("Loading CNN model...")
def load_model():
    global cnn_model, cnn_status
    print(f"Attempting to load model from path: {CNN_MODEL_PATH}")
    print(f"Is path existing? {os.path.exists(CNN_MODEL_PATH)}")
    try:
        cnn_model = tf.keras.models.load_model(CNN_MODEL_PATH, compile=False)
        cnn_model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
        cnn_status = "loaded"
        print(f"✓ CNN model loaded successfully")
        print(f"  Model architecture: {cnn_model.name}")
        print(f"  Input shape: {cnn_model.input_shape}")
        print(f"  Output shape: {cnn_model.output_shape}")
        print(f"  Classes: {CLASSES}")
    except FileNotFoundError:
        print(f"ERROR: CNN model not found at {CNN_MODEL_PATH}")
        cnn_status = "file_not_found"
    except Exception as e:
        print(f"ERROR loading CNN model: {e}")
        import traceback
        traceback.print_exc()
        cnn_status = "model_loading_failed"

load_model()

# ========================================
# CNN Prediction Function
# ========================================
def predict_with_cnn(image):
    if cnn_model is None:
        raise ValueError("CNN model not loaded")
    try:
        img_resized = cv2.resize(image, IMG_SIZE)
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        img_preprocessed = mobilenet_v2_preprocess(img_rgb)
        img_batch = np.expand_dims(img_preprocessed, axis=0)
        predictions = cnn_model.predict(img_batch, verbose=0)[0]
        predicted_class_idx = np.argmax(predictions)
        confidence = float(predictions[predicted_class_idx])
        soil_type = CLASSES[predicted_class_idx]
        prob_dict = {CLASSES[i]: float(predictions[i]) for i in range(len(CLASSES))}
        result = {
            "soil_type": soil_type,
            "confidence": confidence,
            "probabilities": prob_dict
        }
        print(f"CNN Prediction: {soil_type} ({confidence:.2%} confidence)")
        print(f"  Probabilities: {prob_dict}")
        return result
    except Exception as e:
        print(f"Error in CNN prediction: {e}")
        raise ValueError(f"CNN prediction failed: {str(e)}")

# ========================================
# Supabase Storage Upload Function
# ========================================
async def upload_image_to_storage(image_data_base64: str, engineer_id: str):
    try:
        if ',' in image_data_base64:
            image_data_base64 = image_data_base64.split(',')[1]
        image_bytes = base64.b64decode(image_data_base64)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        random_id = str(uuid.uuid4())[:8]
        filename = f"{engineer_id}/{timestamp}_{random_id}.jpg"
        print(f"📸 Uploading image: {filename}")
        upload_response = supabase.storage.from_('soil_images').upload(
            path=filename,
            file=image_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        public_url = supabase.storage.from_('soil_images').get_public_url(filename)
        print(f"✓ Image uploaded successfully. URL: {public_url}")
        return public_url
    except Exception as e:
        print(f"❌ Image upload error: {e}")
        import traceback
        print(traceback.format_exc())
        return None

# ========================================
# Data Models
# ========================================
class SoilData(BaseModel):
    total_weight: float
    gravel_weight: float
    sand_weight: float
    gravel_percent: float
    sand_percent: float
    fines_percent: float
    soil_type: str
    backend_status: str | None = None
    message: str | None = None


# ============================================
# ✅ NEW: ESP32 POLLING ENDPOINTS
# ============================================

@app.get("/poll")
async def poll_for_command():
    """
    Ini-call ng ESP32 every 3 seconds para malaman kung may command para sa kanya.
    Naghahanap ng pinaka-lumang 'pending' command sa pending_commands table.
    """
    try:
        result = supabase.table('pending_commands') \
            .select('*') \
            .eq('status', 'pending') \
            .order('created_at', desc=False) \
            .limit(1) \
            .execute()

        if not result.data:
            # Walang command, sabihin lang sa ESP32 na mag-idle
            return {"has_command": False}

        command_row = result.data[0]

        # I-update ang status sa 'processing' para hindi na ito makuha ng susunod na poll
        supabase.table('pending_commands') \
            .update({"status": "processing"}) \
            .eq('id', command_row['id']) \
            .execute()

        print(f"📤 Sending queued command '{command_row['command']}' to ESP32 (id: {command_row['id']})")

        return {
            "has_command": True,
            "command_id": command_row['id'],
            "command": command_row['command']
        }

    except Exception as e:
        print(f"Poll error: {e}")
        raise HTTPException(status_code=500, detail=f"Poll error: {str(e)}")


@app.post("/result")
async def receive_result_from_esp32(data: dict):
    """
    Tinatawag ng ESP32 pagkatapos niya isagawa ang isang command.
    Dini-dispatch nito ang result depende sa command type.
    """
    command_id = data.get("command_id")
    command = data.get("command")
    payload = data.get("payload", {})

    if not command_id or not command:
        raise HTTPException(status_code=400, detail="Missing command_id or command")

    try:
        # I-update ang pending_commands row — ilagay ang result at i-mark bilang 'done'
        supabase.table('pending_commands') \
            .update({
                "status": "done",
                "result": payload
            }) \
            .eq('id', command_id) \
            .execute()

        print(f"✅ Result received from ESP32 for command '{command}' (id: {command_id}): {payload}")

        return {"status": "received", "command_id": command_id}

    except Exception as e:
        print(f"Result receive error: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving result: {str(e)}")


# ============================================
# ✅ UPDATED: /command endpoints
# Frontend mag-queue na lang ng command, hindi na mag-hihintay ng direct ESP32 response.
# ============================================

@app.get("/command")
async def send_command_get(
    input: str,
    authorization: str = Header(None)
):
    """
    Handle GET requests for commands 1, 2, W, R.
    Hindi na direkta sa ESP32 — ini-queue na lang sa Supabase.
    Frontend mag-poll ng /command/{id}/result para sa response.
    """
    if input not in ['1', '2', 'W', 'R']:
        raise HTTPException(status_code=400, detail="Invalid command for GET request")

    try:
        # I-insert ang command sa queue
        insert_result = supabase.table('pending_commands') \
            .insert({"command": input, "status": "pending"}) \
            .execute()

        command_id = insert_result.data[0]['id']
        print(f"📥 Command '{input}' queued with id: {command_id}")

        return {
            "status": "queued",
            "command_id": command_id,
            "message": f"Command '{input}' is queued. Poll /command/{command_id}/result for the response."
        }

    except Exception as e:
        print(f"Command queue error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/command/{command_id}/result")
async def get_command_result(command_id: str):
    """
    Ini-poll ng frontend para malaman kung natapos na ang command.
    Returns 'pending'/'processing' kung hindi pa, 'done' + result kung tapos na.
    """
    try:
        result = supabase.table('pending_commands') \
            .select('*') \
            .eq('id', command_id) \
            .single() \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Command not found")

        row = result.data
        return {
            "status": row['status'],         # 'pending', 'processing', 'done'
            "command": row['command'],
            "result": row.get('result'),      # None hanggang 'done'
            "created_at": row['created_at']
        }

    except Exception as e:
        print(f"Get result error: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/command")
async def send_command_post(
    request: CommandRequest,
    authorization: str = Header(None)
):
    """
    Handle POST requests for command 3 (includes image data).
    Ini-queue ang command sa ESP32, pagkatapos hihintayin ang result
    bago i-process ang image upload at Supabase save.
    """
    input_cmd = request.input

    if input_cmd != '3':
        raise HTTPException(status_code=400, detail="POST only accepts command 3")

    # Authorization Check
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    jwt_token = authorization.split("Bearer ")[1]

    try:
        user_response = supabase.auth.get_user(jwt_token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        engineer_id = user_response.user.id
        print(f"LOG: User authenticated: {engineer_id}")
    except Exception as auth_error:
        print(f"Supabase Auth Error: {auth_error}")
        raise HTTPException(status_code=401, detail="Authentication failed.")

    try:
        # I-queue ang command '3' sa ESP32
        insert_result = supabase.table('pending_commands') \
            .insert({"command": "3", "status": "pending"}) \
            .execute()

        command_id = insert_result.data[0]['id']
        print(f"📥 Command '3' queued with id: {command_id}")

        # Hintayin ang result — mag-poll tayo ng hanggang 60 seconds
        # ✅ asyncio.sleep() — non-blocking, hindi nahaharang ang ibang requests
        # ✅ kasama na ang /poll ng ESP32 habang naghihintay
        max_wait_seconds = 60
        poll_interval = 1  # second
        elapsed = 0
        esp32_data = None

        while elapsed < max_wait_seconds:
            await asyncio.sleep(poll_interval)  # ✅ non-blocking
            elapsed += poll_interval

            check = supabase.table('pending_commands') \
                .select('*') \
                .eq('id', command_id) \
                .single() \
                .execute()

            row = check.data
            if row and row['status'] == 'done':
                esp32_data = row.get('result', {})
                print(f"✅ ESP32 result received after {elapsed}s: {esp32_data}")
                break

        if not esp32_data:
            raise HTTPException(
                status_code=504,
                detail="ESP32 did not respond in time. Is it connected and polling?"
            )

        # Process the result
        if esp32_data.get("status") != "results":
            return {
                "status": esp32_data.get("status", "unknown"),
                "message": esp32_data.get("message", "")
            }

        total_weight = esp32_data.get("total_weight", 0)
        gravel_weight = esp32_data.get("gravel_weight", 0)
        sand_weight = esp32_data.get("sand_weight", 0)
        gravel_percent = esp32_data.get("gravel_percent", 0)
        sand_percent = esp32_data.get("sand_percent", 0)
        fines_percent = esp32_data.get("fines_percent", 0)

        # Upload image
        image_url = None
        if request.image_data:
            print("LOG: Image data found, starting upload...")
            try:
                image_url = await upload_image_to_storage(request.image_data, engineer_id)
                print(f"LOG: Image upload complete. URL: {image_url}")
            except Exception as upload_error:
                print(f"Supabase Storage Upload Error: {upload_error}")
                raise HTTPException(status_code=500, detail="Failed to upload image.")

        # Save results to database
        result_to_save = {
            "engineer_id": engineer_id,
            "location": request.location or "Not provided",
            "total_weight": total_weight,
            "gravel_weight": gravel_weight,
            "sand_weight": sand_weight,
            "gravel_percent": gravel_percent,
            "sand_percent": sand_percent,
            "fines_percent": fines_percent,
            "soil_type": esp32_data.get("soil_type", ""),
            "predicted_soil_type": request.image_soil_type or "Not provided",
            "image_soil_type": image_url or "Not provided",
            "status": "PENDING"
        }

        db_response = supabase.table('soil_analysis_results').insert(result_to_save).execute()
        print(f"✓ Data saved to database")

        response = {
            "status": "results",
            "total_weight": total_weight,
            "gravel_weight": gravel_weight,
            "sand_weight": sand_weight,
            "gravel_percent": gravel_percent,
            "sand_percent": sand_percent,
            "fines_percent": fines_percent,
            "soil_type": esp32_data.get("soil_type", ""),
            "save_status": "Results saved to database!",
            "message": "Results saved successfully."
        }

        if image_url:
            response["image_url"] = image_url

        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Command error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ============================================
# Existing Endpoints (unchanged)
# ============================================

@app.post("/receive-analysis")
async def receive_analysis_from_device(data: SoilData):
    try:
        result_to_save = {
            "total_weight": data.total_weight,
            "gravel_percent": data.gravel_percent,
            "sand_percent": data.sand_percent,
            "fines_percent": data.fines_percent,
            "soil_type_uscs": data.soil_type,
            "device_ip": "ESP32_Device"
        }
        print(f"✅ Data received from ESP32: Total Weight {data.total_weight}")
        return {"status": "success", "message": "Analysis results saved (audit log)."}
    except Exception as e:
        print(f"Error saving data from ESP32: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@app.get("/")
def root():
    return {
        "message": "Geotech Soil Analysis Backend is running",
        "model": "CNN (Convolutional Neural Network)",
        "status": cnn_status,
        "classes": CLASSES,
        "device_comm_method": "ESP32 Polling (no IP needed)"  # ✅ Updated
    }


@app.get("/model-info")
def model_info():
    if cnn_model is None:
        raise HTTPException(status_code=503, detail="CNN model not loaded")
    return {
        "model_type": "CNN (Convolutional Neural Network)",
        "framework": "TensorFlow/Keras",
        "architecture": "Sequential with MobileNetV2 backbone",
        "input_shape": str(cnn_model.input_shape),
        "output_shape": str(cnn_model.output_shape),
        "classes": CLASSES,
        "num_classes": len(CLASSES),
        "image_size": IMG_SIZE,
        "preprocessing": "MobileNetV2 preprocess_input (scale to [-1, 1])",
        "model_file": CNN_MODEL_PATH,
        "note": "Model includes Unclassified class - no manual threshold needed"
    }


@app.post("/predict")
async def predict_image(data: dict):
    if cnn_model is None:
        raise HTTPException(status_code=503, detail="CNN model not loaded")
    try:
        image_data = base64.b64decode(data.get('image'))
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image")
        result = predict_with_cnn(img)
        return result
    except Exception as e:
        print(f"Error in /predict endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")


@app.get("/health")
def health_check():
    # ✅ Walang na ESP32 connection check — hindi na kailangan ng IP
    return {
        "status": "healthy",
        "cnn_model": "loaded" if cnn_model is not None else "not_loaded",
        "device_comm": "ESP32 polling mode (no IP required)",
        "supabase": "connected"
    }


@app.post("/test-prediction")
async def test_prediction():
    test_img = np.ones((128, 128, 3), dtype=np.uint8) * [139, 69, 19]
    try:
        result = predict_with_cnn(test_img)
        return {"message": "Test prediction successful", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")


@app.post("/test-upload")
async def test_upload(data: dict):
    try:
        image_data = data.get('image')
        if not image_data:
            raise ValueError("No image data provided")
        url = await upload_image_to_storage(image_data, "test-user")
        return {
            "success": url is not None,
            "url": url,
            "message": "Upload successful" if url else "Upload failed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test upload failed: {str(e)}")


@app.post("/admin/delete-user")
async def admin_delete_user(payload: dict, authorization: str = Header(None)):
    user_id_to_delete = payload.get("id")
    if not user_id_to_delete:
        raise HTTPException(status_code=400, detail="Missing user id")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    jwt_token = authorization.split("Bearer ")[1]
    try:
        user_resp = supabase.auth.get_user(jwt_token)
        requester = None
        if hasattr(user_resp, "user"):
            requester = user_resp.user
        else:
            requester = (user_resp.get("data") or {}).get("user") if isinstance(user_resp, dict) else None
        if not requester:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"Failed to validate requester: {e}")
        raise HTTPException(status_code=401, detail="Failed to validate requester")
    try:
        profile_q = supabase.table('profiles').select('role').eq('id', requester.id).single().execute()
        profile_data = None
        if hasattr(profile_q, "data"):
            profile_data = profile_q.data
        else:
            profile_data = profile_q.get("data") if isinstance(profile_q, dict) else None
        if not profile_data or profile_data.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can delete users")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to verify requester role: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify requester role")
    if requester.id == user_id_to_delete:
        raise HTTPException(status_code=400, detail="Admins cannot delete their own account")
    try:
        target_profile = supabase.table('profiles').select('role').eq('id', user_id_to_delete).single().execute()
        target_data = target_profile.data if hasattr(target_profile, "data") else target_profile.get("data")
        if target_data and target_data.get("role") == "admin":
            raise HTTPException(status_code=403, detail="Cannot delete admin accounts")
    except HTTPException:
        raise
    except Exception:
        pass
    try:
        supabase.table('profiles').delete().eq('id', user_id_to_delete).execute()
        print(f"✓ Profile deleted for user: {user_id_to_delete}")
    except Exception as e:
        print(f"Failed to delete profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed deleting profile: {str(e)}")
    try:
        delete_response = supabase.auth.admin.delete_user(user_id_to_delete)
        print(f"✓ Authentication user deleted: {user_id_to_delete}")
        print(f"  Delete response: {delete_response}")
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Failed to delete authentication user: {error_msg}")
        return {
            "status": "partial_success",
            "message": "Profile deleted but authentication user deletion failed",
            "error": error_msg,
            "user_id": user_id_to_delete
        }
    return {
        "status": "success",
        "message": "Profile and authentication user deleted successfully",
        "user_id": user_id_to_delete
    }


@app.on_event("startup")
async def startup_event():
    print("\n" + "=" * 60)
    print("GEOTECH SOIL ANALYSIS BACKEND - STARTUP")
    print("=" * 60)
    print(f"Model: CNN (Convolutional Neural Network)")
    print(f"Framework: TensorFlow/Keras")
    print(f"Status: {'✓ Loaded' if cnn_status == 'loaded' else f'✗ {cnn_status}'}")
    print(f"Classes: {CLASSES}")
    print(f"Device Comm: ESP32 Polling Mode ✅")
    print(f"  → No ESP32 IP needed!")
    print(f"  → ESP32 polls GET /poll every 3s")
    print(f"  → ESP32 posts results to POST /result")
    print("=" * 60)
    print("Backend ready to accept requests")
    print("=" * 60 + "\n")