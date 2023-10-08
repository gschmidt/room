/*****************************************************************************/
/* Helpers                                                                   */
/*****************************************************************************/

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*****************************************************************************/
/* IR device control via Logitech Harmony Hub                                */
/*****************************************************************************/

import { default as HarmonyClient } from '@harmonyhub/client-ws';

// For the record, our Harmony Hub UUID is:
//   e241ba2931d5c66d7a3696d18c50e6bf351d0330
// But now we find it via DHCP IP binding (to its MAC) rather than
// though broadcast discovery, which isn't easy from Docker containers.
const HARMONY_HUB_HOSTNAME = 'hub.harmony.geoffschmidt.com';

async function connectToHarmonyHub(hostname) {
  const client = await HarmonyClient.getHarmonyClient(hostname);
  const commands = await client.getAvailableCommands();
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

  return client;
};

// Perhaps be robust to failing to connect to the Harmony Hub?
let harmonyClient = await connectToHarmonyHub(HARMONY_HUB_HOSTNAME);

async function sendHarmonyAction(deviceId, action) {
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

const CONTROLLER_FORGET_MS = 60*60*1000;

// XXX changed from 7000 to 7009 to make it stop restarting so I can sleep
var oscServer = new osc.Server(7009, '0.0.0.0', () => {
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
//    macAddress: 'B0:95:75:45:33:C4',
    host: 'edison-bulbs.kasa.geoffschmidt.com'
  },
  {
    name: 'lamp',
    on: null,
    type: 'kasa',
//    macAddress: 'B0:95:75:45:34:D4',
    host: 'lamp.kasa.geoffschmidt.com'
  },
  {
    name: 'bed',
    on: null,
    type: 'kasa',
//    macAddress: 'B0:95:75:45:38:8D',
    host: 'bed.kasa.geoffschmidt.com'
  },
  {
    name: 'closet',
    on: null,
    type: 'kasa',
//    macAddress: 'B0:95:75:45:11:1E'
    host: 'closet.kasa.geoffschmidt.com'
  },
  {
    // Used to be videoconferencing lights at desk, but is now Turkish lamp
    // Can't rename it without updating the TouchOSC config so save for later
    name: 'cam-lights',
    on: null,
    type: 'kasa',
//    macAddress: '1C:3B:F3:2D:9D:CA',
    host: 'turkish-lamp.kasa.geoffschmidt.com'
  },
  {
    // Left side wall switch. For switching only - not connected to a load
    name: '207l-switch',
    on: null,
    type: 'kasa',
//    macAddress: 'D8:07:B6:F7:EF:82',
    host: '207-left.kasa.geoffschmidt.com',
    switchBehavior: {
      type: 'one-button-scene-switch',
      sceneList: ['pattern', 'work-lights'],
      selectionTime: 2000,
      offScene: 'rafters-off'
    }
  },
  {
    // Right side wall switch. For switching only - not connected to a load
    name: '207r-switch',
    on: null,
    type: 'kasa',
//    macAddress: 'D8:07:B6:BF:88:AB',
    host: '207-right.kasa.geoffschmidt.com',
    switchBehavior: {
      type: 'toggle-switch',
      onScene: 'lamps-on',
      offScene: 'lamps-off',
    }
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
      let body;
      try {
        body = await rp.post({
          url: `http://sisyphus.geoffschmidt.com/sisbot/state`,
          form: { data: '{}' },
        });
      } catch (e) {
        console.log(`can't get table state: ${e}`);
        return null
      }

      let state = JSON.parse(body);
      let sisbot = null;
      state.resp.forEach((item) => {
        if (item.type === "sisbot") {
          sisbot = item;
        }
      });
      const isOn = sisbot.is_sleeping === "false"; // note: this is a string, not a boolean!
      console.log(`table state is ${isOn ? "on": "off"}`);
      return isOn;
    },
    setFunc: async (isOn) => {
      let endpoint = isOn ? "wake_sisbot" : "sleep_sisbot";

      try {
        await rp.post({
          url: `http://sisyphus.geoffschmidt.com/sisbot/${endpoint}`,
          form: { data: '{}' },
        });
      } catch (e) {
        console.log(`Can't set table state: ${e}`);
      }
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
  '/rafters/pattern/brightness': 1, // XXX
  '/rafters/pattern/top': 1, // XXX
  '/rafters/pattern/bottom': 1, // XXX
  '/pattern/speed': .3,
  '/pattern/width': .5,
  '/pattern/p1': 1,
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

async function noteDeviceState(device, on) {
  let changedState = (device.on !== on);
  device.on = on;
  sendToActiveControllers(`/dev/${device.name}`, device.on ? 1 : 0);

  if (device.switchBehavior && changedState) {
    let behavior = device.switchBehavior;

    if (behavior.type === 'toggle-switch') {
      triggerScene(device.on ? behavior.onScene : behavior.offScene);
    } else if (behavior.type === 'one-button-scene-switch') {
      if (! behavior._lastPushTime) {
        behavior._lastPushTime = 0;
        behavior._selectedIndex = null;
        behavior._cleanupTimer = null;
        behavior._transitioningToState = null;
      }

      // Don't let our own state changes, echoed back to us, count as user presses
      if (behavior._transitioningToState !== null) {
        if (behavior._transitioningToState === device.on) {
          // Have now reached target state - future changes are real pushes
          behavior._transitioningToState = null;
        }
        return;
      }

      if (behavior._cleanupTimer === null) {
        // It's been a while since the last push. Treat this as an on/off event.
        if (behavior._selectedIndex === null)
          behavior._selectedIndex = 0; // On - select first scene
        else
          behavior._selectedIndex = null; // Off
      } else {
        // Multiple pushes quickly. Select the next scene. (Or the first if
        // we were previously in the off state, or 'off' if at the last scene.)
        behavior._selectedIndex =
          (behavior._selectedIndex === null ? 0 : behavior._selectedIndex + 1);
        if (behavior._selectedIndex === behavior.sceneList.length)
          behavior._selectedIndex = null;
      }

      console.log(`select index ${behavior._selectedIndex}`);
      if (behavior._selectedIndex === null)
        await triggerScene(behavior.offScene);
      else
        await triggerScene(behavior.sceneList[behavior._selectedIndex]);
      behavior._lastPushTime = (+ new Date);

      if (behavior._cleanupTimer)
        clearTimeout(behavior._cleanupTimer);
      behavior._cleanupTimer = setTimeout(() => {
        behavior._cleanupTimer = null; // exit selection mode
        // Make the device be in an "on" state, so that if it has a
        // "nightlight" that lights up when it is off, it isn't lit.
        if (! device.on) {
          // Stop this from registering as a user switch press by ignoring all state
          // changes until we see the effect of the change we're about to make (we can't
          // just set device.on to true because we might observe a 'false' poll before we
          // see the result of our change)
          behavior._transitioningToState = true;
          /* await */ setDeviceState(device, true, { updateHardwareOnly: true });
        }
      }, behavior.selectionTime);
    } else {
      throw new Error(`unknown switch behavor '${behavior.type}'`);
    }
  }
}

async function setDeviceState(device, on, options) {
  if (! options || ! options.updateHardwareOnly)
    await noteDeviceState(device, on);

  if (device.type === 'kasa') {
    if (! device.kasaDevice)
      console.log(`Ignoring offline Kasa device – ${device.name}`);
    else
      device.kasaDevice.setPowerState(on);
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
    '207r-switch': true,
    edison: true,
    lamp: true,
    bed: true,
    closet: true,
    'cam-lights': true,
    'trippy-light': true,
  },
  'all-lights-off': {    
    '207r-switch': false,
    edison: false,
    lamp: false,
    bed: false,
    closet: false,
    'trippy-light': false,
  },
  'alexa-lights-out': {
    _alexa: [ { TurnOffLightsIntent: {} }],
    '207r-switch': false,
    edison: false,
    lamp: false,
    bed: false,
    closet: false,
    'cam-lights': false,
    'trippy-light': false,
    '/rafters/warm/top': 0,
    '/rafters/warm/bottom': 0,
    '/rafters/work/top': 0,
    '/rafters/work/bottom': 0,
    '/rafters/pattern/top': 0,
    '/rafters/pattern/bottom': 0
  },
  wake: {
    _alexa: [ { SceneIntent: { scene: 'morning' } }],
    '207r-switch': true,
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
    _alexa: [ { SceneIntent: { scene: 'bed' } }],
    '207r-switch': false,
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
    '207r-switch': false,
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
    _alexa: [ { SceneIntent: { scene: 'chill' } }],
    '207r-switch': true,
    edison: true,
    lamp: true,
    bed: true,
    closet: true,
    'cam-lights': true,
    'trippy-light': true,
    projector: false,
    '/rafters/warm/brightness': .01,
    '/rafters/warm/top': 1,
    '/rafters/warm/bottom': 0,
    '/rafters/work/brightness': 0,
    '/rafters/pattern/brightness': 0
  },
  'alexa-pattern': {
    _alexa: [ { SceneIntent: { scene: 'pattern' } }],
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
  // XXX add a way to 'include' one pattern in another so that I don't have
  // to repeat myself here
  // XXX maybe also allow the list of scenes for a switch to include multiple
  // scenes per switch position, or an inline scene (with includes), again
  // to reduce proliferation of scenes
  'pattern': {
    '/rafters/warm/brightness': 0,
    '/rafters/work/brightness': 0,
    '/rafters/pattern/brightness': .15,
    '/pattern/speed': .25,
    '/pattern/width': .9,
    '/pattern/p1': .9
  },
  movie: {
    _alexa: [ { SceneIntent: { scene: 'movie' } }],
    '207r-switch': false,
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
  'video-call': {
    _alexa: [ { VideoCallIntent: {} }],
    'cam-lights': true,
    'trippy-light': true,
    '/rafters/warm/brightness': .1,
    '/rafters/work/brightness': .2,
    '/rafters/pattern/brightness': 0
  },
  'work-lights': {
    '/rafters/warm/brightness': .5,
    '/rafters/warm/top': 1,
    '/rafters/warm/bottom': 1,
    '/rafters/work/brightness': .25,
    '/rafters/work/top': 1,
    '/rafters/work/bottom': 1,
    '/rafters/pattern/brightness': 0,
  },
  'lamps-on': {
    '207r-switch': true,
    edison: true,
    lamp: true,
    bed: true,
    closet: true,
    'cam-lights': true
  },
  'lamps-off': {
    '207r-switch': false,
    edison: false,
    lamp: false,
    bed: false,
    closet: false,
    'cam-lights': false
  },
  'rafters-off': {
    '/rafters/warm/top': 0,
    '/rafters/warm/bottom': 0,
    '/rafters/work/top': 0,
    '/rafters/work/bottom': 0,
    '/rafters/pattern/top': 0,
    '/rafters/pattern/bottom': 0
  },
  'end-video-call': {
//    _alexa: [ { EndVideoCallIntent: {} }],
    'cam-lights': false,
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
    } else if (key === '_alexa') {
      /* nothing */
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

const kasaClient = new kasa.Client({ /* logLevel: "debug" */ });

// XXX make it robust to these devices being temporarily offline?
devices.forEach(async function (device) {
  if (device.type === 'kasa') {
    const kasaDevice = await kasaClient.getDevice({ host: device.host });
    let info = await kasaDevice.getSysInfo();
    console.log(`Kasa device ${device.host} (${info.alias}) is ${info.relay_state ? 'on' : 'off'}`);
    device.on = !! info.relay_state;
    device.kasaDevice = kasaDevice;

    /*
    kasaDevice.on('power-on', () => {
      console.log('power-on', info.alias);
      sendToActiveControllers(`/dev/${device.name}`, 1);
    });
    kasaDevice.on('power-off', () => {
      console.log('power-off', info.alias);
      sendToActiveControllers(`/dev/${device.name}`, 0);
    });
    */
    kasaDevice.on('power-update', (powerOn) => {
      /* await */ noteDeviceState(device, powerOn);
    });
  }
});

/*****************************************************************************/
/* E131 LED control and pattern generation                                   */
/*****************************************************************************/

import { default as e131 } from 'e131';
import { default as rgb } from 'hsv-rgb';

// 10.2.0.2 is falcon48-room.geoffschmidt.com
// We hardcode the IP because if we don't, a bug somewhere causes a DNS
// lookup for each and every e131 packet sent. This is a "good enough" fix
var e131Client = new e131.Client('10.2.0.2');  // or use a universe

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
let isPaused = false;

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
  var anyOn = false;

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
      let pattern = rgb(((hueStart + pixel * hueStep + rafter/8.0) % 1) * 360,
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

    // Blank a few lights that are not working (flickering) and for which 
    // I don't have replacements on hand at the moment (until I can order
    // more or solder past the broken LED)
    if (rafter === 2 && side === 1 && pixel > 128)
      rgbw = [0, 0, 0, 0];

    buf[idx + 0] = Math.min(rgbw[1], 255); // green
    buf[idx + 1] = Math.min(rgbw[0], 255); // red
    buf[idx + 2] = Math.min(rgbw[2], 255); // blue
    buf[idx + 3] = Math.min(rgbw[3], 255); // warm white
    anyOn = anyOn || patternIsOn || warmIsOn || workIsOn;
  }

  // If we're not rendering any data onto the LEDs, render one final frame
  // (to leave the lights in the expected state) and then stop sending data.
  // This allows another process to control the lights.
  if (anyOn) {
    if (isPaused) {
      console.log("resuming LED rendering");
      isPaused = false;
    }
  } else {
    if (isPaused) {
      setTimeout(cycleColor, 1000.0 / framesPerSecond);
      return;
    } else {
      console.log("pausing LED rendering after this frame");
      isPaused = true;
    }
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

// To edit the interactions model, visit:
// https://developer.amazon.com/alexa/console/ask/build/custom/amzn1.ask.skill.83c4d275-dd84-421b-8e1a-7b549717880c/development/en_US/dashboard

import { default as Alexa } from 'ask-sdk-core';
import { default as express} from 'express';
import { default as AskSdkExpressAdapter } from 'ask-sdk-express-adapter';
let ExpressAdapter = AskSdkExpressAdapter.ExpressAdapter;

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'What do you need?';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('My Room', speechText)
      .getResponse();
  }
};

function findMatchingScene(intent, slots) {
  const sceneNames = Object.keys(scenes);

  for (let i = 0; i < sceneNames.length; i ++) {
    const sceneName = sceneNames[i];
    const scene = scenes[sceneName];
    if (! scene._alexa)
      continue;

    for (let j = 0; j < scene._alexa.length; j ++) {
      const rule = scene._alexa[j];
      const ruleKeys = Object.keys(rule);
      if (ruleKeys.length !== 1)
        throw new Error(`bad rule ${JSON.stringify(rule)} in scene ${sceneName}`);
      const ruleIntent = ruleKeys[0];
      const ruleSlots = rule[ruleIntent];
      if (ruleIntent !== intent)
        continue;
      
      const ruleSlotKeys = Object.keys(ruleSlots);
      let match = true;
      for (let k = 0; k < ruleSlotKeys.length; k ++ ) {
        const ruleSlotKey = ruleSlotKeys[k];
        if (slots[ruleSlotKey].value !== ruleSlots[ruleSlotKey])
          match = false;
      }

      if (match) {
        return sceneName;
      }
    }
  }

  return null;
}

const MainIntentHandler = {
  canHandle(handlerInput) {
    if (handlerInput.requestEnvelope.request.type !== 'IntentRequest')
      return false;
    const intent = handlerInput.requestEnvelope.request.intent.name;
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const sceneName = findMatchingScene(intent, slots);
    return !! sceneName;
  },
  handle(handlerInput) {
    const intent = handlerInput.requestEnvelope.request.intent.name;
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const sceneName = findMatchingScene(intent, slots);
    if (! sceneName)
      throw new Error(`no matching scene for ${intent} ${slots}`)
    triggerScene(sceneName);

    const speechText = '';
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('My Room', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = "Sorry, you're on your own!";

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('My Room', speechText)
      .withShouldEndSession(true)
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
    const speechText = 'As you wish!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('My Room', speechText)
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
      .speak('Not recognized')
      .withShouldEndSession(true)
      .getResponse();
  },
};

const LogRequestInterceptor = {
  process(handlerInput) {
    // Log Request
    console.log("==== REQUEST ======");
    console.log(JSON.stringify(handlerInput.requestEnvelope, null, 2));
  }
}

const LogResponseInterceptor = {
  process(handlerInput, response) {
    // Log Response
    console.log("==== RESPONSE ======");
    console.log(JSON.stringify(response, null, 2));
  }
}

const app = express();
const skillBuilder = Alexa.SkillBuilders.custom();
skillBuilder.addRequestHandlers(
  LaunchRequestHandler,
  MainIntentHandler,
  HelpIntentHandler,
  CancelAndStopIntentHandler,
  SessionEndedRequestHandler
);
skillBuilder.addErrorHandlers(ErrorHandler);
//skillBuilder.addRequestInterceptors(LogRequestInterceptor)
//skillBuilder.addResponseInterceptors(LogResponseInterceptor)
const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

app.post('/', adapter.getRequestHandlers());
app.listen(12000);

/*****************************************************************************/

