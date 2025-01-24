from flask import Blueprint, request, jsonify, current_app, send_from_directory
import os
import logging
import yt_dlp
from midi_extractor import MidiExtractor

logger = logging.getLogger(__name__)
audio_bp = Blueprint('audio', __name__)

@audio_bp.route('/process', methods=['POST'])
def process_audio():
    logger.info("Received audio processing request")
    
    # Validate request data
    data = request.get_json()
    if not data:
        logger.error("No JSON data in request")
        return jsonify({
            'status': 'error',
            'message': 'No data provided'
        }), 400
        
    title = data.get('title')
    artist = data.get('artist')
    
    if not title or not artist:
        logger.error("Missing title or artist")
        return jsonify({
            'status': 'error',
            'message': 'Title and artist are required'
        }), 400

    try:
        # Create temporary directory if it doesn't exist
        temp_dir = os.path.join(current_app.config['UPLOAD_FOLDER'])
        os.makedirs(temp_dir, exist_ok=True)
        
        # Download audio using yt-dlp
        search_query = f"{artist} - {title} audio"
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True
        }
        
        logger.info(f"Attempting to download audio for: {search_query}")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                # Search for the video
                info = ydl.extract_info(f"ytsearch:{search_query}", download=True)
                
                if 'entries' not in info or not info['entries']:
                    raise Exception("No audio found for the requested song")
                    
                # Get the downloaded file path
                downloaded_title = info['entries'][0]['title']
                audio_file = os.path.join(temp_dir, f"{downloaded_title}.mp3")
                
                logger.info(f"Successfully downloaded audio to: {audio_file}")
                
                # Process audio using MidiExtractor
                extractor = MidiExtractor()
                midi, melody = extractor.waveToMidi(audio_file)
                
                # Save MIDI file
                midi_filename = f"{title}_{artist}.mid".replace(" ", "_").lower()
                midi_path = os.path.join(temp_dir, midi_filename)
                
                with open(midi_path, "wb") as outfile:
                    midi.writeFile(outfile)
                
                logger.info(f"Successfully created MIDI file: {midi_path}")
                
                # Clean up the downloaded audio file
                if os.path.exists(audio_file):
                    os.remove(audio_file)
                    logger.info(f"Cleaned up audio file: {audio_file}")
                
                return jsonify({
                    'status': 'success',
                    'midi_path': f"/api/audio/downloads/{midi_filename}",
                    'melody': melody
                }), 200
                
            except Exception as ydl_err:
                logger.error(f"YouTube-DL error: {str(ydl_err)}")
                raise Exception(f"Failed to download audio: {str(ydl_err)}")
            
    except Exception as e:
        logger.error(f"Error processing audio: {e}")
        logger.exception("Full traceback:")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@audio_bp.route('/downloads/<filename>')
def download_file(filename):
    """Endpoint to download processed files"""
    try:
        logger.info(f"Attempting to download file: {filename}")
        return send_from_directory(
            current_app.config['UPLOAD_FOLDER'],
            filename,
            as_attachment=True
        )
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Optional: Cleanup endpoint for maintenance
@audio_bp.route('/cleanup', methods=['POST'])
def cleanup_files():
    """Administrative endpoint to clean up old files"""
    try:
        temp_dir = current_app.config['UPLOAD_FOLDER']
        for filename in os.listdir(temp_dir):
            file_path = os.path.join(temp_dir, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
        return jsonify({
            'status': 'success',
            'message': 'Cleanup completed successfully'
        })
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500