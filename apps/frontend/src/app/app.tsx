import { useEffect, useState } from 'react';
import { Container, Box, Alert, Snackbar, Typography, Paper, createTheme, ThemeProvider, Card, CardHeader, CardContent } from '@mui/material';
import MusicSearchForm from '../components/MusicSearchForm';
import RecommendationsList from '../components/RecommendationList';
import GenreFilter from '../components/GenreFilter';
import { Music, Search } from 'lucide-react';

import type { Recommendation } from '../types/audio';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#9333ea', // Purple-600
      light: '#a855f7',
      dark: '#7e22ce',
    },
    secondary: {
      main: '#ec4899', // Pink-500
    },
    background: {
      default: '#111827', // Gray-900
      paper: '#1f2937', // Gray-800
    },
    text: {
      primary: '#fff',
      secondary: '#9ca3af', // Gray-400
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1f2937', // Gray-800
          borderColor: '#374151', // Gray-700
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          padding: '10px 16px',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#374151', // Gray-700
            '& fieldset': {
              borderColor: '#4b5563', // Gray-600
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
  },
});


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
    <ThemeProvider theme={theme}>
    <Box 
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #111827 0%, #1f2937 100%)',
        py: 6
      }}
    >
      <Container maxWidth="md">
        <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Music size={40} color={theme.palette.primary.light} />
          <Typography 
            variant="h3" 
            component="h1"
            sx={{
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #a855f7, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Velody
          </Typography>
        </Box>

        <Card elevation={3} sx={{ mb: 4 }}>
          <CardHeader
            title={
              <Typography variant="h5" color="text.primary">
                Search Settings
              </Typography>
            }
            subheader={
              <Typography variant="body2" color="text.secondary">
                Filter your music recommendations
              </Typography>
            }
          />
          <CardContent>
            <GenreFilter onGenresChange={handleGenresChange} />
          </CardContent>
        </Card>

        <Card elevation={3} sx={{ mb: 4 }}>
          <CardHeader
            title={
              <Typography variant="h5" color="text.primary">
                Find Similar Music
              </Typography>
            }
            subheader={
              <Typography variant="body2" color="text.secondary">
                Enter a song to get recommendations
              </Typography>
            }
          />
          <CardContent>
            <MusicSearchForm onSubmit={handleSubmit} loading={loading} />
          </CardContent>
        </Card>

        {recommendations.length > 0 && (
          <Card elevation={3} sx={{ mb: 4 }}>
            <CardHeader
              title={
                <Typography variant="h5" color="text.primary">
                  Recommendations
                </Typography>
              }
            />
            <CardContent>
              <RecommendationsList recommendations={recommendations} />
            </CardContent>
          </Card>
        )}

        <Snackbar 
          open={!!error} 
          autoHideDuration={6000} 
          onClose={() => setError(null)}
        >
          <Alert 
            severity="error" 
            variant="filled"
            onClose={() => setError(null)}
            sx={{ width: '100%' }}
          >
            {error}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  </ThemeProvider>
  );
}

export default App;