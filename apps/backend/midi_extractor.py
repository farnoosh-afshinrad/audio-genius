import numpy as np
import torchcrepe
import librosa
import matplotlib.pyplot as plt
from tqdm import tqdm
import midiutil
import math
import json

class MidiExtractor:

    def __init__(self):
        self.noteMap = {
            36: 'C2', 37: 'C#2', 38: 'D2', 39: 'D#2', 40: 'E2',
            41: 'F2', 42: 'F#2', 43: 'G2', 44: 'G#2', 45: 'A2',
            46: 'A#2', 47: 'B2', 48: 'C3', 49: 'C#3', 50: 'D3',
            51: 'D#3', 52: 'E3', 53: 'F3', 54: 'F#3', 55: 'G3',
            56: 'G#3', 57: 'A3', 58: 'A#3', 59: 'B3', 60: 'C4',
            61: 'C#4', 62: 'D4', 63: 'D#4', 64: 'E4', 65: 'F4',
            66: 'F#4', 67: 'G4', 68: 'G#4', 69: 'A4', 70: 'A#4',
            71: 'B4', 72: 'C5', 73: 'C#5', 74: 'D5', 75: 'D#5',
            76: 'E5', 77: 'F5', 78: 'F#5', 79: 'G5', 80: 'G#5',
            81: 'A5', 82: 'A#5', 83: 'B5', 84: 'C6'
        }
        
        self.noteMapHz = {}
        self.originalPitch = None

        keys = list(self.noteMap.keys())
        
        for k in keys:
            self.noteMapHz[k] = librosa.note_to_hz(self.noteMap[k])

        self.noteMapValues = list(self.noteMap.values())

        self.midiMin = keys[0]
        self.midiMax = keys[-1]

    @staticmethod
    def __rangeConversion(oldValue: float, oldRangeTuple: tuple[float, float], newRangeTuple: tuple[float, float]) -> float:
        oldRange = (oldRangeTuple[1] - oldRangeTuple[0])
        newRange = (newRangeTuple[1] - newRangeTuple[0])
        return (((oldValue - oldRangeTuple[0]) * newRange) / oldRange) + newRangeTuple[0]
        
    def __transitionMatrix(self, pStayNote: float, pStaySilence: float) -> np.array:
        nNotes = self.midiMax - self.midiMin + 1
        pL = (1 - pStaySilence) / nNotes
        pLL = (1 - pStayNote) / (nNotes + 1)

        # Initialize the transition matrix
        transMat = np.zeros((2 * nNotes + 1, 2 * nNotes + 1))
        
        # State 0 = silence
        transMat[0, 0] = pStaySilence
        for i in range(nNotes):
            transMat[0, (i * 2) + 1] = pL

        # Odd states = onsets
        for i in range(nNotes):
            transMat[(i * 2) + 1, (i * 2) + 2] = 1

        # Even states = sustains
        for i in range(nNotes):
            transMat[(i * 2) + 2, 0] = pLL
            transMat[(i * 2) + 2, (i * 2) + 2] = pStayNote
            for j in range(nNotes):
                transMat[(i * 2) + 2, (j * 2) + 1] = pLL

        return transMat

    def __detectVocalOnsets(self, frequencies: np.array, t: int = 1) -> np.array:
        threshold = librosa.note_to_hz(self.noteMapValues[-1])
        
        maximum = 0
        modF0 = np.nan_to_num(frequencies, copy=True)
        for i in range(len(frequencies)):
            if modF0[i] > maximum:
                maximum = modF0[i]
            modF0[i] = (modF0[i] * threshold) / maximum

        # Differentiate
        slopes = np.diff(modF0)

        # Calculate summation of slopes (detecting sign changes)
        s = 0
        sameSlopeDir = np.zeros(len(slopes))
        followingSlopes = np.zeros(len(slopes))
        for i in range(len(slopes)):
            s = slopes[i]
            j = i + 1

            while (j < len(slopes)) and ((slopes[i] > 0 and slopes[j] > 0) or (slopes[i] < 0 and slopes[j] < 0)):
                s = s + slopes[j]
                j += 1

            followingSlopes[i] = s
            sameSlopeDir[i] = int(j - 1)

        # Calculate mean of local slopes
        n = 20
        means = np.zeros(len(slopes))
        
        for i in range(0, n):
            means[i] = slopes[i]

        for i in range(n, len(slopes)):
            s = 0
            for x in range(i-n, i+1):
                s += slopes[x]
            means[i] = s / n

        # Calculate standard deviation of local slopes
        STD = np.zeros(len(slopes))

        for i in range(n, len(slopes)):
            s = 0
            for x in range(i-n, i+1):
                s += (slopes[x] - means[i])**2
            STD[i] = math.sqrt(s/(n-1))
            
        # Apply some considerations to detect offsets
        firstTime = True
        onsets = []
        i = 0
        while i < len(slopes):
            i = int(i)
            threshold = means[i] + STD[i]*t
            if slopes[i] > threshold:
                j = sameSlopeDir[i]
                onsets.append(i+j)
                i = i+j+1
            else:
                i += 1
        
        return onsets
                    
    def __priorProbabilities(self,
                           audio: np.array,
                           frameLength: int,
                           hopLength: int,
                           pitchAcc: float = 0.9,
                           voicedAcc: float = 0.9,
                           onsetAcc: float = 0.9,
                           spread: float = 0.2) -> np.array:
        # Some constants
        fMin = librosa.note_to_hz(self.noteMapValues[0])
        fMax = librosa.note_to_hz(self.noteMapValues[-1])
        nNotes = self.midiMax - self.midiMin + 1
        
        pitch, voiced, _ = librosa.pyin(y=audio,
                                     fmin=fMin*0.9,
                                     fmax=fMax*1.1,
                                     frame_length=frameLength,
                                     win_length=int(frameLength / 2),
                                     hop_length=hopLength
                                    )
        tuning = librosa.pitch_tuning(pitch)
        f0_ = np.round(librosa.hz_to_midi(pitch - tuning)).astype(int)

        # Calculate onsets positions
        onsets = self.__detectVocalOnsets(pitch)
        self.originalPitch = pitch
        
        # Init priors matrix
        priors = np.ones((nNotes * 2 + 1, len(pitch)))

        for nFrame in range(len(pitch)):
            if (nFrame < len(voiced) and not voiced[nFrame]) or nFrame > len(voiced):
                priors[0, nFrame] = voicedAcc
            else:
                priors[0, nFrame] = 1 - voicedAcc

            for j in range(nNotes):
                if nFrame in onsets:
                    priors[(j * 2) + 1, nFrame] = onsetAcc
                else:
                    priors[(j * 2) + 1, nFrame] = 1 - onsetAcc

                if j + self.midiMin == f0_[nFrame]:
                    priors[(j * 2) + 2, nFrame] = pitchAcc
                elif np.abs(j + self.midiMin - f0_[nFrame]) == 1:
                    priors[(j * 2) + 2, nFrame] = pitchAcc * spread
                else:
                    priors[(j * 2) + 2, nFrame] = 1 - pitchAcc
        
        return priors
        
    def __statesToPianoroll(self, audio: np.array, states: list, frameLength: float, hopLength:float, hopTime: float) -> (list, list):
        states_ = np.hstack((states, np.zeros(1)))

        # Possible states
        silence = 0
        onset = 1
        sustain = 2
        
        currentState = silence
        output = []
        melodyWave = []

        lastOnset = 0
        lastOffset = 0
        lastMidi = 0

        # Get RMS energy of the signal
        rms = librosa.feature.rms(y=audio, frame_length=frameLength, hop_length=hopLength)
        minRMS = min(rms[0])
        maxRMS = max(rms[0])

        currentRMSSum = 0
        currentRMSNr = 0

        for i, _ in tqdm(enumerate(states_)):
            if currentState == silence:
                # Onset found
                if int(states_[i] % 2) != 0:
                    lastOnset = i * hopTime
                    lastMidi = ((states_[i] - 1) / 2) + self.midiMin
                    lastNote = librosa.midi_to_note(lastMidi)
                    currentState = onset

                    melodyWave.append(self.noteMapHz[int(lastMidi)] if int(lastMidi) in self.noteMapHz else 0)

                    currentRMSSum += rms[0][i]
                    currentRMSNr += 1
                else:
                    melodyWave.append(0)
            elif currentState == onset:
                if int(states_[i] % 2) == 0:
                    currentState = sustain

                    melodyWave.append(self.noteMapHz[int(lastMidi)] if int(lastMidi) in self.noteMapHz else 0)

                    currentRMSSum += rms[0][i]
                    currentRMSNr += 1
            elif currentState == sustain:
                # Onset found
                if int(states_[i] % 2) != 0:
                    # Finish last note
                    lastOffset = i * hopTime
                    currentNote = [lastOnset, lastOffset, lastMidi, lastNote, 
                                   int(self.__rangeConversion(currentRMSSum/currentRMSNr, (minRMS, maxRMS), (0, 127)))
                                  ]
                    output.append(currentNote)
                    melodyWave.append(self.noteMapHz[int(lastMidi)] if int(lastMidi) in self.noteMapHz else 0)

                    # Start new note
                    lastOnset = i * hopTime
                    lastMidi = ((states_[i] - 1) / 2) + self.midiMin
                    lastNote = librosa.midi_to_note(lastMidi)
                    currentState = onset

                    currentRMSSum = rms[0][i]
                    currentRMSNr = 1
                elif states_[i] == 0:
                    # Silence, end last note
                    lastOffset = i * hopTime
                    currentNote = [lastOnset, lastOffset, lastMidi, lastNote,
                                   int(self.__rangeConversion(currentRMSSum/currentRMSNr, (minRMS, maxRMS), (0, 127)))
                                  ]
                    output.append(currentNote)
                    melodyWave.append(0)
                    currentState = silence

                    currentRMSSum = 0
                    currentRMSNr = 0
                else:
                    melodyWave.append(self.noteMapHz[int(lastMidi)] if int(lastMidi) in self.noteMapHz else 0)
        
        melodyWave = np.nan_to_num(melodyWave).tolist()
                    
        return output, melodyWave

    def __pianorollToMidi(self, bpm: float, pianoroll: list) -> midiutil.MidiFile:
        quarterNote = 60 / bpm

        onsets = np.array([p[0] for p in pianoroll])
        offsets = np.array([p[1] for p in pianoroll])
        velocities = np.array([p[4] for p in pianoroll])

        onsets = onsets / quarterNote
        offsets = offsets / quarterNote
        durations = offsets - onsets

        midi = midiutil.MIDIFile(1)
        midi.addTempo(0, 0, bpm)

        for i,_ in enumerate(onsets):
            midi.addNote(0, 0, int(pianoroll[i][2]), onsets[i], durations[i], velocities[i])

        return midi

    def waveToMidi(self,
                    audioPath: str,
                   bpm: int,  # Made BPM a required parameter
                   Fs: int = 22050,
                   frameLength: int = 2048,
                   hopLength: int = 512,
                   pStayNote: float = 0.9,
                   pStaySilence: float = 0.7,
                   pitchAcc: float = 0.9,
                   voicedAcc: float = 0.9,
                   onsetAcc: float = 0.9,
                   spread: float = 0.2
                  ) -> (midiutil.MIDIFile(), list):

        print('MIDI: Performing midi transcription...')
        progress = tqdm(range(7))

        audio = librosa.load(audioPath, sr=Fs)[0]
        progress.update(1)
        progress.refresh()
        
        transMat = self.__transitionMatrix(pStayNote, pStaySilence)
        progress.update(2)
        progress.refresh()

        priors = self.__priorProbabilities(
            audio,
            frameLength,
            hopLength,
            pitchAcc,
            voicedAcc,
            onsetAcc,
            spread
        )
        progress.update(3)
        progress.refresh()

        pInit = np.zeros(transMat.shape[0])
        pInit[0] = 1
        progress.update(4)
        progress.refresh()

        states = librosa.sequence.viterbi(priors, transMat, p_init=pInit)
        progress.update(5)
        progress.refresh()

        pianoroll, melodyArray = self.__statesToPianoroll(audio,
                                            states,
                                            frameLength,
                                            hopLength,
                                            hopLength / Fs
                                            )
        progress.update(6)
        progress.refresh()

        midi = self.__pianorollToMidi(bpm, pianoroll)  # Use the provided BPM
        progress.update(7)
        progress.refresh()

        return midi, melodyArray

def download_youtube_audio(search_query, output_path):
    """Helper function to download audio from YouTube"""
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': output_path,
        'quiet': True,
        'no_warnings': True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"ytsearch:{search_query}", download=True)
        if not info.get('entries'):
            raise Exception("No video found")
        return info['entries'][0]