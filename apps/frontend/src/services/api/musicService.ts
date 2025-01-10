// src/services/api/musicService.ts
import type {  RecommendationResponse } from '../../types/audio';
import type  { MusicSearchData } from '../../types/audio';

const API_BASE_URL = 'http://localhost:5000/api';

class MusicService {
  async getRecommendations(searchData: MusicSearchData): Promise<RecommendationResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: searchData.title,
          artist: searchData.artist,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred');
    }
  }
}

export const musicService = new MusicService();

export { MusicSearchData };
