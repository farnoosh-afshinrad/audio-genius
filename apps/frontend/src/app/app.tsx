import { useEffect, useState } from 'react';
import { Container, Box, Alert, Snackbar, Typography, Paper } from '@mui/material';
import MusicSearchForm from '../components/MusicSearchForm';
import RecommendationsList from '../components/RecommendationList';
import GenreFilter from '../components/GenreFilter';

import type { Recommendation } from '../types/audio';


function App() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const handleGenresChange = (genres: string[]) => {
    setSelectedGenres(genres);
  };

  const handleSubmit = async (data: { 
    title: string; 
    artist: string; 
    audioFile?: File | null 
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: data.title,
          artist: data.artist,
          genres: selectedGenres, // Include selected genres in the request
        }),
      });

      const result = await response.json();
      setSelectedGenres([])

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      if (result.status === 'error') {
        throw new Error(result.message);
      }

      setRecommendations(result.recommendations);
      
      if (result.recommendations.length === 0) {
        setError('No recommendations found for this track.');
      }
      
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while fetching recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Music Recommendations
      </Typography>
      
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Settings
        </Typography>
        <GenreFilter loading={loading} onGenresChange={handleGenresChange} />
      </Paper>
      
      <MusicSearchForm onSubmit={handleSubmit} loading={loading} />
      
      {recommendations.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <RecommendationsList recommendations={recommendations} />
        </Box>
      )}

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
      >
        <Alert 
          onClose={handleCloseError} 
          severity="error" 
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;