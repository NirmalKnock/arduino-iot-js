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

/*
     SenML labels
     https://tools.ietf.org/html/draft-ietf-core-senml-16#section-4.3

     +---------------+-------+------------+------------+------------+
     |          Name | Label | CBOR Label | JSON Type  | XML Type   |
     +---------------+-------+------------+------------+------------+
     |     Base Name | bn    |         -2 | String     | string     |
     |     Base Time | bt    |         -3 | Number     | double     |
     |     Base Unit | bu    |         -4 | String     | string     |
     |    Base Value | bv    |         -5 | Number     | double     |
     |      Base Sum | bs    |         -6 | Number     | double     |
     |       Version | bver  |         -1 | Number     | int        |
     |          Name | n     |          0 | String     | string     |
     |          Unit | u     |          1 | String     | string     |
     |         Value | v     |          2 | Number     | double     |
     |  String Value | vs    |          3 | String     | string     |
     | Boolean Value | vb    |          4 | Boolean    | boolean    |
     |    Data Value | vd    |          8 | String (*) | string (*) |
     |     Value Sum | s     |          5 | Number     | double     |
     |          Time | t     |          6 | Number     | double     |
     |   Update Time | ut    |          7 | Number     | double     |
     +---------------+-------+------------+------------+------------+
*/

import Paho from 'paho-client';
import CBOR from 'cbor-js';

import ArduinoCloudError from './ArduinoCloudError';

let connection = null;
let connectionOptions = null;
const subscribedTopics = {};
const propertyCallback = {};
const arduinoCloudPort = 8443;
const arduinoCloudHost = 'wss.iot.arduino.cc';
const arduinoAuthURL = 'https://auth.arduino.cc';

const getUserId = (apiUrl, token) => fetch(apiUrl, {
  method: 'get',
  headers: new Headers({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }),
}).then(res => res.json());


// Connect establishes a connection with mqtt, using token as the password, and returns a promise
// of a Symbol identifying the mqtt client
const connect = options => new Promise((resolve, reject) => {
  let ssl = false;
  if (options.ssl !== false) {
    ssl = true;
  }
  const opts = {
    host: options.host || arduinoCloudHost,
    port: options.port || arduinoCloudPort,
    apiUrl: options.apiUrl || arduinoAuthURL,
    ssl,
    token: options.token,
    onDisconnect: options.onDisconnect,
    onTrace: options.onTrace,
    onConnected: options.onConnected,
  };

  connectionOptions = opts;

  if (connection) {
    return reject(new Error('connection failed: connection already open'));
  }

  if (!opts.host) {
    return reject(new Error('connection failed: you need to provide a valid host (broker)'));
  }

  if (!opts.token) {
    return reject(new Error('connection failed: you need to provide a valid token'));
  }

  if (!opts.apiUrl) {
    return reject(new Error('no apiUrl parameter is provided'));
  }

  return getUserId(`${opts.apiUrl}/v1/users/byID/me`, options.token).then((res) => {
    const clientID = `${res.id}:${new Date().getTime()}`;
    const client = new Paho.Client(opts.host, opts.port, clientID);
    client.topics = {};
    client.properties = {};

    client.onMessageArrived = (msg) => {
      if (msg.topic.indexOf('/s/o') > -1) {
        client.topics[msg.topic].forEach((cb) => {
          cb(msg.payloadString);
        });
      } else {
        const buf = new ArrayBuffer(msg.payloadBytes.length);
        const bufView = new Uint8Array(buf);
        for (let i = 0, strLen = msg.payloadBytes.length; i < strLen; i += 1) {
          bufView[i] = msg.payloadBytes[i];
        }

        const propertyValue = CBOR.decode(buf);
        propertyValue.forEach((p) => {
          // Support cbor labels
          const propertyNameKey = p.n !== undefined ? p.n : p['0'];
          const valueKey = p.v !== undefined ? 'v' : '2';
          const valueStringKey = p.vs !== undefined ? 'vs' : '3';
          const valueBooleanKey = p.vb !== undefined ? 'vb' : '4';
          if (propertyCallback[msg.topic][propertyNameKey]) {
            let value = null;

            if (!(p[valueKey] === undefined)) {
              value = p[valueKey];
            } else if (!(p[valueStringKey] === undefined)) {
              value = p[valueStringKey];
            } else if (!(p[valueBooleanKey] === undefined)) {
              value = p[valueBooleanKey];
            }

            propertyCallback[msg.topic][propertyNameKey](value);
          }
        });
      }
    };

    client.onConnected = (reconnect) => {
      if (reconnect === true) {
        // This is a re-connection: re-subscribe to all topics subscribed before the
        // connection loss
        Object.values(subscribedTopics).forEach((subscribeParams) => {
          subscribe(subscribeParams.topic, subscribeParams.cb);
        });
      }

      if (typeof opts.onConnected === 'function') {
        opts.onConnected(reconnect);
      }
    };

    if (typeof onDisconnect === 'function') {
      client.onConnectionLost = opts.onDisconnect;
    }

    const connectionOpts = {
      useSSL: opts.ssl,
      timeout: 30,
      mqttVersion: 4,
      userName: res.id,
      // password: token,
      mqttVersionExplicit: true,
      // If reconnect is set to true, in the event that the connection is lost, the client will
      // attempt to reconnect to the server. It will initially wait 1 second before it attempts
      // to reconnect, for every failed reconnect attempt, the delay will double until it is at
      // 2 minutes at which point the delay will stay at 2 minutes.
      reconnect: true,
      keepAliveInterval: 30,
      onSuccess: () => {
        connection = client;
        return resolve();
      },
      onFailure: ({ errorCode, errorMessage }) => reject(
        new ArduinoCloudError(errorCode, errorMessage),
      ),
    };


    connectionOpts.password = opts.token;

    if (typeof opts.onTrace === 'function') {
      client.trace = (log) => {
        opts.onTrace(log);
      };
    }

    client.connect(connectionOpts);
  }, reject);
});

const disconnect = () => new Promise((resolve, reject) => {
  if (!connection) {
    return reject(new Error('disconnection failed: connection closed'));
  }

  try {
    connection.disconnect();
  } catch (error) {
    return reject(error);
  }

  // Remove the connection
  connection = null;

  // Remove property callbacks to allow resubscribing in a later connect()
  Object.keys(propertyCallback).forEach((topic) => {
    if (propertyCallback[topic]) {
      delete propertyCallback[topic];
    }
  });

  // Clean up subscribed topics - a new connection might not need the same topics
  Object.keys(subscribedTopics).forEach((topic) => {
    delete subscribedTopics[topic];
  });

  return resolve();
});

const updateToken = token => new Promise(((updateTokenResolve, updateTokenReject) => {
  if (!connection) {
    return updateTokenReject(new Error('disconnection failed: connection closed'));
  }

  // Wrap the update token process into a single promise-returning function
  const updateTokenPromise = () => new Promise((resolve) => {
    try {
      // Disconnect to the connection using the old token
      connection.disconnect();
    } catch (error) {
      // Ignore disconnection errors that comes out when Paho is reconnecting
    }

    // Remove the connection
    connection = null;

    return resolve();
  })
    .then(() => {
      // Reconnect using the new token
      const reconnectOptions = Object.assign({}, connectionOptions, { token });
      return connect(reconnectOptions);
    })
    .then(() => {
      // Re-subscribe to all topics subscribed before the reconnection
      Object.values(subscribedTopics).forEach((subscribeParams) => {
        subscribe(subscribeParams.topic, subscribeParams.cb);
      });

      if (typeof connectionOptions.onConnected === 'function') {
        // Call the connection callback (with the reconnection param set to true)
        connectionOptions.onConnected(true);
      }
    });

  let updateTokenInterval = null;

  // It runs the token update. If it succeed, clears the interval and
  // exits updateToken.
  const updateTokenIntervalFunction = () => {
    updateTokenPromise()
      .then(() => {
        // Token update went well - exiting
        clearInterval(updateTokenInterval);
        return updateTokenResolve();
      })
      .catch(() => {
        // Ignore reconnection errors - keep trying to reconnect
      });
  };

  // Try to refresh the token every 30 secs
  updateTokenInterval = setInterval(updateTokenIntervalFunction, 30000);

  // Try immediately to refresh the token - if it fails the next
  // tentative will be started by the setInterval
  updateTokenIntervalFunction();
}));

const subscribe = (topic, cb) => new Promise((resolve, reject) => {
  if (!connection) {
    return reject(new Error('subscription failed: connection closed'));
  }

  return connection.subscribe(topic, {
    onSuccess: () => {
      if (!connection.topics[topic]) {
        connection.topics[topic] = [];
      }
      connection.topics[topic].push(cb);
      return resolve(topic);
    },
    onFailure: () => reject(),
  });
});

const unsubscribe = topic => new Promise((resolve, reject) => {
  if (!connection) {
    return reject(new Error('disconnection failed: connection closed'));
  }

  return connection.unsubscribe(topic, {
    onSuccess: () => resolve(topic),
    onFailure: () => reject(),
  });
});


const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const sendMessage = (topic, message) => new Promise((resolve, reject) => {
  if (!connection) {
    return reject(new Error('disconnection failed: connection closed'));
  }

  connection.publish(topic, message, 1, false);
  return resolve();
});

const openCloudMonitor = (deviceId, cb) => {
  const cloudMonitorOutputTopic = `/a/d/${deviceId}/s/o`;
  return subscribe(cloudMonitorOutputTopic, cb);
};

const writeCloudMonitor = (deviceId, message) => {
  const cloudMonitorInputTopic = `/a/d/${deviceId}/s/i`;
  return sendMessage(cloudMonitorInputTopic, message);
};

const closeCloudMonitor = (deviceId) => {
  const cloudMonitorOutputTopic = `/a/d/${deviceId}/s/o`;
  return unsubscribe(cloudMonitorOutputTopic);
};

const sendProperty = (thingId, name, value, timestamp) => {
  const propertyInputTopic = `/a/t/${thingId}/e/i`;

  if (timestamp && !Number.isInteger(timestamp)) {
    throw new Error('Timestamp must be Integer');
  }

  if (name === undefined || typeof name !== 'string') {
    throw new Error('Name must be a valid string');
  }

  const cborValue = {
    bt: timestamp || new Date().getTime(),
    n: name,
  };

  switch (typeof value) {
    case 'string':
      cborValue.vs = value;
      break;
    case 'number':
      cborValue.v = value;
      break;
    case 'boolean':
      cborValue.vb = value;
      break;
    default:
      break;
  }

  return sendMessage(propertyInputTopic, CBOR.encode([cborValue]));
};

const getSenml = (deviceId, name, value, timestamp) => {
  if (timestamp && !Number.isInteger(timestamp)) {
    throw new Error('Timestamp must be Integer');
  }

  if (name === undefined || typeof name !== 'string') {
    throw new Error('Name must be a valid string');
  }

  const senMl = {
    bt: timestamp || new Date().getTime(),
    n: name,
  };

  if (deviceId) {
    senMl.bn = `urn:uuid:${deviceId}`;
  }

  switch (typeof value) {
    case 'string':
      senMl.vs = value;
      break;
    case 'number':
      senMl.v = value;
      break;
    case 'boolean':
      senMl.vb = value;
      break;
    default:
      break;
  }
  return senMl;
};

const getCborValue = (senMl) => {
  const cborEncoded = CBOR.encode(senMl);
  return arrayBufferToBase64(cborEncoded);
};

const sendPropertyAsDevice = (deviceId, thingId, name, value, timestamp) => {
  const propertyInputTopic = `/a/t/${thingId}/e/o`;

  if (timestamp && !Number.isInteger(timestamp)) {
    throw new Error('Timestamp must be Integer');
  }

  if (name === undefined || typeof name !== 'string') {
    throw new Error('Name must be a valid string');
  }

  const senMlValue = getSenml(deviceId, name, value, timestamp);
  return sendMessage(propertyInputTopic, CBOR.encode([senMlValue]));
};

const onPropertyValue = (thingId, name, cb) => {
  if (!name) {
    throw new Error('Invalid property name');
  }
  if (typeof cb !== 'function') {
    throw new Error('Invalid callback');
  }
  const propOutputTopic = `/a/t/${thingId}/e/o`;

  subscribedTopics[thingId] = {
    topic: propOutputTopic,
    cb,
  };

  if (!propertyCallback[propOutputTopic]) {
    propertyCallback[propOutputTopic] = {};
    propertyCallback[propOutputTopic][name] = cb;
    subscribe(propOutputTopic, cb);
  } else if (propertyCallback[propOutputTopic] && !propertyCallback[propOutputTopic][name]) {
    propertyCallback[propOutputTopic][name] = cb;
  }
  return Promise.resolve(propOutputTopic);
};

export default {
  connect,
  disconnect,
  updateToken,
  subscribe,
  unsubscribe,
  sendMessage,
  openCloudMonitor,
  writeCloudMonitor,
  closeCloudMonitor,
  sendProperty,
  sendPropertyAsDevice,
  onPropertyValue,
  getCborValue,
  getSenml,
  ArduinoCloudError,
};
