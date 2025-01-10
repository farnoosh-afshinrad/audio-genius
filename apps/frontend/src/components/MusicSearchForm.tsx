import { useState, ChangeEvent } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Paper,
  Typography,
  CircularProgress
} from '@mui/material';

interface MusicSearchFormProps {
  onSubmit: (data: { 
    title: string; 
    artist: string; 
    audioFile?: File | null 
  }) => Promise<void>;
  loading?: boolean; // Added loading prop to the interface
}

const MusicSearchForm = ({ onSubmit, loading = false }: MusicSearchFormProps) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit({ title, artist, audioFile });
      // Reset form only if submission was successful
      if (!loading) {
        setTitle('');
        setArtist('');
        setAudioFile(null);
      }
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAudioFile(e.target.files[0]);
    } else {
      setAudioFile(null);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <form onSubmit={handleSubmit}>
        <Typography variant="h6" gutterBottom>
          Find Similar Music
        </Typography>
        
        <TextField
          fullWidth
          label="Song Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          sx={{ mb: 2 }}
          disabled={loading}
        />

        <TextField
          fullWidth
          label="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          required
          sx={{ mb: 2 }}
          disabled={loading}
        />

        <Box sx={{ mb: 2 }}>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="audio-file-input"
            disabled={loading}
          />
          <label htmlFor="audio-file-input">
            <Button 
              component="span" 
              variant="outlined"
              disabled={loading}
            >
              Upload Audio (Optional)
            </Button>
          </label>
          {audioFile && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Selected file: {audioFile.name}
            </Typography>
          )}
        </Box>

        <Button 
          variant="contained" 
          type="submit"
          disabled={!title || !artist || loading}
          fullWidth
        >
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={24} color="inherit" />
              <span>Searching...</span>
            </Box>
          ) : (
            'Get Recommendations'
          )}
        </Button>
      </form>
    </Paper>
  );
};

export default MusicSearchForm;