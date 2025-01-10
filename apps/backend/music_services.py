import requests
import musicbrainzngs
from typing import Dict, List, Optional
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class LastFMService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "http://ws.audioscrobbler.com/2.0/"

    @lru_cache(maxsize=100)
    def get_track_info(self, artist: str, title: str) -> Optional[Dict]:
        """Get track information from LastFM"""
        params = {
            'method': 'track.getInfo',
            'artist': artist,
            'track': title,
            'api_key': self.api_key,
            'format': 'json'
        }
        try:
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"LastFM track info error: {e}")
            return None

    @lru_cache(maxsize=100)
    def get_similar_tracks(self, artist: str, title: str, limit: int = 10) -> Dict:
        """Get similar tracks from LastFM"""
        params = {
            'method': 'track.getSimilar',
            'artist': artist,
            'track': title,
            'limit': limit,
            'api_key': self.api_key,
            'format': 'json'
        }
        try:
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()
            logger.info(f"LastFM API response: {data}")  # Add logging to see the response
            return data
        except Exception as e:
            logger.error(f"LastFM similar tracks error: {e}")
            return {'similartracks': {'track': []}}

class MusicBrainzService:
    def __init__(self, app_name: str, version: str, contact: str):
        musicbrainzngs.set_useragent(app_name, version, contact)
    
    @lru_cache(maxsize=100)
    def search_recording(self, title: str, artist: str) -> Optional[Dict]:
        """Search for a recording in MusicBrainz"""
        try:
            result = musicbrainzngs.search_recordings(
                query=f'recording:"{title}" AND artist:"{artist}"',
                limit=1
            )
            if result['recording-list']:
                return result['recording-list'][0]
            return None
        except Exception as e:
            logger.error(f"MusicBrainz search error: {e}")
            return None

class RecommendationEngine:
    def __init__(self, lastfm_service: LastFMService, musicbrainz_service: MusicBrainzService):
        self.lastfm = lastfm_service
        self.musicbrainz = musicbrainz_service

    def _clean_input(self, text: str) -> str:
        """Clean input text by removing extra spaces and fixing common issues"""
        # Remove leading/trailing spaces
        text = text.strip()
        
        # Fix common artist name variations
        artist_corrections = {
            'lana del ray': 'Lana Del Rey',
            'lana del rey': 'Lana Del Rey',
            'the beatles': 'The Beatles',
            'pink floyd': 'Pink Floyd',
            # Add more corrections as needed
        }
        
        # Check if this is a known artist name that needs correction
        lower_text = text.lower()
        if lower_text in artist_corrections:
            return artist_corrections[lower_text]
            
        # Capitalize first letter of each word for other cases
        return ' '.join(word.capitalize() for word in text.split())

    def get_recommendations(self, title: str, artist: str, limit: int = 10, genre_filter: Optional[List[str]] = None) -> List[Dict]:
        """Get recommendations using both services"""
        try:
            # Clean the input
            clean_title = self._clean_input(title)
            clean_artist = self._clean_input(artist)
            
            # Log the cleaned input
            logger.info(f"Getting recommendations for: {clean_title} by {clean_artist}")
            
            # Get similar tracks from LastFM
            response = self.lastfm.get_similar_tracks(clean_artist, clean_title, limit)
            
            # Log the raw response
            logger.info(f"Raw LastFM response: {response}")
            
            # If we got an error response, try searching with alternative spellings
            if 'error' in response:
                # Try with the original input as a fallback
                logger.info("Trying original input as fallback...")
                response = self.lastfm.get_similar_tracks(artist.strip(), title.strip(), limit)
                
                if 'error' in response:
                    logger.error(f"LastFM error: {response.get('message', 'Unknown error')}")
                    return []
            
            # Extract the tracks from the response
            similar_tracks = response.get('similartracks', {})
            if isinstance(similar_tracks, dict):
                tracks = similar_tracks.get('track', [])
            else:
                tracks = []
            
            # Log the extracted tracks
            logger.info(f"Extracted tracks: {tracks}")
            
            recommendations = []
            for track in tracks:
                if isinstance(track, dict):
                    recommendation = {
                        'title': track.get('name', ''),
                        'artist': track.get('artist', {}).get('name', '') if isinstance(track.get('artist'), dict) else track.get('artist', ''),
                        'similarity': float(track.get('match', 0.5)),
                        'sources': ['LastFM']
                    }
                    
                    # Try to get MusicBrainz data
                    mb_track = self.musicbrainz.search_recording(
                        recommendation['title'], 
                        recommendation['artist']
                    )
                    if mb_track:
                        recommendation['sources'].append('MusicBrainz')
                    
                    recommendations.append(recommendation)
            
            # Filter by genre if specified
            if genre_filter:
                # You might want to implement genre filtering here
                pass
            
            # Log the final recommendations
            logger.info(f"Final recommendations: {recommendations}")
            
            return recommendations[:limit]
            
        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            logger.exception("Full traceback:")
            return []