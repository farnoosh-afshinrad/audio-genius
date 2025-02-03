import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';
import AudioMidiViewer from './AudioMidiViewer';

const root = ReactDOM.createRoot(document.getElementById('root'));

const settings = {
    audio: {
            drums: "drums.mp3",
            bass: "bass.mp3",
            other: "other.mp3",
            lead: "lead_vocals.mp3",
            backing: "backing_vocals.mp3"
        },
    midi: "transcription.mid",
    json: "fundamental.json",
    height: "500",
    width: "1000"
}

root.render(
  <React.StrictMode>
    <AudioMidiViewer settings={settings}/>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
