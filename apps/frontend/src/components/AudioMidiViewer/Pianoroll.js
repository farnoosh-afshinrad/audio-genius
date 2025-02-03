import * as Tone from "tone";

class Pianoroll {
    constructor(templateLayer, overlapLayer, whiteKeysLayer, blackKeysLayer, scrollCallback=null) {
        
        // Declare the layer contexts
        this.tpl = templateLayer.getContext("2d");
        this.ctx = overlapLayer.getContext("2d");
        this.wks = whiteKeysLayer.getContext("2d");
        this.bks = blackKeysLayer.getContext("2d");
        
        this.templateLayer = templateLayer;
        this.blackKeysLayer = blackKeysLayer;
        
        // Basic measures
        this.noteHeight = 20;
        this.baseWidth = 100;
        this.zoomFactor = 40;
        this.maxScroll = 0;

        // Add particle system for sparks
        this.particles = [];
        this.lastTime = 0;
              
        // Piano key gradients
        this.whiteKeyGradient = this.wks.createLinearGradient(0, 0, this.baseWidth, 0);
        this.whiteKeyGradient.addColorStop(0, '#ffffff');
        this.whiteKeyGradient.addColorStop(0.95, '#f0f0f0');
        this.whiteKeyGradient.addColorStop(1, '#e0e0e0');
              
        this.blackKeyGradient = this.bks.createLinearGradient(0, 0, this.baseWidth * 2/3, 0);
        this.blackKeyGradient.addColorStop(0, '#000000');
        this.blackKeyGradient.addColorStop(0.9, '#202020');
        this.blackKeyGradient.addColorStop(1, '#404040');
        
        // Declare midi-notes
        this.notes = {
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

        this.midiKeys = Object.keys(this.notes);

        // Set initial height and width
        this.canvasHeight = this.midiKeys.length*this.noteHeight;
        this.canvasWidth = this.baseWidth;
        
        this.resize(this.canvasHeight, this.baseWidth);

        // Animation frame
        requestAnimationFrame(this.animate.bind(this));

        // Set midi source
        this.midi = null;

        // Set last melody contour position
        this.lastStrokePosition = {x:0, y:0};
        
        // == Event handlers == //
        let self = this; //Closure
        templateLayer.parentElement.addEventListener("scroll", function() {
            // Update audio player
            if(scrollCallback != null) {
                scrollCallback( (this.scrollLeft - self.baseWidth) / self.zoomFactor, this.scrollLeft, self.maxScroll);
            }

            // Fixed position on the left for the keyboard
            blackKeysLayer.parentElement.style.width = self.canvasWidth - this.scrollLeft;
            
            whiteKeysLayer.style.left = `${this.scrollLeft}px`;
            blackKeysLayer.style.left = `${this.scrollLeft}px`;
        });
    }
    // Particle system
    createParticle(x, y, velocity) {
        return {
            x,
            y,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 3 - 2,
            alpha: 1,
            color: `hsla(${200 + Math.random() * 30}, 100%, ${50 + Math.random() * 20}%, `,
            life: 1
        };
    }
    animate(time) {
        const deltaTime = (time - this.lastTime) / 1000;
        this.lastTime = time;

        // Update and draw particles
        this.ctx.save();
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // gravity
            particle.life -= deltaTime * 2;
            particle.alpha = Math.max(0, particle.life);

            if (particle.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.fillStyle = particle.color + particle.alpha + ")";
            this.ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();

        requestAnimationFrame(this.animate.bind(this));
    }

    async fetchFiles(path) {
        //Use axios instead
        const response = await fetch(path,
            {
                headers : { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
        this.json = await response.json();
    }

    resize(h=null, w=null) {
        if(h != null) {
            this.ctx.canvas.height = h;
            this.tpl.canvas.height = h;
            this.wks.canvas.height = h;
            this.bks.canvas.height = h;
            this.blackKeysLayer.parentElement.style.minHeight = `${h}px`;
        }

        if(w != null) {
            this.ctx.canvas.width = w;
            this.tpl.canvas.width = w;
            this.wks.canvas.width = w;
            this.bks.canvas.width = w;
            this.blackKeysLayer.parentElement.style.minWidth = `${w}px`;
        }
    }

    printTemplate() {
        let height = 0;

        this.tpl.lineWidth = 0.1;
        for(var i = 1; i <= this.midiKeys.length; i++) {
            this.tpl.beginPath();

            height = this.noteHeight*i;
            this.tpl.moveTo(0, height);
            this.tpl.lineTo(this.canvasWidth, height);
            this.tpl.stroke();
        }

        let whiteKeyHeight = this.noteHeight * 3/2;
        let currentSpanY = whiteKeyHeight;

        this.midiKeys.forEach(key => {
            if(this.notes[key][0] == 'C' && this.notes[key][1] != '#') {
                this.printWhiteKey(whiteKeyHeight, this.canvasHeight - currentSpanY, this.notes[key]);
                currentSpanY += 0;
            } else if( (this.notes[key][0] == 'E' && this.notes[key][1] != 'b')) {
                this.printWhiteKey(whiteKeyHeight, this.canvasHeight - currentSpanY - this.noteHeight, this.notes[key]);
                currentSpanY += whiteKeyHeight;
            } else if(this.notes[key][0] == 'F' && this.notes[key][1] != '#') {
                this.printWhiteKey(whiteKeyHeight, this.canvasHeight - currentSpanY - this.noteHeight, this.notes[key]);
                currentSpanY += this.noteHeight;
            } else if(this.notes[key][0] == 'B') {
                this.printWhiteKey(whiteKeyHeight, this.canvasHeight - currentSpanY - this.noteHeight/2, this.notes[key]);
                currentSpanY += whiteKeyHeight + this.noteHeight/2;
            } else if(this.notes[key][0] == 'D' && this.notes[key][1] == '#') {
                this.printBlackKey(this.noteHeight, this.canvasHeight - currentSpanY - this.noteHeight/2);
                currentSpanY += this.noteHeight/2;
            } else if(this.notes[key][1] == '#' || this.notes[key][1] == 'b') {
                this.printBlackKey(this.noteHeight, this.canvasHeight - currentSpanY - this.noteHeight/2);
                currentSpanY += this.noteHeight;
            } else {
                this.printWhiteKey(whiteKeyHeight + this.noteHeight / 2, this.canvasHeight - currentSpanY - this.noteHeight, this.notes[key]);
                currentSpanY += this.noteHeight;
            }
        });

        //Player marker
        this.wks.lineWidth = "3";
        this.wks.strokeStyle = "rgb(4, 118, 208)";
        this.wks.fillStyle = "rgb(4, 118, 208)";

        this.wks.beginPath();
        this.wks.moveTo(this.baseWidth, 0);
        this.wks.lineTo(this.baseWidth, this.canvasHeight);
        this.wks.stroke();

        this.wks.beginPath();
        this.wks.moveTo(this.baseWidth - 10, 0);
        this.wks.lineTo(this.baseWidth + 10, 0);
        this.wks.lineTo(this.baseWidth, 10);
        this.wks.lineTo(this.baseWidth - 10, 0);    
        this.wks.stroke();
        this.wks.fill();
    }

    printWhiteKey(whiteKeyHeight, offsetY, keyName) {
        this.wks.beginPath();
        this.wks.lineWidth = "1";
        this.wks.strokeStyle = "rgba(0, 0, 0, 0.2)";
        this.wks.fillStyle = this.whiteKeyGradient;
        
        // Rounded corners for white keys
        const radius = 3;
        this.wks.roundRect(0, offsetY, this.baseWidth, whiteKeyHeight, [0, radius, radius, 0]);
        this.wks.fill();
        this.wks.stroke();

        // Key shadow effect
        this.wks.beginPath();
        this.wks.fillStyle = "rgba(0, 0, 0, 0.05)";
        this.wks.fillRect(0, offsetY + whiteKeyHeight - 3, this.baseWidth, 3);

        // Key label styling
        this.bks.font = "12px Arial";
        this.bks.fillStyle = "#555555";
        this.bks.fillText(keyName, this.baseWidth - 25, offsetY + whiteKeyHeight/2 + 4);
    }

    printBlackKey(blackKeyHeight, offsetY) {
        // Enhanced black key styling
        this.bks.beginPath();
        this.bks.lineWidth = "1";
        this.bks.strokeStyle = "rgba(0, 0, 0, 0.4)";
        this.bks.fillStyle = this.blackKeyGradient;
        
        // Rounded corners for black keys
        const radius = 3;
        this.bks.roundRect(0, offsetY, this.baseWidth * 2/3, blackKeyHeight, [0, radius, radius, 0]);
        this.bks.fill();
        this.bks.stroke();

        // Key reflection effect
        const reflection = this.bks.createLinearGradient(0, offsetY, 0, offsetY + blackKeyHeight);
        reflection.addColorStop(0, "rgba(255, 255, 255, 0.1)");
        reflection.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
        reflection.addColorStop(1, "rgba(255, 255, 255, 0)");
        this.bks.fillStyle = reflection;
        this.bks.fill();
    }

    printSingleNote(offsetPixels, startPixel, durationPixel, velocity) {
       // Enhanced note visualization
       const noteGradient = this.ctx.createLinearGradient(0, offsetPixels, 0, offsetPixels + this.noteHeight);
       noteGradient.addColorStop(0, `rgba(4, 118, 208, ${velocity * 0.9})`);
       noteGradient.addColorStop(1, `rgba(4, 118, 208, ${velocity})`);

       this.ctx.beginPath();
       this.ctx.lineWidth = "1";
       this.ctx.strokeStyle = `rgba(4, 118, 208, ${velocity + 0.2})`;
       this.ctx.fillStyle = noteGradient;
       this.ctx.roundRect(startPixel, offsetPixels, durationPixel, this.noteHeight, 5);
       this.ctx.stroke();
       this.ctx.fill();

       // Add glow effect
       this.ctx.shadowColor = 'rgba(4, 118, 208, 0.3)';
       this.ctx.shadowBlur = 5;
       this.ctx.fill();
       this.ctx.shadowBlur = 0;

       // Create particles if note crosses the tracker
       const trackerX = this.baseWidth;
       if (startPixel <= trackerX && startPixel + durationPixel >= trackerX) {
           for (let i = 0; i < 5; i++) {
               this.particles.push(this.createParticle(trackerX, offsetPixels + this.noteHeight/2, velocity));
           }
       }
    }

    printMelodyContour(contours, note, singleStepDurationPixels, offsetX, offsetY) {
        const currentSpanNr = this.midiKeys.indexOf(String(note));

        const currentFrequency = Tone.Frequency(note, "midi").toFrequency();
        const nextFrequency = Tone.Frequency(note + 1, "midi").toFrequency();
        const prevFrequency = Tone.Frequency(note - 1, "midi").toFrequency();

        const deltaSup = nextFrequency - currentFrequency;
        const deltaInf = currentFrequency - prevFrequency;

        let currentPosition = offsetX;
        let currentYposition = null;

        this.ctx.beginPath();
        this.ctx.lineWidth = "1";
        this.ctx.strokeStyle = "#1075AB";

        if(this.lastStrokePosition.x != 0 && this.lastStrokePosition.x + this.zoomFactor/4 >= offsetX) {
            this.ctx.moveTo(this.lastStrokePosition.x, this.lastStrokePosition.y);
            this.ctx.lineTo(offsetX, offsetY + this.height / 2);
        } else {
            this.ctx.moveTo(offsetX, offsetY + this.height / 2);
        }

        contours.forEach(c => {
            let deltaPixels = 0;
            let currentTopBorderFrequency = nextFrequency;
            let currentBottomBorderFrequency = prevFrequency;
            let currentMidiNumber = note;
            let tempCurrentFrequency = currentFrequency;

            if(c > 0 && c<currentFrequency) {
                while(currentFrequency - c < currentBottomBorderFrequency) {
                    deltaPixels += this.noteHeight;
                    currentMidiNumber -= 1;
                    tempCurrentFrequency = Tone.Frequency(currentMidiNumber, "midi").toFrequency();
                    currentBottomBorderFrequency = Tone.Frequency(currentMidiNumber - 1, "midi").toFrequency();
                }

                deltaPixels += (((c)*this.noteHeight) / (currentBottomBorderFrequency - tempCurrentFrequency)); // To check
                currentYposition = offsetY + deltaPixels;
            } else if(c < 0) {
                while(c - currentFrequency > currentTopBorderFrequency) {
                    deltaPixels += this.noteHeight;
                    currentMidiNumber += 1;
                    tempCurrentFrequency = Tone.Frequency(currentMidiNumber, "midi").toFrequency();
                    currentTopBorderFrequency = Tone.Frequency(currentMidiNumber + 1, "midi").toFrequency();
                }

                deltaPixels += (((c)*this.noteHeight) / (currentTopBorderFrequency - tempCurrentFrequency));
                currentYposition = offsetY + this.noteHeight/2 - deltaPixels;
            } else {
                currentYposition = offsetY + this.noteHeight / 2;
            }

            this.ctx.lineTo(currentPosition, currentYposition);
            currentPosition += singleStepDurationPixels;
        });

        this.ctx.stroke();
        this.lastStrokePosition.x = currentPosition - singleStepDurationPixels;
        this.lastStrokePosition.y = currentYposition;
    }

    printMidiFile(midiSource, jsonPath) {
        this.midi = midiSource;

        this.fetchFiles(jsonPath).then(() => {
            this.lastStrokePosition = {x:0, y:0};

            this.midi.tracks.forEach(track => {
                const duration = track.duration;
                this.maxScroll = duration*this.zoomFactor + this.baseWidth;
                this.canvasWidth = this.maxScroll + parseInt(this.templateLayer.parentElement.style.maxWidth);
                this.resize(null, this.canvasWidth);
                this.printTemplate();
    
                // Melody contour parameters
                const lenSeconds = duration / this.json.length;
    
                const notes = track.notes;
                notes.forEach(singleNote => {
                    let offsetY = this.canvasHeight - this.midiKeys.indexOf(String(singleNote.midi))*this.noteHeight;
                    this.printSingleNote(offsetY, singleNote.time*this.zoomFactor + this.baseWidth, singleNote.duration*this.zoomFactor, singleNote.velocity)
                    
                    // Melody contour printing
                    let initSegment = Math.round(singleNote.time / lenSeconds);
                    let lastSegment = Math.round((singleNote.time + singleNote.duration) / lenSeconds);
                    this.printMelodyContour(
                        this.json.slice(initSegment, lastSegment + 1),
                        singleNote.midi,
                        lenSeconds*this.zoomFactor,
                        singleNote.time*this.zoomFactor + this.baseWidth,
                        offsetY,
                        this.zoomFactor
                    )
                });
            })
        });
    }

    timeScrollTo(time) {
        this.templateLayer.parentElement.scrollLeft = time*this.zoomFactor;
    }
}

export default Pianoroll;