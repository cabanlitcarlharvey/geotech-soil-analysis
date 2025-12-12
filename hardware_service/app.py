
# ✅ app.py (updated Flask with Serial + Supabase Insert)

from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client
import serial
import json

app = Flask(__name__)
CORS(app)

SUPABASE_URL = 'https://plpkewtyfpdxswvswapw.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscGtld3R5ZnBkeHN3dnN3YXB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODAxMDcwMywiZXhwIjoyMDYzNTg2NzAzfQ.lf22nIx0oPWEPMiLxpW9uvRgcBMJXWcRydvuHpuYoFM'  # truncate in actual use
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route('/api/soil_analysis', methods=['GET'])
def get_soil_analysis():
    try:
        response = supabase.table("soil_data").select("*").order("created_at", desc=False).execute()
        if response.data:
            return jsonify(response.data)
        else:
            return jsonify([]), 204
    except Exception as e:
        print("Error fetching soil analysis:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/insert_from_device', methods=['POST'])
def insert_from_device():
    try:
        ser = serial.Serial('COM3', 9600, timeout=3)  # ⚠ Replace COM3 with correct port
        line = ser.readline().decode('utf-8').strip()
        print("Serial data:", line)
        ser.close()

        data = json.loads(line)
        supabase.table("soil_data").insert(data).execute()
        return jsonify({"status": "success", "inserted": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
