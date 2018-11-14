/*
* Copyright 2018 ARDUINO SA (http://www.arduino.cc/)
* This file is part of arduino-iot-js.
* Copyright (c) 2018
* Authors: Fabrizio Mirabito
*
* This software is released under:
* The GNU General Public License, which covers the main part of
* arduino-iot-js
* The terms of this license can be found at:
* https://www.gnu.org/licenses/gpl-3.0.en.html
*
* You can be released from the requirements of the above licenses by purchasing
* a commercial license. Buying such a license is mandatory if you want to modify or
* otherwise use the software for commercial activities involving the Arduino
* software without disclosing the source code of your own applications. To purchase
* a commercial license, send an email to license@arduino.cc.
*
*/
const ArduinoCloud = require('../dist/index.js');

let connectionId;
const deviceId = '1f4ced70-53ad-4b29-b221-1b0abbdfc757';
const propertyIntName = 'integer';
const propertyIntValue = 22;

const propertyFloatName = 'float';
const propertyFloatVal = 22.5;

const propertyStrName = 'string';
const propertyStrVal = 'ok';

const propertyBoolName = 'boolean';
const propertyBoolVal = true;

it('ArduinoCloud connection', () => {
  expect.assertions(1);
  /* global token */
  return ArduinoCloud.connect({
    token,
    apiUrl: 'https://auth-dev.arduino.cc',
    host: 'wss.iot.oniudra.cc',
    onDisconnect: (message) => {
      // return ArduinoCloud.connect({host: 'localhost',
      // port: 8080, ssl: false, env: 'dev', token, onDisconnect: message => {
      if (message.errorCode !== 0) {
        throw Error(message);
      }
    },
  }).then((id) => {
    connectionId = id;
    expect(id).toBeDefined();
  }, (error) => {
    throw new Error(error);
  });
});

it('Property name must be a string in sendProperty', (done) => {
  try {
    ArduinoCloud.sendProperty(connectionId, deviceId, undefined, propertyIntValue);
  } catch (error) {
    if (error.message === 'Name must be a valid string') {
      done();
    }
  }
});

it('Simulate client write to serial monitor', (done) => {
  ArduinoCloud.writeCloudSerialMonitor(connectionId, deviceId, `this is a test ${Math.random()}`).then(() => {
    done();
  }, (error) => {
    throw new Error(error);
  });
});

it('Simulate device write to serial monitor', (done) => {
  const cloudSerialInputTopic = `/a/d/${deviceId}/s/o`;
  ArduinoCloud.sendMessage(connectionId, cloudSerialInputTopic, `this is a test ${Math.random()}`).then(() => {
    done();
  }, (error) => {
    throw new Error(error);
  });
});

it('Simulate device write and client read his message from serial monitor', (done) => {
  const cloudSerialInputTopic = `/a/d/${deviceId}/s/o`;

  const cb = () => {
    // console.log(`[${new Date()}] Message from serial: ${message}`);
    done();
  };

  ArduinoCloud.openCloudSerialMonitor(connectionId, deviceId, cb).then(() => {
    // console.log(`Subscribed to topic: ${topic}`);
    const message = `This is a test ${new Date()}`;
    ArduinoCloud.sendMessage(connectionId, cloudSerialInputTopic, message).then(() => {
    // console.log(`[${new Date()}] Message sent to serial: [${message}]`);
    }, (error) => {
      throw new Error(error);
    });
  }, (error) => {
    throw new Error(error);
  });
});

it('Simulate client read integer property sent by device', (done) => {
  ArduinoCloud.onPropertyValue(connectionId, deviceId, propertyIntName, (value) => {
    if (value === propertyIntValue) {
      done();
    }
  }).then(() => {
    ArduinoCloud.sendPropertyAsDevice(connectionId, deviceId, propertyIntName, propertyIntValue);
  });
});

it('Simulate client read float property sent by device', (done) => {
  ArduinoCloud.onPropertyValue(connectionId, deviceId, propertyFloatName, (value) => {
    if (value === propertyFloatVal) {
      done();
    }
  }).then(() => {
    ArduinoCloud.sendPropertyAsDevice(connectionId, deviceId, propertyFloatName, propertyFloatVal);
  });
});

it('Simulate client read string property sent by device', (done) => {
  ArduinoCloud.onPropertyValue(connectionId, deviceId, propertyStrName, (value) => {
    if (value === propertyStrVal) {
      done();
    }
  }).then(() => {
    ArduinoCloud.sendPropertyAsDevice(connectionId, deviceId, propertyStrName, propertyStrVal);
  });
});

it('Simulate client read boolean property sent by device', (done) => {
  ArduinoCloud.onPropertyValue(connectionId, deviceId, propertyBoolName, (value) => {
    if (value === propertyBoolVal) {
      ArduinoCloud.disconnect(connectionId);
      done();
    }
  }).then(() => {
    ArduinoCloud.sendPropertyAsDevice(connectionId, deviceId, propertyBoolName, propertyBoolVal);
  });
});