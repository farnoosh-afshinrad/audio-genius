import React from "react";
import Pianoroll from './Pianoroll';
import AudioPlayer from './AudioPlayer';
import { Midi } from '@tonejs/midi';
import './AudioMidiViewer.css';

class AudioMidiViewer extends React.Component {
    constructor(props) {
        super(props);

        // Fetch properties
        this.audioUrls = props.settings.audio;
        this.midiUrl = props.settings.midi;
        this.jsonUrl = props.settings.json;
        this.canvasSize = {height: props.settings.height, width: props.settings.width}

        // Define state
        this.pianoroll = null;
        this.AudioPlayer = null;
        this.refs = React.createRef();
    }

    async componentDidMount() {
        try {
            // Initialize audio player first
            this.AudioPlayer = new AudioPlayer();
            await this.AudioPlayer.loadAudioFileFromURL(this.audioUrls);
            
            // Load MIDI file
            let midi = await Midi.fromUrl(this.midiUrl);
            await this.AudioPlayer.loadMidi(midi);
            
            // Initialize piano roll after MIDI is loaded
            this.pianoroll = new Pianoroll(
                this.refs.current.querySelector(".pianoLayer1"),
                this.refs.current.querySelector(".pianoLayer2"),
                this.refs.current.querySelector(".pianoLayer3"),
                this.refs.current.querySelector(".pianoLayer4"),
                (position, currentScroll, maxScroll) => {
                    if(!this.AudioPlayer.running) {
                        this.AudioPlayer.seek(position);
                    }

                    if(currentScroll >= maxScroll) {
                        this.AudioPlayer.pause();
                    }
                }
            );

            // Print MIDI file to piano roll
            await this.pianoroll.printMidiFile(midi, this.jsonUrl);
            
            // Initialize audio player
            this.AudioPlayer.initialize();

            // Enable controls
            const buttons = this.refs.current.querySelectorAll("button");
            buttons.forEach((el) => {
                el.disabled = false;
            });

            // Setup event listeners
            this.refs.current.querySelector(".play").addEventListener("click", async () => {
                await this.AudioPlayer.play((time) => {
                    this.pianoroll.timeScrollTo(time);
                });
            });

            this.refs.current.querySelector(".pause").addEventListener("click", () => {
                this.AudioPlayer.pause();
            });
    
            this.refs.current.querySelector(".stop").addEventListener("click", () => {
                this.AudioPlayer.stop();
                this.pianoroll.timeScrollTo(0);
            });

            // Setup audio controls
            this.refs.current.querySelectorAll("input[type='checkbox']").forEach((el) => {
                el.addEventListener("change", () => {
                    const name = el.name;
                    const state = el.checked;
                    
                    if(state) {
                        this.AudioPlayer.unmuteTrack(name);
                    } else {
                        this.AudioPlayer.muteTrack(name);
                    }
                });
            });
    
            this.refs.current.querySelectorAll("input[type='range']").forEach((el) => {
                el.addEventListener("input", () => {
                    const name = el.name;
                    const value = parseFloat(el.value);
                    this.AudioPlayer.changeVolume(name, value);
                });
            });

        } catch (error) {
            console.error("Error initializing AudioMidiViewer:", error);
        }
    }

    render() {
        return (
            <div ref={this.refs}>
                <div style={{
                    maxHeight: this.canvasSize.height + "px",
                    maxWidth: this.canvasSize.width + "px",
                    height: this.canvasSize.height + "px",
                    width: this.canvasSize.width + "px"
                }} className="audiomidi-external-canvas">
                    <canvas className="pianoLayer1 audiomidi-canvas" style={{zIndex:"1"}}></canvas>
                    <canvas className="pianoLayer2 audiomidi-canvas" style={{zIndex:"2"}}></canvas>
                    <div className="audiomidi-piano-layer">
                        <canvas className="pianoLayer3 audiomidi-canvas" style={{zIndex:"3"}}></canvas>
                        <canvas className="pianoLayer4 audiomidi-canvas" style={{zIndex:"4"}}></canvas>
                    </div>
                </div>
                <div className="controls">
                    <div className="button-container">
                        <button className="play" disabled>Play</button>
                        <button className="play" disabled>Pause</button>
                        <button className="play" disabled>Stop</button>
                    </div>
                    <div className="audio-controls">
                        {Object.keys(this.audioUrls).map((index) => (
                            <div key={index} className="track-control">
                                <label>
                                    <input type="checkbox" name={index} defaultChecked/>
                                    {index}
                                </label>
                                <input
                                    type="range"
                                    name={index}
                                    defaultValue="1"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
}

export default AudioMidiViewer;