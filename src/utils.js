function log(msg) {
  var m = new Date();
  var dateString = m.getUTCFullYear() + "/" + (m.getUTCMonth() + 1) + "/" + m.getUTCDate() + " " + String(m.getUTCHours()).padStart(2, '0') + ":" + String(m.getUTCMinutes()).padStart(2, '0') + ":" + String(m.getUTCSeconds()).padStart(2, '0') + "." + String(m.getUTCMilliseconds()).padStart(3, '0');
  console.log(dateString + " | " + msg);
}

export default log;
