import log from '../utils'

export default class AudioManager {
  constructor() {
    this.tracks = new Map();
    this.volumes = new Map();
    this.oldTimes = new Map();
    this.baseURL = "https://home.marcdif.com/music/"
    this.audio = null;
    this.songPath = '';
    this.startTime = 0;
    this.songDuration = 0;
    this.offset = 0;
  }

  startSong(songPath, startTime, songDuration, showAutoPlayButton, offset) {
    this.offset = offset;
    let trackUrl = this.baseURL + songPath;
    if (this.audio != null) {
      this.audio.remove();
    }
    this.audio = new Audio(trackUrl);
    this.audio.id = songPath;
    this.audio.volume = 1;

    this.songPath = songPath;
    this.startTime = startTime;
    this.songDuration = songDuration;

    let currentTime = Date.now();
    let startingLate = currentTime > startTime;
    log("songPath: " + songPath + ", trackUrl: " + trackUrl + ", startTime: " + startTime + ", songDuration: " + songDuration + ", currentTime: " + currentTime + ", startingLate: " + startingLate)
    setTimeout(() => {
      var howLate = 0;
      if (startingLate) {
        howLate = Date.now() - startTime;
        log("Starting " + howLate + "ms late...")
        if (howLate > songDuration) {
          // song is already over
          log('[ERROR] Song was over before we started playing.');
          return;
        }
        this.audio.currentTime = (howLate / 1000);
      }
      log("Starting music!")
      try {
        let startPlayPromise = this.audio.play();

        if (startPlayPromise !== undefined) {
          startPlayPromise.then(() => {
            log('[DEBUG] Audio started! Current time: ' + this.audio.currentTime);
            this.tracks.set(songPath, this.audio);
            let h = this;
            this.audio.onended = function () {
              h.tracks.delete(songPath);
            }
          }).catch(error => {
            if (error.name === "NotAllowedError") {
              log('[DEBUG] Need to handle autoplay blocked error!');
              showAutoPlayButton.call();
            }
          })
        }
      } catch (e) {
        log("Failed to start song! Maybe it doesn't exist?")
        this.audio = null
        this.stopSong()
        return
      }
    }, startingLate ? 0 : (startTime - currentTime));
  }

  stopSong() {
    if (this.audio !== undefined) {
      this.audio.pause();
    }
  }

  forcePlayAudio(result) {
    if (this.audio !== undefined) {
      let currentTime = Date.now();
      let startingLate = currentTime > this.startTime;
      log("songPath: " + this.songPath + ", startTime: " + this.startTime + ", songDuration: " + this.songDuration + ", currentTime: " + currentTime + ", startingLate: " + startingLate)
      let howLate = Date.now() - this.startTime;
      log("Starting " + howLate + "ms late...")
      if (howLate > this.songDuration) {
        // song is already over
        log('[ERROR] Song was over before we started playing.');
        return;
      }
      this.audio.currentTime = (howLate / 1000);

      let startPlayPromise = this.audio.play();
      log("Started! " + Date.now());

      if (startPlayPromise !== undefined) {
        startPlayPromise.then(() => {
          result.call();
        }).catch(error => {
          log("[DEBUG] Even that button didn't fix it!");
        })
      }
    }
  }
}

// packet start time: 1641410169330.0
//        start time: 1641410169272.5  Wednesday, January 5, 2022 2:16:09.272 PM
//      current time: 1641169757293.0  Sunday, January 2, 2022 7:29:17.293 PM
//                        240411979.5
