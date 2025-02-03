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
        """Get track information including tags/genres from LastFM"""
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
            data = response.json()
            logger.info(f"LastFM track info response for {title} by {artist}: {data}")
            return data
        except Exception as e:
            logger.error(f"LastFM track info error for {title} by {artist}: {e}")
            return None

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
            logger.info(f"LastFM similar tracks response: {data}")
            return data
        except Exception as e:
            logger.error(f"LastFM similar tracks error: {e}")
            return {'similartracks': {'track': []}}

    def get_track_genres(self, artist: str, title: str) -> List[str]:
        """Get genres for a specific track from LastFM tags"""
        track_info = self.get_track_info(artist, title)
        genres = set()
        
        if track_info and 'track' in track_info:
            track_data = track_info['track']
            if 'toptags' in track_data and 'tag' in track_data['toptags']:
                for tag in track_data['toptags']['tag']:
                    if isinstance(tag, dict) and 'name' in tag:
                        genres.add(tag['name'].lower())
        
        logger.info(f"Found genres for {title} by {artist}: {genres}")
        return list(genres)
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
        """Clean input text"""
        text = text.strip()
        return text

    def _get_track_genres(self, artist: str, title: str) -> List[str]:
        """Get combined genres from both services"""
        genres = set()
        
        # Get LastFM genres
        lastfm_genres = self.lastfm.get_track_genres(artist, title)
        genres.update(lastfm_genres)
        
        # Get MusicBrainz genres
        mb_track = self.musicbrainz.search_recording(title, artist)
        if mb_track and 'tag-list' in mb_track:
            for tag in mb_track['tag-list']:
                if isinstance(tag, dict) and 'name' in tag:
                    genres.add(tag['name'].lower())
        
        # Normalize common genre variations
        genre_mapping = {
            'classic rock': ['rock'],
            'pop rock': ['rock', 'pop'],
            'indie rock': ['rock', 'indie'],
            'hard rock': ['rock'],
            'folk rock': ['rock', 'folk'],
            'punk rock': ['rock', 'punk']
        }
        
        normalized_genres = set()
        for genre in genres:
            normalized_genres.add(genre)
            if genre in genre_mapping:
                normalized_genres.update(genre_mapping[genre])
        
        return list(normalized_genres)

    def _matches_genre_filter(self, track_genres: List[str], genre_filter: List[str]) -> bool:
        """Check if track matches any genre in filter"""
        if not genre_filter:
            return True
        
        track_genres_set = {genre.lower() for genre in track_genres}
        filter_genres_set = {genre.lower() for genre in genre_filter}
        
        return bool(track_genres_set & filter_genres_set)

    def get_recommendations(self, title: str, artist: str, limit: int = 10, genre_filter: Optional[List[str]] = None) -> List[Dict]:
        """Get recommendations with proper genre filtering"""
        try:
            clean_title = self._clean_input(title)
            clean_artist = self._clean_input(artist)
            
            logger.info(f"Getting recommendations for {clean_title} by {clean_artist}")
            
            # Get similar tracks
            response = self.lastfm.get_similar_tracks(clean_artist, clean_title, limit * 2)
            similar_tracks = response.get('similartracks', {}).get('track', [])
            
            if not similar_tracks and 'error' in response:
                # Try with original input
                response = self.lastfm.get_similar_tracks(artist, title, limit * 2)
                similar_tracks = response.get('similartracks', {}).get('track', [])
            
            recommendations = []
            processed = 0
            
            for track in similar_tracks:
                if not isinstance(track, dict):
                    continue
                    
                processed += 1
                if processed > limit * 3:  # Process max 3x limit to avoid too many API calls
                    break
                
                track_artist = track.get('artist', {}).get('name', '') if isinstance(track.get('artist'), dict) else track.get('artist', '')
                track_title = track.get('name', '')
                
                if not track_artist or not track_title:
                    continue
                
                # Get genres for the track
                track_genres = self._get_track_genres(track_artist, track_title)
                
                # Skip if doesn't match genre filter
                if not self._matches_genre_filter(track_genres, genre_filter):
                    continue
                
                recommendation = {
                    'title': track_title,
                    'artist': track_artist,
                    'similarity': float(track.get('match', 0.5)),
                    'genres': sorted(track_genres),  # Sort genres for consistency
                    'sources': ['LastFM']
                }
                
                # Add MusicBrainz data
                mb_track = self.musicbrainz.search_recording(track_title, track_artist)
                if mb_track:
                    recommendation['sources'].append('MusicBrainz')
                
                recommendations.append(recommendation)
                
                if len(recommendations) >= limit:
                    break
            
            logger.info(f"Found {len(recommendations)} recommendations matching criteria")
            return recommendations
            
        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            logger.exception("Full traceback:")
            return []