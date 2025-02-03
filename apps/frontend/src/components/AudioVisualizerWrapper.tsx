import React, { useState, useEffect } from 'react';
import AudioMidiViewerBase from './AudioMidiViewer/AudioMidiViewer';
const AudioMidiViewer = AudioMidiViewerBase as any;

const API_BASE = 'http://localhost:5000';

const AudioVisualizerWrapper = ({ stemData, midiUrl, jsonUrl } : any) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validatedSettings, setValidatedSettings] = useState<any>(null);
  
  const getFullUrl = (url : string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;

    // Handle case where the URL is just a filename
    if (!url.includes('/')) {
          return `${API_BASE}/api/audio/downloads/${url}`;
    }
  
    return `${API_BASE}${url}`;
  };

  const prepareSettings = () => {
    if (!stemData || !midiUrl) return null;
    
    return {
      audio: {
        drums: stemData?.drums ? getFullUrl(stemData.drums) : '',
        bass: stemData?.bass ? getFullUrl(stemData.bass) : '',
        other: stemData?.other ? getFullUrl(stemData.other) : '',
        backing_vocals: stemData?.backing_vocals ? getFullUrl(stemData.backing_vocals) : '',
        lead_vocals: stemData?.lead_vocals ? getFullUrl(stemData.lead_vocals) : ''

      },
      midi: getFullUrl(midiUrl),
      json: getFullUrl(jsonUrl),
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
        
        // Validate MIDI file
        const midiResponse = await fetch(settings.midi);
        if (!midiResponse.ok) {
          console.error('MIDI response:', {
            status: midiResponse.status,
            statusText: midiResponse.statusText,
            url: settings.midi
          });
          throw new Error(`MIDI file not accessible (Status: ${midiResponse.status} - ${midiResponse.statusText})`);
        }

        // Validate audio stems
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
      } catch (err: any) {
        console.error('Resource validation error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    validateResources();
  }, [stemData, midiUrl, jsonUrl]);

  if (!stemData || !midiUrl) {
    return (
      <div className="p-4">
        <p>Waiting for audio data...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500">Error: {error}</p>
        <p className="text-gray-600 text-sm mt-2">
          Please ensure all audio files are processed and available.
        </p>
        <pre className="mt-4 p-4 bg-gray-100 rounded text-xs overflow-auto">
          Debug Info:
          {JSON.stringify({
            midiUrl,
            stemData,
            error
          }, null, 2)}
        </pre>
      </div>
    );
  }

  if (!validatedSettings) {
    return (
      <div className="p-4">
        <p>Preparing audio visualization...</p>
      </div>
    );
  }

  return <AudioMidiViewer settings={validatedSettings} />;
};

export default AudioVisualizerWrapper;