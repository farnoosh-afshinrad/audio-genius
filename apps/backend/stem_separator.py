import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
import librosa
import numpy as np
import soundfile as sf
import os
import logging
import concurrent.futures
from functools import lru_cache
from typing import Dict, Optional
from torch.cuda.amp import autocast
from audio_separator.separator import Separator

logger = logging.getLogger(__name__)

class StemSeparator:
    def __init__(self, device='cuda' if torch.cuda.is_available() else 'cpu'):
        """
        Initialize StemSeparator with optimized settings
        Args:
            device: 'cuda' or 'cpu' - automatically selects GPU if available
        """
        self.device = device
        self.model = None
        self.model_name = 'htdemucs'
        self._audio_cache = {}  # Cache for loaded audio files
        logger.info(f"Initializing StemSeparator with device: {device}")
        self._load_model()  # Load model on initialization
        self.separator = None
        
    @lru_cache(maxsize=1)  # Cache the model to avoid reloading
    def _load_model(self) -> None:
        """
        Load the Demucs model with caching to avoid repeated loading
        """
        try:
            logger.info("Loading Demucs model...")
            self.model = get_model(name=self.model_name)
            if self.model is None:
                raise ValueError("Failed to load model")
                
            # Optimize model for inference
            self.model.to(self.device)
            self.model.eval()
            
            # Apply additional optimizations for GPU
            if self.device == 'cuda':
                # Use mixed precision for faster GPU processing
                self.model = self.model.half()
                torch.backends.cudnn.benchmark = True
                
            logger.info("Model loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
            
    def _load_audio(self, audio_path: str) -> tuple:
        """
        Load audio with caching to avoid reloading the same file
        """
        if audio_path not in self._audio_cache:
            y_sr = librosa.load(audio_path, sr=44100, mono=False)
            self._audio_cache[audio_path] = y_sr
        return self._audio_cache[audio_path]
        
    def _save_stem(self, stem_data: np.ndarray, stem_name: str, 
                   output_dir: str, sr: int) -> tuple:
        """
        Save individual stem to file
        """
        stem_path = os.path.join(output_dir, f"{stem_name}.wav")
        if stem_data.ndim == 1:
            stem_data = np.expand_dims(stem_data, axis=0)
        sf.write(stem_path, stem_data.T, sr, subtype='PCM_16')
        return stem_name, stem_path

    def separate_stems_alt(self, audio_path: str, output_dir: str) -> Dict[str, str]:
        """
        Separate audio into stems using parallel processing
        Args:
            audio_path: Path to input audio file
            output_dir: Directory to save separated stems
        Returns:
            Dictionary mapping stem names to their file paths
        """
        if self.model is None:
            self._load_model()
            
        try:
            # Load audio with caching
            audio, sr = self._load_audio(audio_path)
            
            # Prepare audio for model
            if audio.ndim == 1:
                audio = np.stack([audio, audio])
                
            # Convert to tensor and move to device
            audio_tensor = torch.tensor(audio, device=self.device)
            if self.device == 'cuda':
                audio_tensor = audio_tensor.half()  # Use half precision for GPU
            audio_tensor = audio_tensor.float().unsqueeze(0)
            
            # Process through model with optimizations
            with torch.no_grad(), autocast(enabled=self.device=='cuda'):
                stems = apply_model(self.model, audio_tensor)
                
            # Move results back to CPU and convert to numpy
            stems = stems.squeeze().cpu().numpy()
            
            # Create output directory
            os.makedirs(output_dir, exist_ok=True)
            
            # Process stems in parallel
            stem_names = ['vocals', 'drums', 'bass', 'other']
            stem_paths = {}
            
            # Use ThreadPoolExecutor for parallel processing
            with concurrent.futures.ThreadPoolExecutor() as executor:
                # Create futures for each stem
                future_to_stem = {
                    executor.submit(
                        self._save_stem, 
                        stems[i], 
                        stem_name, 
                        output_dir, 
                        sr
                    ): stem_name
                    for i, stem_name in enumerate(stem_names)
                }
                
                # Collect results as they complete
                for future in concurrent.futures.as_completed(future_to_stem):
                    stem_name, stem_path = future.result()
                    stem_paths[stem_name] = stem_path
                    
            # Clear audio cache to free memory
            self._audio_cache.clear()
            
            return stem_paths
        
        except Exception as e:
            logger.error(f"Error in stem separation: {str(e)}")
            logger.exception("Full traceback:")
            raise
            
    def enhance_vocals_alt(self, vocals_path: str, output_path: str) -> str:
        """
        Enhance vocals with optional processing
        """
        try:
            # Load vocals
            vocals, sr = self._load_audio(vocals_path)
            
            # For now, just return the original vocals
            # You can add vocal enhancement processing here
            
            return vocals_path
            
        except Exception as e:
            logger.error(f"Error in vocal enhancement: {e}")
            raise
    
    @lru_cache(maxsize=1)
    def separate_stems(self, audio_path: str, output_dir: str) -> Dict[str, str]:
        outputNames = {
            "Vocals": "vocals",
            "Drums": "drums",
            "Bass": "bass",
            "Other": "other",
        }
        
        self.separator = Separator(output_dir=output_dir, output_format='mp3')

        self.separator.load_model(model_filename='htdemucs_ft.yaml')
        self.separator.separate(audio_path, outputNames)

        return { 'vocals': os.path.join(output_dir, f'{outputNames["Vocals"]}.mp3'), 
                'drums': os.path.join(output_dir, f'{outputNames["Drums"]}.mp3'),
                'bass': os.path.join(output_dir, f'{outputNames["Bass"]}.mp3'),
                'other': os.path.join(output_dir, f'{outputNames["Other"]}.mp3'),                
                }

    def enhance_vocals(self, vocals_path: str, output_dir: str) -> str:
        outputNames = {
            "Vocals": "lead_vocals",
            "Instrumental": "backing_vocals",
        }

        self.separator.load_model(model_filename='6_HP-Karaoke-UVR.pth')
        self.separator.separate(vocals_path, outputNames)

        return { 
            'lead_vocals': os.path.join(output_dir, f'{outputNames["Vocals"]}.mp3'),
            'backing_vocals': os.path.join(output_dir, f'{outputNames["Instrumental"]}.mp3')
        }
            
    def cleanup(self) -> None:
        """
        Cleanup resources and cached data
        """
        try:
            # Clear audio cache
            self._audio_cache.clear()
            
            # Clear CUDA cache if using GPU
            if self.device == 'cuda':
                torch.cuda.empty_cache()
                
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            raise