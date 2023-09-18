import React from "react";
import AudioManager from './audiolib/index'
import ShowControl from './showcontrol'
import log from './utils'

var classNames = require('classnames');
const WebSocket = require('isomorphic-ws');
const socketURL = "wss://syncserver.home.marcdif.com"
var audioManager = new AudioManager();

class Page extends React.Component {

  constructor(props) {
    super(props)

    this.startShow = this.startShow.bind(this)
    this.ws = null;
    this.state = {
      clientId: null,
      sync_start_local_time: 0,
      sync_server_time_offset: 0,
      synchronized: false,
      synchronizing: false,
      connecting: false,
      displayText: 'Not Connected',
      activeShowName: 'None',
      syncServerConnected: false,
      lightServerConnected: false,
      showAutoPlayButton: false
    };
  }

  makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() *
        charactersLength));
    }
    return result;
  }

  connectToAudio() {
    log("Connecting...")
    var clientId = this.makeid(16)
    this.setState({
      connecting: true,
      synchronized: false,
      synchronizing: false,
      clientId: clientId,
      displayText: "Connecting...",
      syncServerConnected: false
    })
    log("Using clientId " + clientId)
    let timer = setTimeout(() => this.socketServer(), 500)
    return () => {
      clearTimeout(timer)
    }
  }

  socketServer = () => {
    log("Connecting to " + socketURL)

    if (this.ws != null) {
      if (this.ws.readyState === WebSocket.OPEN) {
        log("[WARN] Closing existing connection...")
        this.ws.close()
      }
      this.ws = null;
    }

    this.ws = new WebSocket(socketURL)

    this.ws.onopen = () => {
      log('Starting time sync process...');
      this.setState({ synchronizing: true })
      var GetTime = new Packets.GetTime();
      log('Sending this packet: ' + GetTime.asJSON());
      this.ws.send(GetTime.asJSON());
      this.setState({ sync_start_local_time: Date.now(), syncServerConnected: true })
    };

    this.ws.onclose = () => {
      log('disconnected');
      audioManager.stopSong();
      this.setState({ synchronized: false, synchronizing: false, connecting: false, displayText: "Not Connected", activeShowName: "None", syncServerConnected: false, lightServerConnected: false })
    }

    this.ws.onmessage = (data) => {
      let json = JSON.parse(data.data)
      log('received: ' + JSON.stringify(json));
      try {
        if (typeof json.id === 'undefined') throw log('Packet sent without ID: ' + json);
        let p = null;
        if (json.id === PacketID.GET_TIME) {
          if (this.state.sync_start_local_time === 0 || !this.state.synchronizing) {
            log("Not handling GET_TIME packet - haven't started a sync process!")
            return;
          }
          p = (new Packets.GetTime()).fromObject(json);
          var received_time = Date.now();
          var difference = received_time - this.state.sync_start_local_time;
          this.setState({ sync_server_time_offset: (this.state.sync_start_local_time - (p.serverTime - (difference / 2))) * -1 })

          log('p.serverTime: ' + p.serverTime);
          log('difference: ' + difference);
          log('difference/2: ' + (difference / 2));
          log('sync_start_local_time: ' + this.state.sync_start_local_time);

          log('Response took ' + difference + 'ms... setting sync_server_time_offset to ' + this.state.sync_server_time_offset);

          var current_server_time = Date.now() + this.state.sync_server_time_offset;

          log('Responding with server time being ' + current_server_time);
          this.setState({ sync_start_local_time: 0 })

          var GetTime = (new Packets.ConfirmSync()).set(current_server_time);
          log('Sending this packet: ' + GetTime.asJSON());
          this.ws.send(GetTime.asJSON());
        } else if (json.id === PacketID.CONFIRM_SYNC) {
          if (!this.state.synchronizing) {
            log("Not handling CONFIRM_SYNC Packet - haven't started a sync process!")
            return;
          }
          p = (new Packets.ConfirmSync()).fromObject(json);
          if (p.clientTime >= 0) {
            // accepted
            log('[INFO] Sync succeeded! ' + p.clientTime + 'ms offset');
            p = (new Packets.ClientConnect()).set(this.state.clientId);
            this.ws.send(p.asJSON());
            this.setState({
              synchronizing: false,
              sync_start_local_time: 0,
              synchronized: true,
              connecting: false,
              displayText: "Connected!"
            });
          } else {
            // failed
            log('[ERROR] Sync failed!');
            this.setState({
              synchronizing: false,
              sync_start_local_time: 0,
              sync_server_time_offset: 0,
              synchronized: false,
              connecting: false,
              displayText: "Time Sync Failed!"
            })
          }
        } else if (json.id === PacketID.START_SONG) {
          if (!this.state.synchronized) {
            log("[ERROR] Can't start a song, we aren't synchronized!");
            return;
          }
          p = (new Packets.StartSong()).fromObject(json);
          audioManager.startSong(p.songPath, p.startTime - this.state.sync_server_time_offset, p.songDuration, this.showAutoPlayButton.bind(this), this.state.sync_server_time_offset);
          this.setState({
            displayText: "Now Playing: " + p.showName,
            activeShowName: p.showName
          });
        } else if (json.id === PacketID.STOP_SONG || json.id === PacketID.STOP_SHOW) {
          if (!this.state.synchronized) {
            log("[ERROR] Can't stop a song, we aren't synchronized!");
            return;
          }
          audioManager.stopSong();
          this.setState({
            displayText: "Now Playing: No Show",
            activeShowName: 'None'
          });
        } else if (json.id === PacketID.SERVER_STATUS) {
          p = (new Packets.ServerStatus()).fromObject(json);
          log('[INFO] Light Server Status Update, connected: ' + p.lightServerConnected);
          this.setState({
            lightServerConnected: p.lightServerConnected
          });
        }
      } catch (a) {
        this.ws.close();
        log('An error occured: ' + a + '<br/>The sent data was ' + json + '. Line number #' + (a != null ? a.lineNumber : ""));
      }
    };
  }

  startShow = (showName) => {
    if (this.ws == null) {
      log("WebSocket isn't connected - can't start show!")
      return;
    }
    log("Starting show " + showName)
    var p = (new Packets.StartShow()).set(showName)
    this.ws.send(p.asJSON())
  }

  stopShow = () => {
    if (this.ws == null) {
      log("WebSocket isn't connected - can't stop show!")
      return;
    }
    log("Stopping show!")
    var p = (new Packets.StopShow())
    this.ws.send(p.asJSON())
  }

  hideAutoPlayButton = () => {
    this.setState({ showAutoPlayButton: false });
  }

  showAutoPlayButton = () => {
    this.setState({ showAutoPlayButton: true });
  }

  render() {
    var connectButtonClasses = classNames({
      'button': true,
      'red': !this.state.synchronized && !this.state.connecting,
      'blue': !this.state.synchronized && this.state.connecting,
      'green': this.state.synchronized && !this.state.connecting
    });
    var autoPlayButtonClasses = classNames({
      'button-hidden': !this.state.showAutoPlayButton,
      'button': true,
      'blue': true
    });
    return (
      <div>
        <h1>LightShow Control Panel</h1>
        <div className="buttons">
          {/* <h3>{this.state.displayText}</h3> */}
          <h3 className={this.state.activeShowName === "None" ? "red" : "blue"}>
            Running Show: {this.state.activeShowName}
          </h3>
          <h3 className={this.state.syncServerConnected ? "green" : (this.state.connecting ? "blue" : "red")}>
            Sync Server: {this.state.syncServerConnected ? "Connected" : (this.state.connecting ? "Connecting..." : "Disconnected")}
          </h3>
          <h3 className={this.state.synchronized ? "green" : (this.state.synchronizing ? "blue" : "red")}>
            Synchronized: {this.state.synchronized ?
              ("Yes (" + Math.abs(this.state.sync_server_time_offset) + "ms " + (this.state.sync_server_time_offset >= 0 ? "behind" : "ahead") + ")") :
              (this.state.synchronizing ? "Synchronizing..." : "No")}
          </h3>
          <h3 className={this.state.lightServerConnected ? "green" : "red"}>
            Light Server: {this.state.lightServerConnected ? "Online" : "Offline"}
          </h3>
          <button className={autoPlayButtonClasses} onClick={() => audioManager.forcePlayAudio(this.hideAutoPlayButton.bind(this))}>
            Click to start the music!
          </button>
          <br style={{ display: this.state.showAutoPlayButton ? '' : 'none' }} />
          <button className={connectButtonClasses} onClick={() => this.connectToAudio()}>{this.state.syncServerConnected ? "Reconnect" : "Connect"}</button>
          <br />
          <div style={{ display: this.state.syncServerConnected ? '' : 'none' }}>
            <ShowControl startShow={this.startShow} stopShow={this.stopShow} connected={this.state.synchronized} />
          </div>
        </div>
      </div>
    );
  }
}

var PacketID = {
  HEARTBEAT: 0,
  GET_TIME: 1,
  CONFIRM_SYNC: 2,
  CLIENT_CONNECT: 3,
  START_SONG: 4,
  STOP_SONG: 5,
  START_SHOW: 6,
  STOP_SHOW: 7,
  SERVER_STATUS: 8
}
var Packets = {};
Packets.protocolVersion = 8;
Packets.Heartbeat = function () {
  this.message = '';
  this.reason = '';
  this.set = function () {
    return this;
  };
  this.fromObject = function (e) {
    return this;
  };
  this.asJSON = function () {
    return JSON.stringify({
      id: PacketID.HEARTBEAT
    })
  }
};
Packets.GetTime = function () {
  this.serverTime = 0;
  this.set = function (t) {
    this.serverTime = t;
    return this;
  };
  this.fromObject = function (e) {
    this.serverTime = e.serverTime;
    return this;
  };
  this.asJSON = function () {
    return JSON.stringify({
      id: PacketID.GET_TIME,
      serverTime: this.serverTime
    })
  };
}
Packets.ConfirmSync = function () {
  this.clientTime = 0;
  this.set = function (t) {
    this.clientTime = t;
    return this;
  };
  this.fromObject = function (e) {
    this.clientTime = e.clientTime;
    return this;
  };
  this.asJSON = function () {
    return JSON.stringify({
      id: PacketID.CONFIRM_SYNC,
      clientTime: this.clientTime
    })
  };
}
Packets.ClientConnect = function () {
  this.clientId = '';
  this.connectionType = '';
  this.set = function (t) {
    this.clientId = t;
    this.connectionType = 'WEBCLIENT';
    return this;
  };
  this.fromObject = function (e) {
    this.clientId = e.clientId;
    this.connectionType = e.connectionType;
    return this;
  };
  this.asJSON = function () {
    return JSON.stringify({
      id: PacketID.CLIENT_CONNECT,
      clientId: this.clientId,
      connectionType: this.connectionType
    })
  };
};
Packets.StartSong = function () {
  this.songPath = '';
  this.startTime = 0;
  this.songDuration = 0;
  this.showName = '';
  this.set = function (e, f, g, h) {
    this.songPath = e;
    this.startTime = f;
    this.songDuration = g;
    this.showName = h;
    return this;
  };
  this.fromObject = function (e) {
    this.songPath = e.songPath;
    this.startTime = e.startTime;
    this.songDuration = e.songDuration;
    this.showName = e.showName;
    return this;
  };
  this.asJSON = function () {
    return JSON.stringify({
      id: PacketID.START_SONG,
      songPath: this.songPath,
      startTime: this.startTime,
      songDuration: this.songDuration,
      showName: this.showName
    })
  }
};
Packets.StartShow = function () {
  this.showName = '';
  this.set = function (e) {
    this.showName = e;
    return this;
  };
  this.fromObject = function (e) {
    this.showName = e.showName;
    return this;
  };
  this.asJSON = function () {
    return JSON.stringify({
      id: PacketID.START_SHOW,
      showName: this.showName
    })
  }
};
Packets.StopShow = function () {
  this.set = function (e) {
    return this;
  };
  this.fromObject = function (e) {
    return this;
  };
  this.asJSON = function () {
    return JSON.stringify({
      id: PacketID.STOP_SHOW,
    })
  }
};
Packets.ServerStatus = function () {
  this.lightServerConnected = '';
  this.set = function (e) {
    this.lightServerConnected = e;
    return this;
  };
  this.fromObject = function (e) {
    this.lightServerConnected = e.lightServerConnected;
    return this;
  };
  this.asJSON = function () {
    return JSON.stringify({
      id: PacketID.SERVER_STATUS,
      lightServerConnected: this.lightServerConnected
    })
  }
};

export default Page
