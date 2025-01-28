from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import logging
from music_services import LastFMService, MusicBrainzService, RecommendationEngine
from audio_processing import audio_bp
from concurrent.futures import ThreadPoolExecutor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
# Initialize ThreadPoolExecutor
executor = ThreadPoolExecutor(max_workers=4)

# Add to app context
app.executor = executor

# Initialize services
lastfm_service = LastFMService(os.getenv('LASTFM_API_KEY'))
musicbrainz_service = MusicBrainzService(
    "YourAppName",
    "1.0",
    os.getenv('CONTACT_EMAIL', 'your@email.com')
)
recommendation_engine = RecommendationEngine(lastfm_service, musicbrainz_service)

# Register the audio processing blueprint
app.register_blueprint(audio_bp, url_prefix='/api/audio')

# Existing routes
@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    logger.info("Received recommendation request")
    try:
        data = request.json
        logger.info(f"Request data: {data}")

        if not data:
            logger.error("No data provided in request")
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400
        
        if 'title' not in data or 'artist' not in data:
            logger.error("Missing title or artist in request")
            return jsonify({'status': 'error', 'message': 'Missing title or artist'}), 400

        # Get optional filters
        genre_filter = data.get('genres', [])
        limit = data.get('limit', 10)

        logger.info(f"Making recommendation request with filters: genres={genre_filter}, limit={limit}")

        # Get recommendations
        recommendations = recommendation_engine.get_recommendations(
            data['title'],
            data['artist'],
            limit=limit,
            genre_filter=genre_filter
        )

        logger.info(f"Got recommendations: {recommendations}")

        if not recommendations:
            logger.warning("No recommendations found")
            return jsonify({
                'status': 'success',
                'recommendations': [],
                'message': 'No recommendations found for this track.'
            })

        return jsonify({
            'status': 'success',
            'recommendations': recommendations
        })

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        logger.exception("Full traceback:")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/genres', methods=['GET'])
def get_genres():
    """Get available genres for filtering"""
    try:
        genres = [
            "Rock", "Pop", "Hip Hop", "Jazz", "Classical", "Electronic",
            "Folk", "Country", "R&B", "Metal", "Blues", "Reggae"
        ]
        return jsonify({
            'status': 'success',
            'genres': genres
        })
    except Exception as e:
        logger.error(f"Error getting genres: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Configuration for file uploads
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp/uploads')

# Add after existing config
app.config['TEMP_AUDIO_DIR'] = os.path.join(app.config['UPLOAD_FOLDER'], 'audio')
app.config['PROCESSED_DIR'] = os.path.join(app.config['UPLOAD_FOLDER'], 'processed')

# Create necessary directories
for directory in [app.config['TEMP_AUDIO_DIR'], app.config['PROCESSED_DIR']]:
    os.makedirs(directory, exist_ok=True)

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.teardown_appcontext
def shutdown_executor(exception=None):
    """Properly shutdown the executor when the app context is torn down"""
    executor = getattr(app, 'executor', None)
    if executor:
        executor.shutdown(wait=True)

if __name__ == '__main__':
    app.run(debug=True)