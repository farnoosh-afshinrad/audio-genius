from flask import Blueprint, request, jsonify, current_app, send_from_directory, copy_current_request_context
from concurrent.futures import ThreadPoolExecutor
import os
import logging
from flask_cors import CORS, cross_origin
import yt_dlp
from song_features_retriever import SongFeaturesRetriever

logger = logging.getLogger(__name__)
audio_bp = Blueprint('audio', __name__)

# Enable CORS for the blueprint
CORS(audio_bp, resources={
    r"/process": {"origins": ["http://localhost:4200"]},
    r"/downloads/*": {
        "origins": ["http://localhost:4200"],
        "methods": ["GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "If-None-Match"]
    }
})

def safe_execute(task, timeout=3000):
    """Safely execute a task using the app's executor"""
    try:
        executor = current_app.executor
        if not executor:
            raise RuntimeError("Executor not initialized")
        
        future = executor.submit(task)
        return future.result(timeout=timeout)
    except Exception as e:
        logger.error(f"Execution error: {e}")
        raise

@audio_bp.route('/process', methods=['POST'])
def process_audio():
    logger.info("Received audio processing request")
    
    data = request.get_json()
    if not data or 'title' not in data or 'artist' not in data:
        return jsonify({'status': 'error', 'message': 'Title and artist required'}), 400

    try:
        app = current_app._get_current_object()
        
        @copy_current_request_context
        def process_task():
            with app.app_context():
                try:
                    temp_dir = app.config['UPLOAD_FOLDER']
                    os.makedirs(temp_dir, exist_ok=True)
                    
                    processor = SongFeaturesRetriever(temp_dir)
                    
                    search_query = f"{data['artist']} - {data['title']} audio"
                    audio_path = download_audio(search_query, temp_dir)
                    
                    results = processor.process_song(audio_path)
                    
                    base_url = "/api/audio/downloads"
                    response_data = {
                        'status': 'success',
                        'tempo': results['tempo'],
                        'midi_url': f"{base_url}/{os.path.basename(results['midi_path'])}",
                        'json_url': f"{base_url}/{os.path.basename(results['json_path'])}",
                        'melody': results['melody'],
                        'stems': {
                            name: f"{base_url}/{os.path.basename(path)}"
                            for name, path in results['stems'].items()
                        }
                    }
                    
                    return response_data
                    
                except Exception as e:
                    logger.error(f"Error in processing task: {e}")
                    return {'status': 'error', 'message': str(e)}

        result = safe_execute(process_task)
        
        if result.get('status') == 'error':
            return jsonify(result), 500
            
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error processing audio: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

def download_audio(search_query: str, output_dir: str) -> str:
    """Download audio using yt-dlp"""
    os.makedirs(output_dir, exist_ok=True)
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(f"ytsearch1:{search_query}", download=True)
            if not info:
                raise Exception("No audio found")
            
            video_info = info['entries'][0]
            downloaded_file = os.path.join(output_dir, f"{video_info['id']}.mp3")
            
            if not os.path.exists(downloaded_file):
                raise Exception(f"File not found at: {downloaded_file}")
                
            return downloaded_file
            
        except Exception as e:
            logger.error(f"Download error: {e}")
            raise

@audio_bp.route('/downloads/<filename>')
@cross_origin()
def download_file(filename):
    try:
        processed_dir = current_app.config['PROCESSED_DIR']
        upload_dir = current_app.config['UPLOAD_FOLDER']
        
        # check in processed directory
        if os.path.exists(os.path.join(processed_dir, filename)):
            response = send_from_directory(
                processed_dir,
                filename,
                as_attachment=True
            )
        elif os.path.exists(os.path.join(upload_dir, filename)):
            response = send_from_directory(
                upload_dir,
                filename,
                as_attachment=True
            )
        else:
            logger.error(f"File not found: {filename}")
            return jsonify({
                'status': 'error', 
                'message': f'File not found: {filename}'
            }), 404
        # Add CORS headers explicitly
        #response.headers['Access-Control-Allow-Origin'] = 'http://localhost:4200'
        #response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        #response.headers['Access-Control-Allow-Headers'] = 'Content-Type, If-None-Match'
        return response
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@audio_bp.route('/cleanup', methods=['POST'])
def cleanup_files():
    try:
        with current_app.app_context():
            processor = SongFeaturesRetriever(current_app.config['UPLOAD_FOLDER'])
            processor.cleanup()
            return jsonify({'status': 'success', 'message': 'Cleanup completed'})
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500