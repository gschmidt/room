/*****************************************************************************/
/* Helpers                                                                   */
/*****************************************************************************/

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*****************************************************************************/
/* RF device control                                                         */
/*****************************************************************************/

import { default as rpi433 } from 'rpi-433';

const rfSniffer = rpi433.sniffer({
  pin: 2,
  debounceDelay: 100
});

const rfEmitter = rpi433.emitter({
  pin: 29,
  pulseLength: 180
  });

rfSniffer.on("data", function (data) {
  console.log(
    "Code received: " + data.code + " pulse length : " + data.pulseLength
  );
  let command = data.code & 0xF;
  if (command !== 0x3 && command !== 0xC)
    return;
  let isOn = (command === 0x3);
  let address = data.code >> 4;

  // Compare address to the return value of zapAddress to detect a pressed button, eg:
  // if (address === zapAddress(GEOFF_REMOTE_ID, 4)) { if (isOn) { ... } }

  // To send codes, we should wait until there's been nothing received for a
  // period of time (say 50ms) to avoid interference
});

let GEOFF_REMOTE_ID = 12;

// remoteId is 0..31 (based on the 5 bit address soldered into the remote)
// Pads soldered to ground are a 0, floating (unsoldered) pads are a 1
// 
// button is 0..4 (the five buttons, top to bottom)
function zapAddress(remoteId, button) {
  var parts = [];

  for (let bit = 4; bit >= 0; bit--) {
    parts.push(remoteId & (1 << bit) ? "01" : "00");
  }

  for (let i = 4; i >= 0; i--) {
    if (i === button)
      parts.push("11");
    else
      parts.push(i > 1 ? "01" : "00");
  }

  return parseInt(parts.join(''), 2);
}

function monumentAddress(room, device) {
  // The encoder chip used inside the Zap devices can't generate codes that start
  // with 10. Start with 10101010 for good measure, then allow an 8-bit room code and
  // and an 8-bit device code.
  return (0xAA << 16) + (room << 8) + device;
}

async function setOutletState(address, shouldBeOn) {
  let code = (address << 4) + (shouldBeOn ? 0x3 : 0xC);
  console.log(`send ${code}`)
  for (let i = 0; i < 3; i ++) {
    rfEmitter.sendCode(code);
    await sleep(50);
  }
  await sleep(500);
}

/*
let GEOFF_ROOM = 0;
console.log("Geoff room codes:");
for (let i = 0; i < 5; i ++) {
  console.log(monumentAddress(GEOFF_ROOM, i));
}
*/

/*****************************************************************************/
/* IR device control via Logitech Harmony Hub                                */
/*****************************************************************************/

import { default as HarmonyDiscover } from '@harmonyhub/discover';
import { default as HarmonyClient } from '@harmonyhub/client-ws';
const Explorer = HarmonyDiscover.Explorer;

const HARMONY_HUB_UUID = 'e241ba2931d5c66d7a3696d18c50e6bf351d0330';
let harmonyClient = null;

const harmonyDiscover = new Explorer(61991);

harmonyDiscover.on('online', async function(hub) {
  if (hub.uuid === HARMONY_HUB_UUID) {
    harmonyClient = await HarmonyClient.getHarmonyClient(hub.ip);
    const commands = await harmonyClient.getAvailableCommands();
    commands.device.forEach((device) => {
      const actions = [];
      device.controlGroup.forEach((controlGroup) => {
        const name = controlGroup.name;
        controlGroup.function.forEach((func) => {
          actions.push(func.name);
        });
      });
      console.log(`Detected Harmony device: ${device.id} (${device.label}), ${actions.length} actions`);
//      console.log(`Actions: ${actions.join(',' )}`);
    });
  } else {
    console.log(`Detected unknown Harmony hub: ${hub.uuid}`);
  }
    
});
harmonyDiscover.start();

async function sendHarmonyAction(deviceId, action) {
  if (! harmonyClient) {
    // if this is actually a problem, add a queue
    console.log(`ignoring Harmony action '${deviceId} ${action}' (not yet connected to hub)`);
    return;
  }
  console.log(`'${deviceId} ${action}'`);
  const result = await harmonyClient.send('holdAction', {
    command: action,
    deviceId: deviceId
  });
}

/*****************************************************************************/
/* OSC controller                                                            */
/*****************************************************************************/

import * as osc from 'node-osc';
import { default as rp } from 'request-promise';

const CONTROLLER_FORGET_MS = 5000;

var oscServer = new osc.Server(7000, '0.0.0.0', () => {
  console.log('OSC Server is listening');
});

// Log messages for debugging
oscServer.on('message', function (msg, rinfo) {
  console.log(`Message: ${msg.join(' ')}`);
});

let devices = [
  {
    name: 'edison',
    on: null,
    type: 'kasa',
    macAddress: 'B0:95:75:45:33:C4'
  },
  {
    name: 'lamp',
    on: null,
    type: 'kasa',
    macAddress: 'B0:95:75:45:34:D4'
  },
  {
    name: 'bed',
    on: null,
    type: 'kasa',
    macAddress: 'B0:95:75:45:38:8D'
  },
  {
    name: 'closet',
    on: null,
    type: 'kasa',
    macAddress: 'B0:95:75:45:11:1E'
  },
  {
    name: 'cam-lights',
    on: null,
    type: 'kasa',
    macAddress: '1C:3B:F3:2D:9D:CA'
  },
  {
    name: 'trippy-light',
    on: null,
    type: 'harmony',
    deviceId: 70319669,
    onActions: ['PowerOn', 'Light8'],
    offActions: ['PowerOff']
  },
  {
    name: 'projector',
    on: null,
    type: 'harmony',
    deviceId: 70319710,
    onActions: ['PowerOn'],
    offActions: ['PowerOff', 1000, 'PowerOff', 1000, 'PowerOff']
  },
  {
    name: 'receiver',
    on: null,
    type: 'harmony',
    deviceId: 70319765,
    onActions: ['PowerOn', 'InputDvd/Blu-ray'],
    offActions: ['PowerOff']
  },
  {
    name: 'sand-table',
    on: null,
    type: 'func',
    getFunc: async () => {
      console.log("get table state");
      let body = await rp.post({
        url: `http://sisyphus.local/sisbot/state`,
        form: { data: '{}' },
      });

      let state = JSON.parse(body);
      let sisbot = null;
      state.resp.forEach((item) => {
        if (item.type === "sisbot") {
          sisbot = item;
        }
      });
      return sisbot.is_sleeping === "false"; // note: this is a string, not a boolean!
    },
    setFunc: async (isOn) => {
      let endpoint = isOn ? "wake_sisbot" : "sleep_sisbot";

      await rp.post({
        url: `http://sisyphus.local/sisbot/${endpoint}`,
        form: { data: '{}' },
      });
    }
  },
];

let devicesByName = {};
devices.forEach(async (device) => {
  devicesByName[device.name] = device;
  if (device.type === 'func' && device.getFunc) {
    device.on = await device.getFunc();
  }
});

let oscParameters = {
  '/rafters/warm/brightness': 0,
  '/rafters/warm/top': 0,
  '/rafters/warm/bottom': 0,
  '/rafters/work/brightness': 0,
  '/rafters/work/top': 0,
  '/rafters/work/bottom': 0,
  '/rafters/pattern/brightness': 0,
  '/rafters/pattern/top': 0,
  '/rafters/pattern/bottom': 0,
  '/pattern/speed': .3,
  '/pattern/width': .5,
  '/pattern/p1': .75,
  '/pattern/p2': 0  
};

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
    console.log(`hello ${key}`);
    controller.client.send(`/rafters/warm/brightness`, 0.25);
    controller.client.send(`/dev/edison`, true);
    for (let parameter in oscParameters) {
      controller.client.send(parameter, oscParameters[parameter]);
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

function sendToActiveControllers(...payload) {
  let now = new Date;

  for (let key in knownControllers) {
    let controller = knownControllers[key];
    if (now - controller.lastSeen <= CONTROLLER_FORGET_MS) {
      controller.client.send(...payload);
    }
  }
}

function setOscParameter(name, value) {
  let changedParameters = [];

  if (! (name in oscParameters)) {
    console.log(`no such parameter ${name}`);
    return;
  }

  function changeParameter(setName, setValue) {
    oscParameters[setName] = setValue;
    sendToActiveControllers(setName, setValue);
  }
  changeParameter(name, value);

  ['warm', 'work', 'pattern'].forEach((input) => {
    /*
    if (name === `/rafters/${input}/brightness` && value === 0) {
      // If brightness was taken down to zero, turn off both rafter side toggles.
      changeParameter(`/rafters/${input}/top`, 0);
      changeParameter(`/rafters/${input}/bottom`, 0);
    }
    */

    if (name === `/rafters/${input}/brightness` && value > 0) {
      // If brightness was taken above zero, but no rafter side was selected, turn on both.
      if (! oscParameters[`/rafters/${input}/top`] &&
          ! oscParameters[`/rafters/${input}/bottom`]) {
        changeParameter(`/rafters/${input}/top`, 1);
        changeParameter(`/rafters/${input}/bottom`, 1);
      }
    }
  });

  sendToActiveControllers(name, value);
}

async function setDeviceState(device, on) {
  device.on = on;
  sendToActiveControllers(`/dev/${device.name}`, device.on ? 1 : 0);

  if (device.type === 'zap') {
    await setOutletState(device.zapAddress, on);
  } else if (device.type === 'kasa') {
    await setKasaState(device.macAddress, on);
  } else if (device.type === 'harmony') {
    let actions = on ? device.onActions : device.offActions;
    for (let i = 0; i < actions.length; i ++) {
      if (typeof actions[i] === 'number')
        await sleep(actions[i]);
      else
        await sendHarmonyAction(device.deviceId, actions[i]);
    }
  } else if (device.type === 'func') {
    await device.setFunc(on);
  } else {
    console.log("don't know how to control device")
  }
}

let scenes = {
  'all-lights-on': {    
    edison: true,
    lamp: true,
    bed: true,
    closet: true,
    'trippy-light': true,
  },
  'all-lights-off': {    
    edison: false,
    lamp: false,
    bed: false,
    closet: false,
    'trippy-light': false,
  },
  wake: {
    edison: true,
    lamp: true,
    bed: true,
    closet: true,
    'trippy-light': true,
    projector: false,
    '/rafters/warm/brightness': .25,
    '/rafters/warm/top': 1,
    '/rafters/warm/bottom': 0,
    '/rafters/work/brightness': .25,
    '/rafters/work/top': 1,
    '/rafters/work/bottom': 0,
    '/rafters/pattern/brightness': 0
    },
  bed: {
    edison: false,
    lamp: false,
    bed: true,
    closet: false,
    'cam-lights': false,
    'trippy-light': false,
    'sand-table': false,
    projector: false,
    '/rafters/warm/brightness': 0,
    '/rafters/work/brightness': 0,
    '/rafters/pattern/brightness': 0
  },
  sleep: {
    edison: false,
    lamp: false,
    bed: false,
    closet: false,
    'cam-lights': false,
    'trippy-light': false,
    'sand-table': false,
    projector: false,
    '/rafters/warm/brightness': 0,
    '/rafters/work/brightness': 0,
    '/rafters/pattern/brightness': 0
  },
  chill: {
    edison: true,
    lamp: true,
    bed: true,
    closet: true,
    'cam-lights': false,
    'trippy-light': true,
    projector: false,
    '/rafters/warm/brightness': .01,
    '/rafters/warm/top': 1,
    '/rafters/warm/bottom': 0,
    '/rafters/work/brightness': 0,
    '/rafters/pattern/brightness': 0
  },
  pattern: {
    edison: false,
    lamp: false,
    bed: false,
    closet: false,
    'cam-lights': false,
    'trippy-light': false,
    '/rafters/warm/brightness': 0,
    '/rafters/work/brightness': 0,
    '/rafters/pattern/brightness': .15,
    '/pattern/speed': .25,
    '/pattern/width': .9,
    '/pattern/p1': .9
  },
  movie: {
    edison: false,
    lamp: false,
    bed: false,
    closet: false,
    'cam-lights': false,
    'trippy-light': false,
    'sand-table': false,
    projector: true,
    receiver: true,
    '/rafters/warm/brightness': 0,
    '/rafters/work/brightness': 0,
    '/rafters/pattern/brightness': 0
  },
};

async function triggerScene(sceneName) {
  let scene = scenes[sceneName];
  if (! scene) {
    console.log(`unknown scene ${sceneName}`);
    return;
  }
  for (let key in scene) {
    let device = devicesByName[key];
    if (device) {
      /* await */ setDeviceState(device, scene[key]);
    } else if (key in oscParameters) {
      setOscParameter(key, scene[key]);
    } else {
      console.log(`unknown key ${key} in scene ${sceneName}`);
    }
  }
}

oscServer.on('message', async function (msg, rinfo) {
  greetController(rinfo);

  if (msg[0] in oscParameters) {
    console.log(`set ${msg[0]} to ${msg[1]}`);
    setOscParameter(msg[0], msg[1]);
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

/*****************************************************************************/
/* TP-Link Kasa device control                                               */
/*****************************************************************************/

import { default as kasa } from 'tplink-smarthome-api';

const kasaClient = new kasa.Client();

// XXX should probably re-scan periodically in case devices change IP
kasaClient.startDiscovery().on('device-new', async (kasaDevice) => {
  let info = await kasaDevice.getSysInfo();
  console.log(`Detected Kasa device: ${info.mac} (${info.alias}) ` +
    `– ${info.relay_state ? 'on' : 'off'}`);

  devices.forEach((device) => {
    if (device.type === 'kasa' && device.macAddress === info.mac) {
      device.on = !! info.relay_state;
      device.kasaDevice = kasaDevice;
    }
  });
});

function getDeviceByMac(macAddress) {
  for (let i = 0; i < devices.length; i ++) {
    if (devices[i].type === 'kasa' && devices[i].macAddress === macAddress)
      return devices[i];;
  }

  return null;
}

async function setKasaState(macAddress, isOn) {
  let device = getDeviceByMac(macAddress);
  if (! device) {
    console.log(`Kasa device not found – ${macAddress}`);
  }

  device.kasaDevice.setPowerState(isOn);
}

/*****************************************************************************/
/* E131 LED control and pattern generation                                   */
/*****************************************************************************/

import { default as e131 } from 'e131';
import { default as rgb } from 'hsv-rgb';

var e131Client = new e131.Client('geoff-f48.int.monument.house');  // or use a universe

var channelsPerPixel = 4;
var pixelsPerSide = 60*3;
var sidesPerRafter = 2;
var numRafters = 8;

var totalPixels = pixelsPerSide * sidesPerRafter * numRafters;
var totalChannels = totalPixels * channelsPerPixel;
var channelsPerUniverse = 510;
var buf = Buffer.alloc(totalChannels);
var startUniverse = 1;
var thisUniverse = startUniverse;
var packets = [];
for (var i = 0; i < totalChannels; ) {
  var theseChannels = Math.min(totalChannels - i, channelsPerUniverse);
  var p = e131Client.createPacket(theseChannels);
  p.setSourceName('lights');
  p.setUniverse(thisUniverse);
  p.setPriority(p.DEFAULT_PRIORITY);  // not strictly needed, done automatically
  packets.push(p);
  i += theseChannels;
  thisUniverse ++;
}

function sendPackets(b, cb) {
  var i = 0;
  var pos = 0;

  function sendNextPacket() {
    if (i === packets.length) {
      cb();
    } else {
      var p = packets[i];
      i += 1;
      var slotsData = p.getSlotsData();
      b.copy(slotsData, 0, pos);
      pos += slotsData.length;
      e131Client.send(p, sendNextPacket);
    }
  }

  sendNextPacket();
}

var start = new Date;
var lastTime = start;
let hueCenter = 0;

let framesPerSecond = 40;
let frame = 0;

function cycleColor() {
  let patternSpeed = oscParameters['/pattern/speed'];
  let patternWidth = oscParameters['/pattern/width'];

  var now = new Date;
  var t = (now - start) / 1000;
  hueCenter = (hueCenter + (now - lastTime) / 1000 * patternSpeed / 4.0) % 1.0;
  lastTime = now;
  frame ++;

  var hueStart = hueCenter - patternWidth / 2 + 1.0;
  var hueEnd = hueCenter + patternWidth / 2 + 1.0;
  var hueStep = (hueEnd - hueStart) / 240;

  var pixel = -1;
  var side = 0;
  var rafter = 0;
  
  for (var idx = 0; idx < totalChannels; idx += channelsPerPixel) {
    pixel++;
    if (pixel === pixelsPerSide) {
      pixel = 0;
      side++;
      if (side === sidesPerRafter) {
        side = 0;
        rafter++;
      }
    }

    let rgbw = [0, 0, 0, 0];

    let patternIsOn = !! oscParameters[`/rafters/pattern/${side ? "top" : "bottom"}`];
    if (patternIsOn) {
      let saturation = oscParameters['/pattern/p1'];
      let pattern = rgb(((hueStart + pixel * hueStep) % 1) * 360,
        saturation * 100,
        oscParameters['/rafters/pattern/brightness'] * 100);
      rgbw[0] += pattern[0];
      rgbw[1] += pattern[1];
      rgbw[2] += pattern[2];
    }

    let warmIsOn = !! oscParameters[`/rafters/warm/${side ? "top" : "bottom"}`];
    if (warmIsOn) {
      rgbw[3] += oscParameters['/rafters/warm/brightness'] * 255;
    }

    let workIsOn = !! oscParameters[`/rafters/work/${side ? "top" : "bottom"}`];
    if (workIsOn) {
      let amount = oscParameters['/rafters/work/brightness'] * 255;
      rgbw[0] += amount;
      rgbw[1] += amount;
      rgbw[2] += amount;
    }

    buf[idx + 0] = Math.min(rgbw[1], 255); // green
    buf[idx + 1] = Math.min(rgbw[0], 255); // red
    buf[idx + 2] = Math.min(rgbw[2], 255); // blue
    buf[idx + 3] = Math.min(rgbw[3], 255); // warm white
  }

  sendPackets(buf, function () {
    let now = new Date;
    let msSinceStart = (now - start);
    let msPerFrame = 1000.0 / framesPerSecond;
    let msUntilNextFrame =
      (Math.floor(msSinceStart / msPerFrame) + 1) * msPerFrame - msSinceStart;
    setTimeout(cycleColor, msUntilNextFrame);
  });
}
cycleColor();

/*****************************************************************************/
/* Alexa interface                                                           */
/*****************************************************************************/

import { default as Alexa } from 'ask-sdk-core';
import { default as express} from 'express';
import { default as AskSdkExpressAdapter } from 'ask-sdk-express-adapter';
let ExpressAdapter = AskSdkExpressAdapter.ExpressAdapter;

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'Welcome to the Alexa Skills Kit, you can say hello!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse();
  }
};

const HelloWorldIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'HelloWorldIntent';
  },
  handle(handlerInput) {
    const speechText = 'Hello World!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'You can say hello to me!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = 'Goodbye!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hello World', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    //any cleanup logic goes here
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};


const app = express();
const skillBuilder = Alexa.SkillBuilders.custom();
skillBuilder.addRequestHandlers(
  LaunchRequestHandler,
  HelloWorldIntentHandler,
  HelpIntentHandler,
  CancelAndStopIntentHandler,
  SessionEndedRequestHandler
);
skillBuilder.addErrorHandlers(ErrorHandler);
const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

app.post('/', adapter.getRequestHandlers());
app.listen(12000);

/*****************************************************************************/

