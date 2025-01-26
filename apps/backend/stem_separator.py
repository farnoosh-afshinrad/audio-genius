import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
import librosa
import numpy as np
import soundfile as sf
import os
import logging

logger = logging.getLogger(__name__)

class StemSeparator:
    def __init__(self, device='cuda' if torch.cuda.is_available() else 'cpu'):
        self.device = device
        self.model = None
        self.model_name = 'htdemucs'
        logger.info(f"Initializing StemSeparator with device: {device}")
        self._load_model()  # Load model on initialization
        
    def _load_model(self):
        try:
            import torch
            from demucs.pretrained import get_model
            from demucs.apply import apply_model
            
            logger.info("Loading Demucs model...")
            self.model = get_model(name=self.model_name)
            if self.model is None:
                raise ValueError("Failed to load model")
            self.model.to(self.device)
            self.model.eval()
            logger.info("Model loaded successfully")
        except ImportError as e:
            logger.error(f"Missing required package: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise

    def separate_stems(self, audio_path: str, output_dir: str) -> dict:
        if self.model is None:
            self._load_model()
            
        try:
            y_sr = librosa.load(audio_path, sr=44100, mono=False)
            audio = y_sr[0]
            sr = y_sr[1]
            
            if audio.ndim == 1:
                audio = np.stack([audio, audio])
                
            audio_tensor = torch.tensor(audio, device=self.device).float().unsqueeze(0)
            with torch.no_grad():
                stems = apply_model(self.model, audio_tensor)
                
            stems = stems.squeeze().cpu().numpy()
            
            os.makedirs(output_dir, exist_ok=True)
            stem_paths = {}
            
            # Prepare stems for saving
            for stem_idx, stem_name in enumerate(['vocals', 'drums', 'bass', 'other']):
                stem_path = os.path.join(output_dir, f"{stem_name}.wav")
                stem_data = stems[stem_idx]  # Get the stem data
                if stem_data.ndim == 1:
                    stem_data = np.expand_dims(stem_data, axis=0)
                sf.write(stem_path, stem_data.T, sr, subtype='PCM_16')
                stem_paths[stem_name] = stem_path
                
            return stem_paths
        
        except Exception as e:
            logger.error(f"Error in stem separation: {str(e)}")
            logger.exception("Full traceback:")
            raise
            
    def enhance_vocals(self, vocals_path: str, output_path: str) -> str:
        """Further process vocals for lead/backing separation"""
        try:
            # Implement vocal enhancement logic here
            # For now, just return the original vocals
            return vocals_path
        except Exception as e:
            logger.error(f"Error in vocal enhancement: {e}")
            raise