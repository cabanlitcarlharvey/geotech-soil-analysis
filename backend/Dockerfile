# Gamitin ang opisyal na Python base image (3.10-slim)
FROM python:3.10-slim

# Itakda ang working directory sa loob ng container
WORKDIR /app

# 1. I-install ang OS dependencies
# Kailangan ng build-essential at libgomp1 para sa NumPy at TensorFlow
RUN apt-get update && apt-get install -y \
    build-essential \
    libgomp1 \
    pkg-config \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# 2. Kopyahin ang requirements.txt at i-install ang Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Kopyahin ang Application Code at Model File
# Kopyahin ang 'app' directory (na naglalaman ng main.py at models/cnn_soil_classifier.keras)
# Mula sa host: 'app' (nasa root directory mo) papunta sa container: '/app/app'
COPY app /app/app

# 4. Exposure ng port
EXPOSE 8000

# 5. Command para patakbuhin ang Uvicorn server
# Gamitin ang 'app.main:app' dahil ang main.py ay nasa loob ng 'app' folder sa loob ng '/app'
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]