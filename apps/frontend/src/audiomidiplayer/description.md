#### Requirements

npm install tone

npm install @tonejs/midi

#### Notes

I uploaded the source files in the audiomidiplayer/src folder, the files i used to test it in the audiomidiplayer/public folder.

I did this because I tested it in another react environment, so not to mess up anything.

#### AudioMidiViewer

(Requires the AudioMidiViewer.css file)

The AudioMidiViewer class is the react component which renders the elements:

- 4 overlapped canvas elements (which are basically treated as layers to draw all the needed elements)
- 3 buttons (play, pause, stop) useful for controlling playback
- n checkbox inputs and n sliders (where n = number of stems) to control the volume and muting of each stem

#### Pianoroll

Class used for rendering the notes and melody contour in the canvas space.

The pianoroll class takes as input:

* 4 canvas elements
* 1 scrollCallback, a callback invoked when the user scrolls (horizontally) the canvas in order for the audio player to be updated and seek the playback to the position decided by the user

Once there is an instance of it we can call the printMidiFile method - to print the notes and the contour -  passing as arguments:

* The previously loaded midi file (this midi has to be passed also to the AudioPlayer class, so we load it once in the AudioMidiViewer and pass it as argument to both classes)
* The url of the melody contour json file

#### AudioPlayer

Class used in order to playback the audio and the midi.

The methods of this class are pretty straightforward to understand.

We call loadAudioFileFromURL passing as argument a dictionary containing the urls of the audio tracks to load, each one identified by a unique key. This is an asyncronous method because it requires some time to load.

Then we call loadMidi passing as argument the previously parsed midi file to schedule the midi triggers on the Transport.

Then we attach the event listeners to the inputs/buttons and enable the controls (now that all is ready to go).

#### Issues

Main issues are with the AudioPlayer class.

* **Midi reproduction**: even if midi events are scheduled (after the call to the loadMidi method) when the transport starts they don't play
* **Transport**: the Tone.Transport class is a singleton, meaning that there is only one object of this type for each instance of the application. This means that if we display multiple songs in one single page we need to reschedule all the triggers every time the user wants to play a different song. This aspect is not managed right now
* **Play/Pause**: the player plays the audio correctly but there are some corner cases that cause problems
  * When the user moves the position of the rizontal axis of the canvas, the player is correctly updated to restart playing from that position.
    * If you do: **PLAYER READY -> PLAY -> PAUSE -> SCROLL ->PLAY** it works fine
    * If you do: **PLAYER READY -> SCROLL -> PLAY** the canvas is updated correctly while playing but the audio does not work (think it's a problem of Tone.start() that has to be called from a user's gesture)
  * Keep in mind that in order to scroll the canvas (horizontally) the player has to be paused, otherwise it will scroll automatically based on the player's position. I tried the possibility to make it work if the player scrolls while playing but that's a little bit complex, so I think like this is enough.
