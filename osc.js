/*****************************************************************************/
/* OSC controller                                                            */
/*****************************************************************************/

import * as osc from 'node-osc';
import { devices } from './config.js';
import { devicesByName, setDeviceState, triggerScene } from './app.js';
import { e131Parameters, setE131Parameter } from './e131.js';

const CONTROLLER_FORGET_MS = 60*60*1000;

// XXX changed from 7000 to 7009 to make it stop restarting so I can sleep
var oscServer = new osc.Server(7009, '0.0.0.0', () => {
  console.log('OSC Server is listening');
});

// Log messages for debugging
oscServer.on('message', function (msg, rinfo) {
  console.log(`Message: ${msg.join(' ')}`);
});

// map from 'host:port' to { client, lastSeen }
let knownControllers = {};

function greetController(rinfo) {
  let now = new Date;
  let address = rinfo.address;
  let port = 9000; // iOS sends the listen port, but not android, so hardcode it
  let key = `${address}:${port}`;

  let controller = knownControllers[key];
  if (! controller) {
    controller = {
      client: new osc.Client(address, port),
      lastSeen: null
    };
    knownControllers[key] = controller;
  }

  if (! controller.lastSeen || (now - controller.lastSeen > CONTROLLER_FORGET_MS)) {
    // Send full state update to new (or returning) controller
    for (let parameter in e131Parameters) {
      controller.client.send(parameter, e131Parameters[parameter]);
    }
    devices.forEach((device) => {
      if (device.on !== null) {
        console.log(`${device.name} is ${device.on ? "on" : "off"}`);
        controller.client.send(`/dev/${device.name}`, device.on ? 1 : 0);
      }
    });
  }

  controller.lastSeen = now;
}

export function sendToActiveControllers(...payload) {
  let now = new Date;

  for (let key in knownControllers) {
    let controller = knownControllers[key];
    if (now - controller.lastSeen <= CONTROLLER_FORGET_MS) {
      controller.client.send(...payload);
    }
  }
}

oscServer.on('message', async function (msg, rinfo) {
  greetController(rinfo);

  if (msg[0] in e131Parameters) {
    console.log(`set ${msg[0]} to ${msg[1]}`);
    setE131Parameter(msg[0], msg[1]);
    return;
  }

  let path = msg[0].split('/');
  if (path[1] === 'dev') {
    let device = devicesByName[path[2]];
    if (! device) {
      console.log(`unknown device ${path[2]}`);
      return;
    }
    await setDeviceState(device, ! device.on);
  } else if (path[1] === 'scene' || path[1] === 'action') {
    if (msg[1] === 1)
      await triggerScene(path[2]);
  } else if (path[1] === 'page') {
    // ignore page switch
  } else {
    console.log(`unknown path ${msg[0]}`);
  }
});


