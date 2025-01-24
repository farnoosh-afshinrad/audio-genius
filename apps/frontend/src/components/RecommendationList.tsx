import { 
  List, 
  ListItem, 
  ListItemText, 
  Paper, 
  Typography, 
  Chip,
  Box,
  Collapse,
  IconButton,
  Button,
  CircularProgress
} from '@mui/material';
import { AudioWaveform } from 'lucide-react';
import { ChevronDown, ChevronUp, Music } from 'lucide-react';
import { useState } from 'react';
import * as Tone from 'tone';

interface Recommendation {
  title: string;
  artist: string;
  similarity: number;
  sources: string[];
  genres?: string[];
  tags?: string[];
}

interface AudioProcessingStatus {
  isProcessing: boolean;
  error: string | null;
  midiData: any | null;
  melodyData: number[] | null;
}

interface RecommendationsListProps {
  recommendations: Recommendation[];
}

const RecommendationsList = ({ recommendations }: RecommendationsListProps) => {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [audioStatus, setAudioStatus] = useState<{ [key: number]: AudioProcessingStatus }>({});
  const [isPlaying, setIsPlaying] = useState<number | null>(null);

  const handleExpandClick = (index: number) => {
    setExpandedItem(expandedItem === index ? null : index);
  };

  const handleProcessAudio = async (index: number, title: string, artist: string) => {
    // Set initial processing state
    setAudioStatus(prev => ({
      ...prev,
      [index]: {
        isProcessing: true,
        error: null,
        midiData: null,
        melodyData: null
      }
    }));

    try {
      // Call your backend API to process the audio
      const response = await fetch('http://localhost:5000/api/audio/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, artist })
      });

      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      const data = await response.json();

      // Update status with processed data
      setAudioStatus(prev => ({
        ...prev,
        [index]: {
          isProcessing: false,
          error: null,
          midiData: data.midi_path,
          melodyData: data.melody
        }
      }));
    } catch (error) {
      setAudioStatus(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          isProcessing: false,
        }
      }));
    }
  };

  const playMelody = async (index: number) => {
    if (!audioStatus[index]?.melodyData) return;

    if (isPlaying === index) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      setIsPlaying(null);
      return;
    }

    const synth = new Tone.Synth().toDestination();
    const now = Tone.now();
    const melody = audioStatus[index].melodyData;

    // Stop any currently playing melody
    if (isPlaying !== null) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    }

    // Play the new melody
    setIsPlaying(index);
    melody.forEach((note, i) => {
      if (note !== 0) {
        synth.triggerAttackRelease(note, '8n', now + i * 0.25);
      }
    });

    // Stop playing after the melody is complete
    setTimeout(() => {
      setIsPlaying(null);
    }, melody.length * 250);
  };

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Recommended Songs
      </Typography>
      <List>
        {recommendations.map((rec, index) => (
          <ListItem 
            key={index} 
            divider={index !== recommendations.length - 1}
            sx={{ flexDirection: 'column', alignItems: 'stretch' }}
          >
            <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
              <ListItemText
                primary={rec.title}
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {rec.artist}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip 
                        size="small" 
                        label={`${(rec.similarity * 100).toFixed(0)}% match`}
                        color="primary"
                        sx={{ mr: 1 }} 
                      />
                      {rec.sources.map((source, idx) => (
                        <Chip 
                          key={idx}
                          size="small" 
                          label={source}
                          variant="outlined"
                          sx={{ mr: 1 }} 
                        />
                      ))}
                    </Box>
                  </Box>
                }
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {!audioStatus[index] && (
                  <Button
                    startIcon={<Music />}
                    variant="outlined"
                    size="small"
                    onClick={() => handleProcessAudio(index, rec.title, rec.artist)}
                  >
                    Process Audio
                  </Button>
                )}
                {audioStatus[index]?.isProcessing && (
                  <CircularProgress size={24} />
                )}
                {audioStatus[index]?.melodyData && (
                  <IconButton 
                    onClick={() => playMelody(index)}
                    color={isPlaying === index ? "primary" : "default"}
                  >
                    <AudioWaveform />
                  </IconButton>
                )}
                <IconButton 
                  onClick={() => handleExpandClick(index)}
                >
                  {expandedItem === index ? <ChevronUp /> : <ChevronDown />}
                </IconButton>
              </Box>
            </Box>

            <Collapse in={expandedItem === index}>
              <Box sx={{ mt: 2, ml: 2 }}>
                {audioStatus[index]?.error && (
                  <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                    Error: {audioStatus[index].error}
                  </Typography>
                )}

                {audioStatus[index]?.melodyData && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Melody Visualization
                    </Typography>
                    <Box 
                      sx={{ 
                        height: '100px', 
                        background: '#f5f5f5',
                        borderRadius: 1,
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Add melody visualization here */}
                    </Box>
                  </Box>
                )}

                {rec.genres && rec.genres.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Genres
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {rec.genres.map((genre, idx) => (
                        <Chip 
                          key={idx}
                          size="small" 
                          label={genre}
                          color="secondary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {rec.tags && rec.tags.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {rec.tags.map((tag, idx) => (
                        <Chip 
                          key={idx}
                          size="small" 
                          label={tag}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default RecommendationsList;