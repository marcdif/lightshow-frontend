import React from "react";
import shows_list from './shows.json';

var classNames = require('classnames')

class ShowControl extends React.Component {

  constructor(props) {
    super(props)

    this.startShow = props.startShow

    this.state = {
      expanded: false,
      shows: shows_list,
      active_show: null
    }
  }

  toggleMenu = () => {
    this.setState({
      expanded: !this.state.expanded
    })
  }

  stopShow = () => {
    this.props.stopShow()
  }

  getKeys = () => {
    var v = Object.keys(this.state.shows[0]);
    v.push("start")
    return v
  }

  getHeader = () => {
    var keys = this.getKeys();
    return keys.map((key, index) => {
      return <th key={key}>{key.toUpperCase()}</th>
    });
  }

  getRowsData = (connected) => {
    var items = this.state.shows;
    var keys = this.getKeys();
    return items.map((row, index) => {
      return <tr key={index}><RenderRow key={index} data={row} keys={keys} startShow={this.startShow} connected={connected} /></tr>
    })
  }

  render() {
    var classes = classNames({
      'button': true,
      'green': !this.state.expanded,
      'slowBlue': this.state.expanded
    });
    return (
      <div>
        <button className={classes} onClick={() => this.toggleMenu()}>Show Control</button>
        <button className="button red" onClick={() => this.stopShow()}>Stop Show</button><br />
        {this.state.expanded ? (
          <table key={this.props.connected} className="table">
            <thead>
              <tr>{this.getHeader()}</tr>
            </thead>
            <tbody>
              {this.getRowsData(this.props.connected)}
            </tbody>
          </table>
        ) : (
          null
        )}
      </div>
    )
  }
}

class RenderRow extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      keys: props.keys,
      data: props.data,
      connected: props.connected
    }
  }

  startShow = (showName) => {
    this.props.startShow(showName)
  }

  render() {
    var classes = classNames({
      'startButton': true,
      'red': !this.props.connected,
      'green': this.props.connected
    });
    var items = [];
    var showName = ''
    this.state.keys.forEach((key, index) => {
      if (key === 'start') {
        var data = <button className={classes} onClick={() => this.startShow(showName)}>START</button>
        items.push(
          <td key={data}>{data}</td>
        )
      } else {
        if (key === 'file') {
          showName = this.state.data[key]
        }
        items.push(
          <td key={this.state.data[key]}>{this.state.data[key]}</td>
        )
      }
    })
    return items
  }
}


export default ShowControl
