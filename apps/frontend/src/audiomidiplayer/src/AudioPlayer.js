import * as Tone from "tone";

class AudioPlayer {
    constructor() {
        this.midi = null;

        this.players = {};
        this.volumes = {};

        this.running = false;
        this.initialized = false;
        this.updater = null;
    }

    async loadAudioFileFromURL(urls) {
        for(const key of Object.keys(urls)) {

            let volume = new Tone.Volume().toDestination()
            let player = new Tone.Player().connect(volume);

            await player.load(urls[key]);

            this.players[key] = player;
            this.volumes[key] = volume;
        };
    }

    initialize() {
        for(const key of Object.keys(this.players)) {
            Tone.getTransport().schedule((time) => {
                this.players[key].start(time);
            }, 0);

            this.players[key].sync();
        };

        Tone.start();

        this.initialized = true;
    }

    play(callback = null) {
        if(!this.running) {
            if(callback != null) {
                this.updater = setInterval(() => {
                    callback(Tone.getTransport().seconds)
                }, 100);
            }
    
            Tone.getTransport().start();
            this.running = true;
        }
    }

    seek(seconds) {
        Tone.getTransport().seconds = seconds;
    }

    pause() {
        if(this.running) {
            Tone.getTransport().pause();
            clearInterval(this.updater);
            this.running = false;
        }
    }

    stop() {
        Tone.getTransport().stop();
        clearInterval(this.updater);
        this.running = false;
    }
    
    muteTrack(name) {
        this.players[name].mute = true;
    }

    unmuteTrack(name) {
        this.players[name].mute = false;
    }

    changeVolume(name, value) {
        this.volumes[name].volume.value = 20*Math.log10(value);
    }

    loadMidi(midi) {
        this.midi = midi;

        this.midi.tracks.forEach((track) => {
            let volume = new Tone.Volume().toDestination();
            let sampler = new Tone.Sampler({
                "C4":"piano-f-c4.wav"
            }).connect(volume);

            this.volumes["midi"] = volume;

            track.notes.forEach((note) => { // For every note
                const startTime = Tone.Time(note.time).toSeconds(); // Get startTime in seconds
                const duration = Tone.Time(note.duration).toSeconds(); // Get duration in seconds

                Tone.getTransport().schedule((time) => {
                    sampler.triggerAttackRelease(
                        note.name,
                        duration,
                        startTime,
                        1
                    );
                }, startTime);
            });
            sampler.sync();
        });
    }
}

export default AudioPlayer;