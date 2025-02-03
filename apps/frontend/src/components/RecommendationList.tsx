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
  Link,
  CircularProgress,
} from '@mui/material';
import { AudioWaveform } from 'lucide-react';
import { ChevronDown, ChevronUp, Music } from 'lucide-react';
import { useState } from 'react';
import * as Tone from 'tone';
import AudioVisualization from './AudioVisualization';
import AudioVisualizerWrapper from './AudioVisualizerWrapper';
import AudioMidiViewerBase from './AudioMidiViewer/AudioMidiViewer';
const AudioMidiViewer = AudioMidiViewerBase as any;


interface Recommendation {
  title: string;
  artist: string;
  similarity: number;
  sources: string[];
  genres?: string[];
  tags?: string[];
}

interface AudioProcessingResponse {
  status: string;
  tempo: number;
  midi_url: string;
  json_url: string,
  melody: number[];
  stems: {
    vocals: string;
    drums: string;
    bass: string;
    other: string;
  };
}

interface AudioProcessingStatus {
  stemData: {};
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
  const [audioStatus, setAudioStatus] = useState<{ [key: number]: any }>({});
  const [isPlaying, setIsPlaying] = useState<number | null>(null);

  const settings = {
    audio: {
      drums: "/audio/drums.mp3",
      bass: "/audio/bass.mp3",
      other: "/audio/other.mp3",
      lead: "/audio/lead_vocals.mp3",
      backing: "/audio/backing_vocals.mp3"
    },
    midi: "/audio/transcription.mid",
    json: "/audio/contour.json",
    height: "500",
    width: "1000"
  };

  const handleExpandClick = (index: number) => {
    setExpandedItem(expandedItem === index ? null : index);
  };

  const handleProcessAudio = async (
    index: number,
    title: string,
    artist: string
  ) => {
    setAudioStatus((prev) => ({
      ...prev,
      [index]: {
        isProcessing: true,
        error: null,
        midiData: null,
        melodyData: null,
        stemData: null,
      },
    }));

    try {
      const response = await fetch('http://localhost:5000/api/audio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist }),
      });

      if (!response.ok) throw new Error('Failed to process audio');

      const data: AudioProcessingResponse = await response.json();
      setAudioStatus((prev) => ({
        ...prev,
        [index]: {
          isProcessing: false,
          error: null,
          midiData: data.midi_url,
          jsonData:data.json_url,
          melodyData: data.melody,
          stemData: data.stems,
        },
      }));
    } catch (error) {
      setAudioStatus((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Processing failed',
        },
      }));
    }
  };

  const playMelody = async (index: number) => {
    if (!audioStatus[index]?.melodyData) return;

    if (isPlaying === index) {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
      setIsPlaying(null);
      return;
    }

    const synth = new Tone.Synth().toDestination();
    const now = Tone.now();
    const melody = audioStatus[index].melodyData;

    // Stop any currently playing melody
    if (isPlaying !== null) {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
    }

    // Play the new melody
    setIsPlaying(index);
    melody.forEach((note: Tone.Unit.Frequency, i: number) => {
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
            <Box
              sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}
            >
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
                      {/* {rec.genres.map} */}


                    </Box>
                  </Box>
                }
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

                <IconButton onClick={() => handleExpandClick(index)}>
                  {expandedItem === index ? <ChevronUp /> : <ChevronDown />}
                </IconButton>
              </Box>
            </Box>
            

            <Collapse in={expandedItem === index}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {!audioStatus[index] && (
                  <Button
                    startIcon={<Music />}
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      handleProcessAudio(index, rec.title, rec.artist)
                    }
                  >
                    Process Audio
                  </Button>
                )}
                {audioStatus[index]?.isProcessing && (
                  <CircularProgress size={24} />
                )}
                {audioStatus[index]?.stemData && (                  
                  <>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Melody Visualization
                      </Typography>
                      <AudioVisualizerWrapper 
                      stemData={audioStatus[index]?.stemData}
                      jsonUrl={audioStatus[index]?.jsonData}
                      midiUrl={audioStatus[index]?.midiData}
                      />
                    </Box>
                  </>
                )}
              </Box>
              <Box sx={{ mt: 2, ml: 2 }}>
                {audioStatus[index]?.midiData && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Downloads
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        href={audioStatus[index].midiData}
                        download
                      >
                        MIDI File
                      </Button>
                      {Object.entries(audioStatus[index].stemData || {}).map(
                        ([name, url]) => (
                          <Button
                            key={name}
                            size="small"
                            variant="outlined"
                            href={url as string }
                            download
                          >
                            {name.charAt(0).toUpperCase() + name.slice(1)}
                          </Button>
                        )
                      )}
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
