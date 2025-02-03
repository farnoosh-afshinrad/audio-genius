import * as Tone from "tone";

class AudioPlayer {
    constructor() {
        this.midi = null;
        this.players = {};
        this.volumes = {};
        this.transport = Tone.getTransport();
        this.running = false;
        this.initialized = false;
        this.updater = null;
    }

    async loadAudioFileFromURL(urls) {
        // Reset transport to ensure clean state
        this.transport.stop();
        this.transport.position = 0;

        for(const key of Object.keys(urls)) {
            let volume = new Tone.Volume().toDestination();
            let player = new Tone.Player({
                url: urls[key],
                loop: false,
                autostart: false,
            }).connect(volume);

            // Wait for player to load
            await new Promise((resolve) => {
                player.load(urls[key]).then(() => {
                    console.log(`Loaded audio track: ${key}`);
                });

                console.log(key, urls[key]);
                this.players[key] = player;
                this.volumes[key] = volume;
                resolve();
            });
        }
    }

    initialize() {
        if (this.initialized) return;

        // Schedule all audio players
        for(const key of Object.keys(this.players)) {
            const player = this.players[key];
            
            // Ensure player is stopped and reset
            player.stop();
            player.seek(0);
            
            // Schedule player start
            this.transport.schedule((time) => {
                player.start(time);
            }, 0);

            // Sync with transport
            player.sync();
        }

        this.initialized = true;
    }

    async play(callback = null) {
        if(!this.running) {
            try {
                // Ensure Tone.js is started
                await Tone.start();

                // Reset transport position if at end
                if (this.transport.seconds >= this.transport.duration) {
                    this.transport.position = 0;
                }

                // Setup callback for visual sync
                if(callback != null) {
                    this.updater = setInterval(() => {
                        const currentTime = this.transport.seconds;
                        callback(currentTime);
                    }, 16); // ~60fps for smoother animation
                }

                // Start transport
                this.transport.start();
                this.running = true;

                console.log("Playback started", {
                    position: this.transport.position,
                    players: Object.keys(this.players).map(key => ({
                        name: key,
                        state: this.players[key].state,
                        volume: this.volumes[key].volume.value
                    }))
                });

            } catch (error) {
                console.error("Error starting playback:", error);
            }
        }
    }

    seek(seconds) {
        const wasRunning = this.running;
        
        // Pause if playing
        if (wasRunning) {
            this.pause();
        }

        // Update transport position
        this.transport.seconds = seconds;

        // Resume if was playing
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
        console.log(name);
        if (this.players[name]) {
            this.players[name].mute = true;
        }
    }

    unmuteTrack(name) {
        console.log(this.volumes[name]);
        if (this.players[name]) {
            this.players[name].mute = false;
        }
    }

    changeVolume(name, value) {
        console.log("Setting value of " + name + " volume at " + String(value === 0 ? -Infinity : 20 * Math.log10(value)));
        if (this.volumes[name]) {
            // Convert linear value (0-1) to dB (-Infinity to 0)
            this.volumes[name].volume.value = (value === 0 ? -Infinity : 20 * Math.log10(value));
        }
    }

    loadMidi(midi) {
        this.midi = midi;

        // Create sampler for MIDI playback
        /*let volume = new Tone.Volume(0).toDestination();
        let sampler = new Tone.Sampler({
            urls: {
                "C4": "piano-f-c4.wav"
            },
            baseUrl: "/",
            onload: () => {
                console.log("MIDI sampler loaded");
                sampler.sync();
            }
        }).connect(volume);

        this.volumes["midi"] = volume;

        // Schedule MIDI notes
        this.midi.tracks.forEach((track) => {
            track.notes.forEach((note) => {
                this.transport.schedule((time) => {
                    sampler.triggerAttackRelease(
                        note.name,
                        note.duration,
                        time,
                        note.velocity
                    );
                }, note.time);
            });
        });*/
    }

    cleanup() {
        this.stop();
        this.transport.cancel(); // Clear all scheduled events
        this.initialized = false;
        
        // Dispose of all players and volumes
        Object.values(this.players).forEach(player => player.dispose());
        Object.values(this.volumes).forEach(volume => volume.dispose());
        
        this.players = {};
        this.volumes = {};
    }
}

export default AudioPlayer;