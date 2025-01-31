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
        let midi = await Midi.fromUrl(this.midiUrl);

        this.AudioPlayer = new AudioPlayer();

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

        this.pianoroll.printMidiFile(midi, this.jsonUrl);

        this.AudioPlayer.loadAudioFileFromURL(this.audioUrls).then(() => {
            this.AudioPlayer.loadMidi(midi);
            
            //Enable controls
            if(!this.AudioPlayer.initialized) {
                this.AudioPlayer.initialize();
            }

            this.refs.current.querySelectorAll("button").forEach((el) => {
                el.disabled = false;
            }); 

            this.refs.current.querySelector(".play").addEventListener("click", () => {
                this.AudioPlayer.play((time) => {
                    this.pianoroll.timeScrollTo(time);
                });
            });

            this.refs.current.querySelector(".pause").addEventListener("click", () => {
                this.AudioPlayer.pause();
            });
    
            this.refs.current.querySelector(".stop").addEventListener("click", () => {
                this.AudioPlayer.stop();
            });

            this.refs.current.querySelectorAll("input[type='checkbox']").forEach((el) => {
                el.addEventListener("change", () => {
                    let name = el.name;
                    let state = el.checked;
                    
                    if(state) {
                        this.AudioPlayer.unmuteTrack(name);
                    } else {
                        this.AudioPlayer.muteTrack(name);
                    }
                });
            });
    
            this.refs.current.querySelectorAll("input[type='range']").forEach((el) => {
                el.addEventListener("input", () => {
                    let name = el.name;
                    let val = el.value;
    
                    this.AudioPlayer.changeVolume(name, val);
                })
            });
        });
    }

    render() {
        return (
            <div ref={this.refs}>
                <div style={{maxHeight: this.canvasSize.height + "px", maxWidth: this.canvasSize.width + "px", height: this.canvasSize.height + "px", width: this.canvasSize.width + "px"}} className="audiomidi-external-canvas">
                    <canvas className="pianoLayer1 audiomidi-canvas" style={{zIndex:"1"}}></canvas>
                    <canvas className="pianoLayer2 audiomidi-canvas" style={{zIndex:"2"}}></canvas>
                    <div className="audiomidi-piano-layer">
                        <canvas className="pianoLayer3 audiomidi-canvas" style={{zIndex:"3"}}></canvas>
                        <canvas className="pianoLayer4 audiomidi-canvas" style={{zIndex:"4"}}></canvas>
                    </div>
                </div>
                <div>
                    <button className="play" disabled={true}>Play</button>
                    <button className="pause" disabled={true}>Pause</button>
                    <button className="stop" disabled={true}>Stop</button>
                    {
                        Object.keys(this.audioUrls).map(function(index) {
                            return <div>
                                <input type="checkbox" name={index} defaultChecked/>
                                <input type="range" name={index} defaultValue="1" min="0" max="1" step="0.01"/>
                            </div>
                        })
                    }
                </div>
            </div>
        );
    }
}

export default AudioMidiViewer;