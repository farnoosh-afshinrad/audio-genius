import librosa
import os
from typing import Dict, Tuple
import logging
from demucs.apply import apply_model
import torch
import numpy as np
from midi_extractor import MidiExtractor
from stem_separator import StemSeparator

logger = logging.getLogger(__name__)

class SongFeaturesRetriever:
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir
        self.midi_extractor = MidiExtractor()
        self.stem_separator = StemSeparator()
        
    def process_song(self, audio_path: str) -> Dict:
        """Main processing pipeline"""
        # self._load_model()
        try:
            # # Create output directory
            # output_dir = os.path.join(self.temp_dir, 'processed_audio')
            # os.makedirs(output_dir, exist_ok=True)

            # print(f"Processing file: {audio_path}") # Debug line

            
            # # Extract tempo and other features
            # tempo = self._extract_tempo(audio_path)
            
            # # Separate stems
            # stem_paths = self.stem_separator.separate_stems(audio_path, output_dir)
            
            # # Process vocals
            # vocals_path = stem_paths['vocals']
            # enhanced_vocals = self.stem_separator.enhance_vocals(vocals_path, output_dir)
            
            # # Generate MIDI from vocals
            # midi, melody = self.midi_extractor.waveToMidi(enhanced_vocals)
            
            # # Save MIDI file
            # midi_path = os.path.join(output_dir, "transcribed.mid")
            # with open(midi_path, "wb") as outfile:
            #     midi.writeFile(outfile)
            # Load audio as mono
            output_dir = os.path.join(self.temp_dir, 'processed_audio')
            os.makedirs(output_dir, exist_ok=True)

            # Extract tempo
            tempo = self._extract_tempo(audio_path)
            
            # Process stems
            stem_paths = self.stem_separator.separate_stems(audio_path, output_dir)
            
            # Process vocals
            vocals_path = stem_paths['vocals']
            enhanced_vocals = self.stem_separator.enhance_vocals(vocals_path, output_dir)
            
            # Generate MIDI
            midi, melody = self.midi_extractor.waveToMidi(enhanced_vocals)
            
            # Save MIDI
            midi_path = os.path.join(output_dir, "transcribed.mid")
            with open(midi_path, "wb") as outfile:
                midi.writeFile(outfile)

            return {
             'tempo': tempo,
             'midi_path': midi_path,
             'melody': melody,
             'stems': stem_paths
            }
            
        except Exception as e:
            logger.error(f"Error in song processing: {e}")
            raise
            
    def _extract_tempo(self, audio_path: str) -> float:
        """Extract tempo from audio file"""
        try:
            y, sr = librosa.load(audio_path)
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            return float(tempo)
        except Exception as e:
            logger.error(f"Error extracting tempo: {e}")
            raise

    def cleanup(self) -> None:
        """Clean up temporary files"""
        try:
            for root, dirs, files in os.walk(self.temp_dir):
                for file in files:
                    os.remove(os.path.join(root, file))
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            raise