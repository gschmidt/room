/*****************************************************************************/
/* E131 LED control and pattern generation                                   */
/*****************************************************************************/

import { default as e131 } from 'e131';
import { default as rgb } from 'hsv-rgb';
import { sendToActiveControllers } from './osc.js';

export let e131Parameters = {
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

export function setE131Parameter(name, value) {
  let changedParameters = [];

  if (! (name in e131Parameters)) {
    console.log(`no such parameter ${name}`);
    return;
  }

  function changeParameter(setName, setValue) {
    e131Parameters[setName] = setValue;
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
      if (! e131Parameters[`/rafters/${input}/top`] &&
          ! e131Parameters[`/rafters/${input}/bottom`]) {
        changeParameter(`/rafters/${input}/top`, 1);
        changeParameter(`/rafters/${input}/bottom`, 1);
      }
    }
  });

  sendToActiveControllers(name, value);
}

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
  let patternSpeed = e131Parameters['/pattern/speed'];
  let patternWidth = e131Parameters['/pattern/width'];

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

    let patternIsOn = !! e131Parameters[`/rafters/pattern/${side ? "top" : "bottom"}`];
    if (patternIsOn) {
      let saturation = e131Parameters['/pattern/p1'];
      let pattern = rgb(((hueStart + pixel * hueStep + rafter/8.0) % 1) * 360,
        saturation * 100,
        e131Parameters['/rafters/pattern/brightness'] * 100);
      rgbw[0] += pattern[0];
      rgbw[1] += pattern[1];
      rgbw[2] += pattern[2];
    }

    let warmIsOn = !! e131Parameters[`/rafters/warm/${side ? "top" : "bottom"}`];
    if (warmIsOn) {
      rgbw[3] += e131Parameters['/rafters/warm/brightness'] * 255;
    }

    let workIsOn = !! e131Parameters[`/rafters/work/${side ? "top" : "bottom"}`];
    if (workIsOn) {
      let amount = e131Parameters['/rafters/work/brightness'] * 255;
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

export function launchE131() {
  cycleColor();
}
