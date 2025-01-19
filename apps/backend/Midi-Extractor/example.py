import os
from SongFeaturesRetriever import SongFeaturesRetriever

if __name__ == "__main__":
    features = SongFeaturesRetriever()

    path = os.path.join( os.path.dirname(os.path.abspath(__file__)), 'tmp', 'ABBA.m4a')
    features.getVocalTranscription(path, splitInstrumental=True)