import * as Tone from "tone";

class AudioPlayer {
    constructor() {
        this.midi = null;
        this.players = {};
        this.volumes = {};
        this.midiSampler = null;
        this.running = false;
        this.initialized = false;
        this.updater = null;
        // Get transport instance once
        this.transport = Tone.getTransport();
    }

    async loadAudioFileFromURL(urls) {
        for(const key of Object.keys(urls)) {
            let volume = new Tone.Volume().toDestination();
            let player = new Tone.Player().connect(volume);
            await player.load(urls[key]);
            this.players[key] = player;
            this.volumes[key] = volume;
        }
    }

    initialize() {
        if (this.initialized) return;
        
        // Initialize audio players
        for(const key of Object.keys(this.players)) {
            this.transport.schedule((time) => {
                this.players[key].start(time);
            }, 0);
            this.players[key].sync();
        }

        // Initialize MIDI if loaded
        if (this.midiSampler) {
            this.midiSampler.sync();
        }

        this.initialized = true;
    }

    async play(callback = null) {
        if(!this.running) {
            // Ensure Tone.js is started (this needs to be in response to a user gesture)
            await Tone.start();
            
            if(callback != null) {
                this.updater = setInterval(() => {
                    callback(this.transport.seconds);
                }, 100);
            }
    
            this.transport.start();
            this.running = true;
        }
    }

    seek(seconds) {
        const wasRunning = this.running;
        if (wasRunning) {
            this.pause();
        }
        
        this.transport.seconds = seconds;
        
        if (wasRunning) {
            this.play();
        }
    }

    pause() {
        if(this.running) {
            this.transport.pause();
            clearInterval(this.updater);
            this.running = false;
        }
    }

    stop() {
        this.transport.stop();
        clearInterval(this.updater);
        this.running = false;
    }
    
    muteTrack(name) {
        if (name === "midi" && this.midiSampler) {
            this.midiSampler.volume.value = -Infinity;
        } else if (this.players[name]) {
            this.players[name].mute = true;
        }
    }

    unmuteTrack(name) {
        if (name === "midi" && this.midiSampler) {
            this.midiSampler.volume.value = 0;
        } else if (this.players[name]) {
            this.players[name].mute = false;
        }
    }

    changeVolume(name, value) {
        if (name === "midi" && this.midiSampler) {
            this.volumes["midi"].volume.value = 20 * Math.log10(value);
        } else if (this.volumes[name]) {
            this.volumes[name].volume.value = 20 * Math.log10(value);
        }
    }

    async loadMidi(midi) {
        this.midi = midi;
        
        // Clear any existing Transport events
        this.transport.cancel();
        
        // Create a new sampler if it doesn't exist
        if (!this.midiSampler) {
            let volume = new Tone.Volume().toDestination();
            this.midiSampler = new Tone.Sampler({
                urls: {
                    "C4": "piano-f-c4.wav"
                },
                baseUrl: "/", // Adjust this path based on where your samples are
                onload: () => {
                    console.log("Sampler loaded");
                }
            }).connect(volume);
            this.volumes["midi"] = volume;
        }

        // Wait for sampler to load
        await new Promise(resolve => {
            if (this.midiSampler.loaded) {
                resolve();
            } else {
                this.midiSampler.onload = resolve;
            }
        });

        // Schedule MIDI notes
        this.midi.tracks.forEach((track) => {
            track.notes.forEach((note) => {
                this.transport.schedule((time) => {
                    this.midiSampler.triggerAttackRelease(
                        note.name,
                        note.duration,
                        time,
                        note.velocity
                    );
                }, note.time);
            });
        });

        // Sync the sampler with Transport
        this.midiSampler.sync();
    }

    // Cleanup method for switching songs
    cleanup() {
        this.stop();
        this.transport.cancel(); // Clear all scheduled events
        this.initialized = false;
        
        // Dispose existing players
        Object.values(this.players).forEach(player => player.dispose());
        Object.values(this.volumes).forEach(volume => volume.dispose());
        
        if (this.midiSampler) {
            this.midiSampler.dispose();
            this.midiSampler = null;
        }
        
        this.players = {};
        this.volumes = {};
    }
}

export default AudioPlayer;