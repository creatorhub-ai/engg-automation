from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
from attendance_mailer import process_attendance

app = Flask(__name__)
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route("/api/send-attendance-mails", methods=["POST"])
def send_attendance_mails():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    filename = secure_filename(file.filename) # type: ignore
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)

    result_message = process_attendance(file_path)

    # Optionally delete the uploaded file
    try:
        os.remove(file_path)
    except OSError:
        pass

    return jsonify({"message": result_message})

if __name__ == "__main__":
    app.run(port=5001, debug=True)
