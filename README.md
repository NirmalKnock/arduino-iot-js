[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

# arduino-iot-js

JS module providing interaction with Arduino Cloud

## Installation

```bash
$ npm install git+ssh://git@github.com/arduino/arduino-iot-js.git
```

## How to use
```javascript
import ArduinoCloud from 'arduino-iot-js';

// connect establishes a connection with mqtt, using token as the password
// Development Vernemq server host is wss.iot.oniudra.cc port 8443, token is your Hydra bearer token
// options = {
//   host: 'BROKER_URL',        // Default is wss.iot.oniudra.cc
//   port: BROKER_PORT,         // Default is 8443
//   ssl: true/false,           // Default is true
//   env: 'dev',                // Api env, default is dev (for now!)
//   token: 'YOUR_BEARER_TOKEN' // Required!   
//   apiUrl: 'AUTH SERVER URL', // https://auth-dev.arduino.cc for dev
//   onDisconnect: message => { /* Disconnection callback */ }
// }
ArduinoCloud.connect(options).then(connectionId => {
  // Connected
});

ArduinoCloud.disconnect(connectionId).then(() => {
  // Disconnected
});

ArduinoCloud.subscribe(connectionId, topic, cb).then(topic => {
  // Subscribed to topic, messaged fired in the cb
});

ArduinoCloud.unsubscribe(connectionId, topic).then(topic => {
  // Unsubscribed to topic
});

ArduinoCloud.sendMessage(connectionId, topic, message).then(() => {
  // Message sent
});

ArduinoCloud.openCloudSerialMonitor(connectionId, deviceId, cb).then(topic => {
  // Serial monitor messages fired to cb
});

ArduinoCloud.writeCloudSerialMonitor(connectionId, deviceId, message).then(() => {
  // Message sent to serial monitor
});

ArduinoCloud.closeCloudSerialMonitor(connectionId, deviceId).then(topic => {
  // Close serial monitor
});

// Send a property value to a device
// - value can be a string, a boolean or a number
// - timestamp is a unix timestamp, not required
ArduinoCloud.sendProperty(connectionId, deviceId, name, value, timestamp).then(() => {
  // Property value sent
});

// Register a callback on a property value change
// 
ArduinoCloud.onPropertyValue(connectionId, deviceId, propertyName, updateCb).then(() => {
  // updateCb(message) will be called every time a new value is available. Value can be string, number, or a boolean depending on the property type
});

```

## Run tests
First of all you need a valid Hydra Arduino token, you can get it from [Create Cloud Dev](https://create-dev.arduino.cc/cloud/)

After you can use this token to run tests

```bash
$ TOKEN=YOUR_HYDRA_TOKEN_HERE npm run test
```