import React, { useState, useRef, useEffect } from 'react';
import { Paper, Box, IconButton } from '@mui/material';
import { PlayCircle, PauseCircle } from 'lucide-react';
import * as Tone from 'tone';

interface AudioVisualizationProps {
  melodyData: number[];
}

const PianoKey = ({ note, isBlack }: { note: number; isBlack: boolean }) => {
  return (
    <Box
      sx={{
        width: isBlack ? 32 : 48,
        height: isBlack ? 80 : 128,
        bgcolor: isBlack ? 'grey.900' : 'white',
        borderLeft: 1,
        borderColor: 'grey.200',
        borderRadius: '0 0 4px 4px',
        boxShadow: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        pb: 1,
        marginX: isBlack ? -2 : 0,
        zIndex: isBlack ? 1 : 0,
        '&:hover': {
          bgcolor: isBlack ? 'grey.800' : 'grey.50'
        },
        transition: 'background-color 0.2s'
      }}
    >
      <Box sx={{ 
        fontSize: 12, 
        color: isBlack ? 'grey.400' : 'grey.500' 
      }}>
        {note}
      </Box>
    </Box>
  );
};

const AudioVisualization = ({ melodyData }: AudioVisualizationProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<Tone.Synth | null>(null);
  
  const startNote = 60;
  const endNote = 84;
  
  const allNotes = Array.from(
    { length: endNote - startNote + 1 },
    (_, i) => startNote + i
  );

  const isBlackNote = (note: number) => {
    const noteInOctave = note % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop } = scrollContainerRef.current;
      setScrollPosition(scrollTop);
      
      const start = Math.floor(scrollTop / 20);
      const end = start + Math.ceil(scrollContainerRef.current.clientHeight / 20);
      setVisibleRange({ start, end });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const playMelody = async () => {
    if (!isPlaying) {
      synthRef.current = new Tone.Synth().toDestination();
      await Tone.start();
      setIsPlaying(true);

      const now = Tone.now();
      const noteLength = 0.1;

      melodyData.forEach((note, i) => {
        if (note > 0) {
          const playTime = now + (i * noteLength);
          const freq = Tone.Frequency(note, "midi").toFrequency();
          synthRef.current?.triggerAttackRelease(freq, "16n", playTime);
        }
      });

      setTimeout(() => {
        stopMelody();
      }, melodyData.length * noteLength * 1000);
    }
  };

  const stopMelody = () => {
    setIsPlaying(false);
    if (synthRef.current) {
      synthRef.current.dispose();
      synthRef.current = null;
    }
  };

  const visibleNotes = melodyData
    .slice(visibleRange.start, visibleRange.end + 1)
    .map((note, index) => ({
      note,
      index: index + visibleRange.start
    }));

  return (
    <Paper elevation={2} sx={{ p: 2, width: '100%', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <IconButton onClick={isPlaying ? stopMelody : playMelody} color="primary">
          {isPlaying ? <PauseCircle /> : <PlayCircle />}
        </IconButton>
      </Box>

      <Box 
        ref={scrollContainerRef}
        sx={{ 
          height: 400,
          width: '100%',
          bgcolor: 'grey.50',
          position: 'relative',
          border: 1,
          borderColor: 'grey.200',
          borderRadius: 1,
          overflowY: 'auto',
          mt: 2
        }}
      >
        <Box 
          sx={{
            position: 'absolute',
            width: '100%',
            height: `${melodyData.length * 20}px`
          }}
        >
          {visibleNotes.map(({ note, index }) => {
            if (note === 0) return null;
            const left = ((note - startNote) * 48);
            return (
              <Box
                key={index}
                sx={{
                  position: 'absolute',
                  width: 40,
                  height: 16,
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                  opacity: 0.8,
                  left: `${left}px`,
                  top: `${index * 20}px`,
                  '&:hover': {
                    opacity: 1,
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s'
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Box sx={{ 
        fontSize: 14, 
        color: 'text.secondary',
        mt: 2 
      }}>
        Notes: {melodyData.length} | 
        Scroll Position: {scrollPosition}px | 
        Visible Range: {visibleRange.start}-{visibleRange.end}
      </Box>

      <Box sx={{ display: 'flex', position: 'relative', pl: 1 }}>
        {allNotes.map(note => (
          <PianoKey 
            key={note}
            note={note}
            isBlack={isBlackNote(note)}
          />
        ))}
      </Box>
    
    </Paper>
  );
};

export default AudioVisualization;