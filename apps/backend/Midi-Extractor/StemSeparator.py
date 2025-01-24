import os
from audio_separator.separator import Separator

class StemSeparator:
    def __init__(self, outputFolder: str, audioSource: str, outFormat: str = 'mp3'):
        self.outputFolder = outputFolder
        self.audioSource = audioSource
        self.outFormat = outFormat
        self.separator = Separator(output_dir=self.outputFolder, output_format=self.outFormat)

    def basicStems(self) -> dict:
        outputNames = {
            "Vocals": "vocals",
            "Instrumental": "instrumental",
        }

        self.separator.load_model(model_filename='MDX23C-8KFFT-InstVoc_HQ_2.ckpt')
        self.separator.separate(self.audioSource, outputNames)

        return { 'Vocals': f'{outputNames["Vocals"]}.{self.outFormat}', 
                'Instrumental': f'{outputNames["Instrumental"]}.{self.outFormat}' }

    def fourPartStems(self) -> dict:
        outputNames = {
            "Vocals": "lq_vocals",
            "Drums": "drums",
            "Bass": "bass",
            "Other": "other",
        }

        self.separator.load_model(model_filename='htdemucs_ft.yaml')
        self.separator.separate(self.audioSource, outputNames)

        return { 'Vocals': f'{outputNames["Vocals"]}.{self.outFormat}', 
                'Drums': f'{outputNames["Drums"]}.{self.outFormat}',
                'Bass': f'{outputNames["Bass"]}.{self.outFormat}',
                'Other': f'{outputNames["Other"]}.{self.outFormat}' }

    def enhanceVocalSplit(self, vocalStemName: str) -> dict:
        outputNames = {
            "Vocals": "lead_vocals",
            "Instrumental": "backing_vocals",
        }

        self.separator.load_model(model_filename='6_HP-Karaoke-UVR.pth')
        self.separator.separate(os.path.join(self.outputFolder, vocalStemName), outputNames)

        return { 'Lead': f'{outputNames["Vocals"]}.{self.outFormat}', 
                'Backing': f'{outputNames["Instrumental"]}.{self.outFormat}' }