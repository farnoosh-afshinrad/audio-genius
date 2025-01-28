import librosa
import os
from typing import Dict, Tuple
import logging
from demucs.apply import apply_model
import torch
import numpy as np
from midi_extractor import MidiExtractor
from stem_separator import StemSeparator

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SongFeaturesRetriever:
    def __init__(self, temp_dir: str):
        logger.info("Initializing SongFeaturesRetriever")
        self.temp_dir = temp_dir
        self.midi_extractor = MidiExtractor()
        self.stem_separator = StemSeparator()
        
    def process_song(self, audio_path: str, artist: str = None, title: str = None) -> Dict:
        """
        Main processing pipeline with enhanced error handling and logging
        """
        logger.info(f"Starting song processing for {audio_path}")
        
        try:
            # Validate input file
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")

            # Create output directory
            output_dir = os.path.join(self.temp_dir, 'processed_audio')
            os.makedirs(output_dir, exist_ok=True)
            logger.info(f"Created output directory: {output_dir}")

            # Extract tempo with validation
            tempo = self._extract_tempo(audio_path)
            if not tempo or tempo <= 0:
                logger.warning(f"Invalid tempo detected ({tempo}), using default of 120 BPM")
                tempo = 120.0
            else:
                logger.info(f"Detected tempo: {tempo} BPM")
            
            # Process stems
            logger.info("Separating audio stems...")
            stem_paths = self.stem_separator.separate_stems(audio_path, output_dir)
            logger.info("Stems separated successfully")
            
            # Process vocals
            logger.info("Processing vocals...")
            vocals_path = stem_paths.get('vocals')
            if not vocals_path or not os.path.exists(vocals_path):
                raise ValueError("Vocals stem not found or invalid")
                
            enhanced_vocals = self.stem_separator.enhance_vocals(vocals_path, output_dir)
            logger.info("Vocals enhanced successfully")
            
            # Generate MIDI with full parameter set
            logger.info("Generating MIDI from vocals...")
            midi, melody = self.midi_extractor.waveToMidi(
                audioPath=enhanced_vocals,
                bpm=int(round(tempo)),  # Convert tempo to integer
                Fs=22050,
                frameLength=2048,
                hopLength=512,
                pStayNote=0.9,
                pStaySilence=0.7,
                pitchAcc=0.9,
                voicedAcc=0.9,
                onsetAcc=0.9,
                spread=0.2
            )
            logger.info("MIDI generation completed")
            
            # Save MIDI
            midi_path = os.path.join(output_dir, "transcribed.mid")
            with open(midi_path, "wb") as outfile:
                midi.writeFile(outfile)
            logger.info(f"MIDI file saved to: {midi_path}")

            result = {
                'tempo': tempo,
                'midi_path': midi_path,
                'melody': melody,
                'stems': stem_paths,
                'metadata': {
                    'artist': artist,
                    'title': title
                }
            }
            logger.info("Song processing completed successfully")
            return result
            
        except Exception as e:
            error_msg = f"Error in song processing: {str(e)}\n{traceback.format_exc()}"
            logger.error(error_msg)
            raise Exception(error_msg)
            
    def _extract_tempo(self, audio_path: str) -> float:
        """Extract tempo from audio file with improved error handling"""
        logger.info("Extracting tempo from audio file...")
        try:
            y, sr = librosa.load(audio_path)
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            logger.info(f"Successfully extracted tempo: {tempo} BPM")
            return float(tempo)
        except Exception as e:
            error_msg = f"Error extracting tempo: {str(e)}\n{traceback.format_exc()}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def cleanup(self) -> None:
        """Clean up temporary files with improved error handling"""
        logger.info(f"Starting cleanup of directory: {self.temp_dir}")
        try:
            file_count = 0
            for root, dirs, files in os.walk(self.temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        os.remove(file_path)
                        file_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to remove file {file_path}: {str(e)}")
            logger.info(f"Cleanup completed. Removed {file_count} files.")
        except Exception as e:
            error_msg = f"Error during cleanup: {str(e)}\n{traceback.format_exc()}"
            logger.error(error_msg)
            raise Exception(error_msg)