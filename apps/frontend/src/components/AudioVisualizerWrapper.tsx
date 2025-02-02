
import React, { useState, useEffect } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';
import AudioMidiViewerBase from './AudioMidiViewer/AudioMidiViewer';
const AudioMidiViewer = AudioMidiViewerBase as any;


const API_BASE = 'http://localhost:5000';

const AudioVisualizerWrapper = ({ stemData, midiUrl, jsonUrl }: any) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validatedSettings, setValidatedSettings] = useState<any>(null);
  
  const getFullUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanUrl = url.replace(/^\/+/, '').replace(/\/+/g, '/');
    if (cleanUrl.startsWith('api/')) {
      return `${API_BASE}/${cleanUrl}`;
    }
    if (cleanUrl.includes('downloads/')) {
      return `${API_BASE}/api/audio/${cleanUrl}`;
    }
    return `${API_BASE}/api/audio/downloads/${cleanUrl}`;
  };

  const prepareSettings = () => {
    if (!stemData || !midiUrl) return null;
    
    return {
      audio: {
        drums: stemData?.drums ? getFullUrl(stemData.drums) : '',
        bass: stemData?.bass ? getFullUrl(stemData.bass) : '',
        other: stemData?.other ? getFullUrl(stemData.other) : '',
        vocals: stemData?.vocals ? getFullUrl(stemData.vocals) : ''
      },
      midi: getFullUrl(midiUrl),
      json: getFullUrl(jsonUrl), // Use the provided jsonUrl
      height: 600,
      width: 810
    };
  };

  useEffect(() => {
    const settings = prepareSettings();
    if (!settings) return;

    const validateResources = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('Validating MIDI URL:', settings.midi);
        
        // First check if MIDI file exists
        const midiResponse = await fetch(settings.midi);
        if (!midiResponse.ok) {
          console.error('MIDI response:', {
            status: midiResponse.status,
            statusText: midiResponse.statusText,
            url: settings.midi
          });
          throw new Error(`MIDI file not accessible (Status: ${midiResponse.status} - ${midiResponse.statusText})`);
        }

        // Check audio files that have URLs
        const audioUrls = Object.values(settings.audio).filter(url => url);
        if (audioUrls.length > 0) {
          await Promise.all(
            audioUrls.map(async (url) => {
              console.log('Checking audio URL:', url);
              const response = await fetch(url, { method: 'HEAD' });
              if (!response.ok) {
                throw new Error(`Audio file not found: ${url} (Status: ${response.status})`);
              }
            })
          );
        }

        setValidatedSettings(settings);
        setIsLoading(false);
      } catch (err : any) {
        console.error('Resource validation error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    validateResources();
  }, [stemData, midiUrl]);

  if (!stemData || !midiUrl) {
    return (
      <Box p={2}>
        <Typography>Waiting for audio data...</Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">
          Error: {error}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Please ensure all audio files are processed and available.
        </Typography>
        <Typography variant="caption" component="pre" className="mt-2 p-2 bg-gray-100 rounded">
          Debug Info:
          {JSON.stringify({
            midiUrl,
            stemData,
            error
          }, null, 2)}
        </Typography>
      </Box>
    );
  }

  if (!validatedSettings) {
    return (
      <Box p={2}>
        <Typography>Preparing audio visualization...</Typography>
      </Box>
    );
  }

  return <AudioMidiViewer settings={validatedSettings} />;
};

export default AudioVisualizerWrapper;