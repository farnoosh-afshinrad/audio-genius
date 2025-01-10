 
export interface Recommendation {
    title: string;
    artist: string;
    similarity: number;
    sources: string[];
    genres?: string[];
    tags?: string[];
}

export interface MusicSearchData {
    title: string;
    artist: string;
    audioFile?: File | null;
  }
  
export interface RecommendationResponse {
    status: string;
    recommendations: Recommendation[];
    original_tags?: string[];
  }