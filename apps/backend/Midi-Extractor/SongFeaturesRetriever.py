import numpy as np
import librosa
import os
import midiutil, json
from StemSeparator import StemSeparator
from MidiExtractor import MidiExtractor

class SongFeaturesRetriever():
    def __init__(self):
        self.folder = None
        self.audioSource = None

    def __getStaticTempo(self) -> int:
        audio, Fs = librosa.load(self.audioSource)
        
        onsetEnvelope = librosa.onset.onset_strength(y=audio, sr=Fs)
        return int(librosa.beat.tempo(onset_envelope=onsetEnvelope, sr=Fs)[0]) # with aggregate=None can be be dynamic

    def __getStems(self, splitInstrumental: bool) -> None:
        separator = StemSeparator(self.folder, self.audioSource)
        
        # Basic instrumental/vocals separation
        basicStems = separator.basicStems()
        outputInstr = { 'Instrumental': basicStems['Instrumental'] }

        # Split instrumental
        if splitInstrumental:
            fourPartStems = separator.fourPartStems()

            # Remove unused tracks
            os.remove(
                os.path.join(self.folder, basicStems['Instrumental'])
            )

            outputInstr = { 'Drums': fourPartStems['Drums'],
                           'Bass': fourPartStems['Bass'],
                           'Other': fourPartStems['Other'] }

        vocalStems = separator.enhanceVocalSplit(basicStems['Vocals'])
        outputVocals = { 'LeadVocals': vocalStems['Lead'], 'BackingVocals': vocalStems['Backing'] }

        # Remove unused generated tracks
        os.remove(
            os.path.join(self.folder, basicStems['Vocals'])
        )

        return { **outputInstr, **outputVocals }
    
    def __getMidi(self, vocalStemName: str) -> dict:
        # New midi extractor instance
        extractor = MidiExtractor()

        # Perform extraction from lead vocals stem
        leadVocalsPath = os.path.join(self.folder, vocalStemName)

        estimatedBpm = self.__getStaticTempo()
        midi, melody = extractor.waveToMidi(leadVocalsPath, estimatedBpm)

        # Save output files
        transcriptionFile = 'transcription.mid'
        fundamentalFile = 'fundamental.json'
        transcriptionPath = os.path.join(self.folder, transcriptionFile)
        fundamentalPath = os.path.join(self.folder, fundamentalFile)
        with open(transcriptionPath, "wb") as outFile:
            midi.writeFile(outFile)
        with open(fundamentalPath, "w") as outFile:
            json.dump(melody, outFile)
        
        return { 'MidiTranscription': transcriptionFile, 'FundamentalFreqs': fundamentalFile }

    def getVocalTranscription(self, audioPath: str, splitInstrumental: bool = False) -> dict:
        _, extension = os.path.splitext(audioPath)

        if not os.path.isfile(audioPath):
            raise Exception('Invalid audio file')
        elif not extension in ['.mp3', '.wav', '.m4a']:
            raise Exception('File format has unsupported extension')
        else:
            self.folder = os.path.dirname(audioPath)
            self.audioSource = audioPath

            # Separate tracks
            stems = self.__getStems(splitInstrumental)

            # Extract midi from lead vocals
            transcription = self.__getMidi(stems['LeadVocals'])

            # Return
            return { **stems, **transcription }