# app/routes/classify.py
from fastapi import APIRouter, File, UploadFile, HTTPException
from keras.models import load_model # type: ignore
from PIL import Image
import numpy as np
import io
import os

router = APIRouter(prefix="/classify", tags=["classify"])

model = load_model("app/models/soil_model.keras")

# Define class names (based on your training)
CLASS_NAMES = [
    "Clayey Sand",
    "Clayey Sand with Gravel",
    "Silty Sand",
    "Silty Sand with Gravel",
    "Unclassified"
]

@router.post("/")
async def classify_soil(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        image = image.resize((224, 224))  # Adjust size if model requires different
        image_array = np.array(image) / 255.0
        image_array = np.expand_dims(image_array, axis=0)

        predictions = model.predict(image_array)
        predicted_index = np.argmax(predictions[0])
        predicted_class = CLASS_NAMES[predicted_index]

        # If predicted class is "Unclassified", we mark it as rejected
        status = "REJECTED" if predicted_class == "Unclassified" else "PENDING"

        return {
            "predicted_class": predicted_class,
            "status": status,
            "confidence": float(predictions[0][predicted_index])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
