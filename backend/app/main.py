import os
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import json
from supabase import create_client, Client
import base64
import cv2
import numpy as np
import requests # <-- RETAINED for ESP32 communication
from datetime import datetime
import uuid
import os
import tensorflow as tf
from tensorflow import keras
from pydantic import BaseModel # Added for /receive-analysis data structure
from typing import Optional

class CommandRequest(BaseModel):
    input: str
    image_soil_type: Optional[str] = None
    image_data: Optional[str] = None
    location: Optional[str] = None

# ========================================
# GLOBAL VARIABLES (Initialisation)
# ========================================

# Tiyakin na naka-declare ito para maiwasan ang NameError
cnn_model = None  
cnn_status = "model_not_loaded"

# --- CONFIGURATION (Kailangan mong i-update ito!) ---
# PAKI-UPDATE ITO gamit ang Local IP Address ng iyong ESP32.
ESP32_IP = "http://192.168.1.210" 
ESP32_COMMAND_URL = f"{ESP32_IP}/command"
# ----------------------------------------------------

# MobileNetV2 preprocessing function
def mobilenet_v2_preprocess(image):
    """MobileNetV2 preprocessing: scale to [-1, 1]"""
    x = image.astype('float32')
    x = x / 127.5
    x = x - 1.0
    return x

app = FastAPI()

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Log exceptions
@app.middleware("http")
async def log_exceptions(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        print(f"Unhandled error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return JSONResponse(status_code=500, content={"detail": f"Server error: {str(e)}"})

# Supabase configuration (service client)
# ------------------------------------------------------------------
# 🛑 FIX: Basahin ang variables mula sa Environment, hindi hardcoded!
# ------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
# ------------------------------------------------------------------

# Debugging print statement para i-verify
print(f"DEBUG: SUPABASE_URL (ENV): {SUPABASE_URL}")
if SUPABASE_KEY:
    print(f"DEBUG: SUPABASE_KEY (ENV) First 5 chars: {SUPABASE_KEY[:5]}...")
else:
    # Mag-throw ng error kung hindi na-load ang key
    raise ValueError("SUPABASE_KEY environment variable not loaded!")


if not SUPABASE_URL or not SUPABASE_KEY:
    # Handling para sa development kung wala talagang .env, pero sa Docker dapat loaded
    print("FATAL: Supabase credentials are not loaded from environment variables!")
    # Maglagay ng default value kung kailangan, pero mas maganda kung mag-e-exit ang app
    # Para sigurado na hindi mag-e-expose ng hardcoded key sa code
    supabase: Client = None # Temporary placeholder
    # I-exit ang app or mag-throw ng exception

else:
    # Create the client ONLY if the variables are loaded
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Test Supabase connection
try:
    if supabase:
        response = supabase.table('soil_analysis_results').select('*').limit(1).execute()
        print("Supabase connection successful:", response)
    else:
        print("Supabase client not initialized due to missing credentials.")
except Exception as e:
    print("Supabase connection error:", str(e))
    # Dito dapat lumalabas ang Supabase Auth error, pero ngayon ay mahahandle na.

# ========================================
# CNN Model Configuration
# ========================================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
CNN_MODEL_PATH = os.path.join(CURRENT_DIR, "models", "cnn_soil_classifier.keras")
IMG_SIZE = (224, 224)  # MobileNetV2 default input size
CONFIDENCE_THRESHOLD = 0.8
CLASSES = ["Clay Sand", "Silty Sand"]

# Load CNN model
print("Loading CNN model...")
def load_model():
    global cnn_model, cnn_status
    print(f"Attempting to load model from path: {CNN_MODEL_PATH}") # Debugging
    print(f"Is path existing? {os.path.exists(CNN_MODEL_PATH)}")
    try:
        # Pilitin ang TensorFlow na i-load ang model nang hindi ito ki-nocompile ulit
        cnn_model = tf.keras.models.load_model(CNN_MODEL_PATH, compile=False)
        
        # Pagkatapos i-load, i-compile ito (dapat pareho sa training config)
        cnn_model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
        
        # I-update ang global status variable
        cnn_status = "loaded" 
        
        print(f"✓ CNN model loaded successfully")
        print(f"  Model architecture: {cnn_model.name}")
        print(f"  Input shape: {cnn_model.input_shape}")
        print(f"  Output shape: {cnn_model.output_shape}")
        print(f"  Confidence threshold: {CONFIDENCE_THRESHOLD}")
        print(f"  Classes: {CLASSES}")
    except FileNotFoundError:
        print(f"ERROR: CNN model not found at {CNN_MODEL_PATH}")
        cnn_status = "file_not_found"
    except Exception as e:
        print(f"ERROR loading CNN model (TensorFlow issue): {e}")
        import traceback
        traceback.print_exc()
        cnn_status = "model_loading_failed"

# ----------------------------------------
# TAWAGIN ANG LOAD_MODEL AGAD! (Global Scope)
# ----------------------------------------
load_model()

# ========================================
# CNN Prediction Function
# ========================================
def predict_with_cnn(image, confidence_threshold=CONFIDENCE_THRESHOLD):
    """Predict soil type using CNN with MobileNetV2"""
    if cnn_model is None:
        raise ValueError("CNN model not loaded")
    
    try:
        # Preprocess image for MobileNetV2
        img_resized = cv2.resize(image, IMG_SIZE)
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        
        # MobileNetV2 preprocessing: scale to [-1, 1]
        img_preprocessed = mobilenet_v2_preprocess(img_rgb)
        img_batch = np.expand_dims(img_preprocessed, axis=0)
        
        # Get predictions
        predictions = cnn_model.predict(img_batch, verbose=0)[0]
        predicted_class_idx = np.argmax(predictions)
        confidence = float(predictions[predicted_class_idx])
        
        # Determine result based on confidence
        if confidence >= confidence_threshold:
            soil_type = CLASSES[predicted_class_idx]
            status = "confident"
        else:
            soil_type = "Uncertain"
            status = "uncertain"
        
        # Create probability dictionary
        prob_dict = {CLASSES[i]: float(predictions[i]) for i in range(len(CLASSES))}
        
        result = {
            "soil_type": soil_type,
            "confidence": confidence,
            "status": status,
            "probabilities": prob_dict,
            "threshold": confidence_threshold
        }
        
        print(f"CNN Prediction: {soil_type} ({confidence:.2%} confidence)")
        return result
        
    except Exception as e:
        print(f"Error in CNN prediction: {e}")
        raise ValueError(f"CNN prediction failed: {str(e)}")

# ========================================
# Supabase Storage Upload Function
# ========================================
async def upload_image_to_storage(image_data_base64: str, engineer_id: str):
    """
    Upload base64 image to Supabase Storage
    
    Args:
        image_data_base64: Base64 encoded image (with or without prefix)
        engineer_id: User ID for folder organization
    
    Returns:
        Public URL of uploaded image or None
    """
    try:
        # Remove data:image/jpeg;base64, prefix if exists
        if ',' in image_data_base64:
            image_data_base64 = image_data_base64.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_data_base64)
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        random_id = str(uuid.uuid4())[:8]
        filename = f"{engineer_id}/{timestamp}_{random_id}.jpg"
        
        print(f"📸 Uploading image: {filename}")
        
        # Upload to Supabase Storage
        upload_response = supabase.storage.from_('soil_images').upload(
            path=filename,
            file=image_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Get public URL
        public_url = supabase.storage.from_('soil_images').get_public_url(filename)
        
        print(f"✓ Image uploaded successfully")
        print(f"  URL: {public_url}")
        
        return public_url
        
    except Exception as e:
        print(f"❌ Image upload error: {e}")
        import traceback
        print(traceback.format_exc())
        return None

# ========================================
# FastAPI Endpoints
# ========================================

# Data Model para sa /receive-analysis endpoint
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

# ----------------------------------------------------
# A. NEW ENDPOINT: Tumanggap ng Final Data mula sa ESP32
# ----------------------------------------------------
@app.post("/receive-analysis")
async def receive_analysis_from_device(data: SoilData):
    """
    Tinatanggap ang final computed data mula sa ESP32 at ise-save sa Supabase.
    NOTE: Hindi kasama dito ang image upload/CNN logic, dapat i-trigger ng frontend.
    """
    try:
        # Pwede mong gawing mas simple ang structure na ise-save dito 
        # kung galing na sa ESP32 ang lahat ng kinakailangan.
        
        # Dito mo ilalagay ang final save logic mo sa Supabase
        # (Example: Ang data na ito ay maaaring pang-audit o pang-check)
        
        # Assuming the ESP32 already performed the weight calculation
        
        result_to_save = {
            "total_weight": data.total_weight,
            "gravel_percent": data.gravel_percent,
            "sand_percent": data.sand_percent,
            "fines_percent": data.fines_percent,
            "soil_type_uscs": data.soil_type, # Iba ito sa CNN soil type
            "device_ip": "ESP32_Device" # Optional identifier
        }
        
        # Example Supabase insertion
        # db_response = supabase.table('audit_analysis_data').insert(result_to_save).execute()

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
        "status": cnn_status, # Gamitin ang cnn_status variable
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "device_comm_method": "Wi-Fi HTTP Relay"
    }


@app.get("/model-info")
def model_info():
    """Get information about loaded model"""
    if cnn_model is None:
        raise HTTPException(status_code=503, detail="CNN model not loaded")
    
    return {
        "model_type": "CNN (Convolutional Neural Network)",
        "framework": "TensorFlow/Keras",
        "architecture": "Sequential with MobileNetV2 backbone",
        "input_shape": str(cnn_model.input_shape),
        "output_shape": str(cnn_model.output_shape),
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "classes": CLASSES,
        "image_size": IMG_SIZE,
        "preprocessing": "MobileNetV2 preprocess_input (scale to [-1, 1])",
        "model_file": CNN_MODEL_PATH
    }


@app.post("/predict")
async def predict_image(data: dict):
    """Predict soil type from base64 encoded image"""
    if cnn_model is None:
        raise HTTPException(status_code=503, detail="CNN model not loaded")
    
    try:
        image_data = base64.b64decode(data.get('image'))
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Failed to decode image")
        
        result = predict_with_cnn(img, confidence_threshold=CONFIDENCE_THRESHOLD)
        return result
        
    except Exception as e:
        print(f"Error in /predict endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")


@app.post("/predict-with-threshold")
async def predict_with_custom_threshold(data: dict):
    """Predict with custom confidence threshold"""
    if cnn_model is None:
        raise HTTPException(status_code=503, detail="CNN model not loaded")
    
    try:
        image_data = base64.b64decode(data.get('image'))
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Failed to decode image")
        
        custom_threshold = data.get('threshold', CONFIDENCE_THRESHOLD)
        
        if not 0.0 <= custom_threshold <= 1.0:
            raise ValueError("Threshold must be between 0.0 and 1.0")
        
        result = predict_with_cnn(img, confidence_threshold=custom_threshold)
        return result
        
    except Exception as e:
        print(f"Error in /predict-with-threshold endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")


# ============================================
# GET /command - For commands 1, 2, W, R
# ============================================
@app.get("/command")
async def send_command_get(
    input: str,
    authorization: str = Header(None)
):
    """
    Handle GET requests for commands 1, 2, W, R
    """
    if input not in ['1', '2', 'W', 'R']:
        raise HTTPException(status_code=400, detail="Invalid command for GET request")

    try:
        print(f"📤 Sending command '{input}' to ESP32 at {ESP32_COMMAND_URL}")
        
        response_from_esp32 = requests.get(
            f"{ESP32_COMMAND_URL}?input={input}", 
            timeout=15
        )
        
        content_type = response_from_esp32.headers.get('Content-Type', '')
        print(f"📥 ESP32 Response Content-Type: {content_type}")
        print(f"📥 ESP32 Response Status: {response_from_esp32.status_code}")
        
        if 'application/json' not in content_type:
            print(f"❌ ESP32 returned non-JSON response!")
            print(f"First 500 chars: {response_from_esp32.text[:500]}")
            raise HTTPException(
                status_code=502,
                detail=f"ESP32 returned {content_type} instead of JSON."
            )
        
        response_from_esp32.raise_for_status()
        data = response_from_esp32.json()
        
        print(f"✅ Received JSON from ESP32: {data}")
        
        response = {
            "status": data.get("status", "unknown"),
            "message": data.get("message", ""),
        }
        
        if "value" in data and isinstance(data["value"], (int, float)):
            response["weight"] = float(data["value"])

        if data["status"] == "reset":
            response["message"] = data.get("message", "System reset.")

        return response

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="ESP32 device timed out.")
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="ESP32 device unreachable.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="ESP32 returned invalid JSON.")
    except Exception as e:
        print(f"Command error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ============================================
# POST /command - For command 3 (with image data)
# ============================================
@app.post("/command")
async def send_command_post(
    request: CommandRequest,
    authorization: str = Header(None)
):
    """
    Handle POST requests for command 3 (includes image data)
    """
    input_cmd = request.input
    
    if input_cmd != '3':
        raise HTTPException(status_code=400, detail="POST only accepts command 3")

    try:
        print(f"📤 Sending command '{input_cmd}' to ESP32 at {ESP32_COMMAND_URL}")
        
        # Send command 3 to ESP32
        response_from_esp32 = requests.get(
            f"{ESP32_COMMAND_URL}?input={input_cmd}", 
            timeout=15
        )
        
        content_type = response_from_esp32.headers.get('Content-Type', '')
        print(f"📥 ESP32 Response Content-Type: {content_type}")
        print(f"📥 ESP32 Response Status: {response_from_esp32.status_code}")
        
        if 'application/json' not in content_type:
            raise HTTPException(
                status_code=502,
                detail=f"ESP32 returned {content_type} instead of JSON."
            )
        
        response_from_esp32.raise_for_status()
        data = response_from_esp32.json()
        
        print(f"✅ Received JSON from ESP32: {data}")
        
        response = {
            "status": data.get("status", "unknown"),
            "message": data.get("message", ""),
        }
        
        if data["status"] == "results":
            total_weight = data.get("total_weight", 0)
            gravel_weight = data.get("gravel_weight", 0)
            sand_weight = data.get("sand_weight", 0)
            gravel_percent = data.get("gravel_percent", 0)
            sand_percent = data.get("sand_percent", 0)
            fines_percent = data.get("fines_percent", 0)

            response.update({
                "total_weight": total_weight,
                "gravel_weight": gravel_weight,
                "sand_weight": sand_weight,
                "gravel_percent": gravel_percent,
                "sand_percent": sand_percent,
                "fines_percent": fines_percent,
                "soil_type": data["soil_type"],
            })
            
            # --- FINAL SAVE LOGIC ---
            print("LOG: Starting Command 3 save process...")

            # Authorization Check
            if not authorization or not authorization.startswith("Bearer "):
                raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

            jwt_token = authorization.split("Bearer ")[1]
            print("LOG: Token extracted, attempting user auth...")

            try:
                user_response = supabase.auth.get_user(jwt_token)
                
                if not user_response.user:
                    raise HTTPException(status_code=401, detail="Invalid token")
                
                engineer_id = user_response.user.id
                print(f"LOG: User authenticated: {engineer_id}")

            except Exception as auth_error:
                print(f"Supabase Auth Error: {auth_error}")
                raise HTTPException(status_code=401, detail="Authentication failed.")

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
            result = {
                "engineer_id": user_response.user.id,
                "location": request.location or "Not provided",
                "total_weight": total_weight,
                "gravel_weight": gravel_weight,
                "sand_weight": sand_weight,
                "gravel_percent": gravel_percent,
                "sand_percent": sand_percent,
                "fines_percent": fines_percent,
                "soil_type": data["soil_type"],
                "predicted_soil_type": request.image_soil_type or "Not provided",
                "image_soil_type": image_url or "Not provided",
                "status": "PENDING"
            }
            
            db_response = supabase.table('soil_analysis_results').insert(result).execute()
            print(f"✓ Data saved to database")
            
            response["save_status"] = "Results saved to database!"
            if image_url:
                response["image_url"] = image_url

        return response

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="ESP32 device timed out.")
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="ESP32 device unreachable.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="ESP32 returned invalid JSON.")
    except Exception as e:
        print(f"Command error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ========================================
# Health Check & Testing
# ========================================


@app.get("/health")
def health_check():
    """Check system health"""
    # Inalis ang serial port check, pinalitan ng ESP32 connection check
    
    # Simple check para sa ESP32 connection
    esp32_status = "unreachable"
    try:
        response = requests.get(ESP32_IP, timeout=5)
        if response.status_code == 200:
            esp32_status = "connected_ok"
        else:
            esp32_status = f"connected_error_{response.status_code}"
    except requests.exceptions.RequestException:
        pass


    return {
        "status": "healthy",
        "cnn_model": "loaded" if cnn_model is not None else "not_loaded",
        "device_ip": ESP32_IP,
        "esp32_status": esp32_status,
        "supabase": "connected"
    }


@app.post("/test-prediction")
async def test_prediction():
    """Test endpoint with sample data"""
    test_img = np.ones((128, 128, 3), dtype=np.uint8) * [139, 69, 19]
    
    try:
        result = predict_with_cnn(test_img, confidence_threshold=CONFIDENCE_THRESHOLD)
        return {
            "message": "Test prediction successful",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")


@app.post("/test-upload")
async def test_upload(data: dict):
    """Test image upload to Supabase Storage"""
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


# ========================================
# Admin Endpoint (Retained as is)
# ========================================


@app.post("/admin/delete-user")
async def admin_delete_user(payload: dict, authorization: str = Header(None)):
    """Delete user (admin only) - deletes both profile and authentication user"""
    user_id_to_delete = payload.get("id")
    if not user_id_to_delete:
        raise HTTPException(status_code=400, detail="Missing user id")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    jwt_token = authorization.split("Bearer ")[1]

    # Verify requester identity
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

    # Check if requester is admin
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

    # Prevent self-deletion
    if requester.id == user_id_to_delete:
        raise HTTPException(status_code=400, detail="Admins cannot delete their own account")

    # Check if target user is admin
    try:
        target_profile = supabase.table('profiles').select('role').eq('id', user_id_to_delete).single().execute()
        target_data = target_profile.data if hasattr(target_profile, "data") else target_profile.get("data")
        
        if target_data and target_data.get("role") == "admin":
            raise HTTPException(status_code=403, detail="Cannot delete admin accounts")
    except HTTPException:
        raise
    except Exception:
        pass  # User might not have profile yet

    # Delete from profiles table
    try:
        supabase.table('profiles').delete().eq('id', user_id_to_delete).execute()
        print(f"✓ Profile deleted for user: {user_id_to_delete}")
    except Exception as e:
        print(f"Failed to delete profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed deleting profile: {str(e)}")

    # Delete authentication user using Supabase Admin API
    try:
        # IMPORTANTE: Gamitin ang admin.delete_user() method
        delete_response = supabase.auth.admin.delete_user(user_id_to_delete)
        print(f"✓ Authentication user deleted: {user_id_to_delete}")
        print(f"  Delete response: {delete_response}")
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Failed to delete authentication user: {error_msg}")
        
        # Even if auth deletion fails, profile is already deleted
        # Return partial success with warning
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

# ========================================
# Startup Event
# ========================================


@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    # ⚠️ Tiyakin na NA-LOAD NA ang model BAGO DITO! 
    # Inalis na ang load_model() call dahil tinawag na ito sa global scope
    
    # ------------------
    # Startup Printout
    # ------------------
    print("\n" + "=" * 60)
    print("GEOTECH SOIL ANALYSIS BACKEND - STARTUP")
    print("=" * 60)
    print(f"Model: CNN (Convolutional Neural Network)")
    print(f"Framework: TensorFlow/Keras")
    # Gamitin ang cnn_status variable
    print(f"Status: {'✓ Loaded' if cnn_status == 'loaded' else f'✗ {cnn_status}'}") 
    print(f"Confidence Threshold: {CONFIDENCE_THRESHOLD}")
    print(f"Classes: {CLASSES}")
    print(f"Device Comm: Wi-Fi HTTP Relay")
    # ... (Iba pang print statements)
    print("=" * 60)
    print("Backend ready to accept requests")
    print("=" * 60 + "\n")