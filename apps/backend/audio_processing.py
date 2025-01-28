from flask import Blueprint, request, jsonify, current_app, send_from_directory, copy_current_request_context
from concurrent.futures import ThreadPoolExecutor
import os
import logging
import yt_dlp
from song_features_retriever import SongFeaturesRetriever

logger = logging.getLogger(__name__)
audio_bp = Blueprint('audio', __name__)

# Create a thread pool executor
executor = ThreadPoolExecutor(max_workers=4)

@audio_bp.route('/process', methods=['POST'])
def process_audio():
    logger.info("Received audio processing request")
    
    data = request.get_json()
    if not data or 'title' not in data or 'artist' not in data:
        return jsonify({'status': 'error', 'message': 'Title and artist required'}), 400

    try:
        # Get the application context
        app = current_app._get_current_object()
        
        @copy_current_request_context
        def process_task():
            with app.app_context():
                try:
                    temp_dir = app.config['UPLOAD_FOLDER']
                    os.makedirs(temp_dir, exist_ok=True)
                    
                    # Initialize song processor
                    processor = SongFeaturesRetriever(temp_dir)
                    
                    # Download audio
                    search_query = f"{data['artist']} - {data['title']} audio"
                    audio_path = download_audio(search_query, temp_dir)
                    
                    # Process the song
                    results = processor.process_song(audio_path)
                    
                    # Prepare response paths
                    base_url = "/api/audio/downloads"
                    response_data = {
                        'status': 'success',
                        'tempo': results['tempo'],
                        'midi_url': f"{base_url}/{os.path.basename(results['midi_path'])}",
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

        # Submit the task to the executor
        future = executor.submit(process_task)
        result = future.result(timeout=300)  # 5-minute timeout
        
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
def download_file(filename):
    try:
        return send_from_directory(
            current_app.config['UPLOAD_FOLDER'],
            filename,
            as_attachment=True
        )
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