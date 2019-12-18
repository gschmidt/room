var e131 = require('e131');
var rgb = require('hsv-rgb')

var client = new e131.Client('10.1.1.84');  // or use a universe

var channelsPerPixel = 4;
var pixelsPerSide = 60*3;
var sidesPerRafter = 2;
var numRafters = 1;

var totalPixels = pixelsPerSide * sidesPerRafter * numRafters;
var totalChannels = totalPixels * channelsPerPixel;
var channelsPerUniverse = 510;
var buf = Buffer.alloc(totalChannels);
var startUniverse = 1;
var thisUniverse = startUniverse;
var packets = [];
for (var i = 0; i < totalChannels; ) {
  var theseChannels = Math.min(totalChannels - i, channelsPerUniverse);
  var p = client.createPacket(theseChannels);
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
      client.send(p, sendNextPacket);
    }
  }

  sendNextPacket();
}

var start = new Date;
var lastTime = start;
let hueCenter = 0;

let defaults = {
  saturation: .75,
  brightness: .5,
  hueWidth: .5,
  speed: 30,
  warm: .1
};

let modeInfo = [
  {
    top: "color",
    bottom: "color"
  },
  {
    top: "color",
    bottom: "warm"
  },
  {
    top: "off",
    bottom: "warm"
  },
  {
    top: "warm",
    bottom: "off"
  },
  {
    brightness: 1,
    saturation: 0,
    top: "color",
    bottom: "color"
  },
  {
    brightness: .5,
    saturation: 0,
    top: "color",
    bottom: "color"
  },
  {
    brightness: 1,
    saturation: 0,
    top: "color",
    bottom: "off"
  },
  { top: "color", bottom: "warm", warm: .05 },
  { top: "color", bottom: "warm", warm: .1 },
  { top: "color", bottom: "warm", warm: .25 },
  { top: "color", bottom: "warm", warm: .5 },
  { top: "color", bottom: "warm", warm: .75 },
  { top: "color", bottom: "warm", warm: 1 }
];
let ledMode = 0;
let ledModes = modeInfo.length;
let ledsOn = false;

function cycleColor() {
  let params = {};
  Object.assign(params, defaults);
  Object.assign(params, modeInfo[ledMode]);

  var now = new Date;
  var t = (now - start) / 1000;
  hueCenter = (hueCenter + (now - lastTime) / 1000 / params.speed) % 1.0;
  lastTime = now;

  var hueStart = hueCenter - params.hueWidth / 2 + 1.0;
  var hueEnd = hueCenter + params.hueWidth / 2 + 1.0;
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
    var x = rgb(((hueStart + pixel * hueStep) % 1) * 360,
      params.saturation * 100,
      params.brightness * 100);

    let style = params[side ? "top" : "bottom"];
    if (style !== "color" || ! ledsOn)
      x = [0, 0, 0];

    buf[idx + 0] = x[1]; // green
    buf[idx + 1] = x[0]; // red
    buf[idx + 2] = x[2]; // blue
    buf[idx + 3] = (style === "warm" && ledsOn) ? params.warm * 255 : 0; // warm white
  }

  sendPackets(buf, function () {
    setTimeout(cycleColor, 1000/40);
  });
}
cycleColor();


const rpi433 = require("rpi-433");
const rfSniffer = rpi433.sniffer({
  pin: 2,
  debounceDelay: 100
});

const rfEmitter = rpi433.emitter({
  pin: 29,
  pulseLength: 180
  });

rfSniffer.on("data", function(data) {
   console.log(
    "Code received: " + data.code + " pulse length : " + data.pulseLength
   );
   let command = data.code & 0xF;
   if (command !== 0x3 && command !== 0xC)
    return;
   let isOn = (command === 0x3);

   let address = data.code >> 4;
   if (address === zapAddress(GEOFF_REMOTE_ID, 4)) {
    console.log("bottom button " + (isOn ? "on" : "off"));
    if (isOn) {
      if (! ledsOn) {
        ledsOn = true;
      } else {
        ledMode = (ledMode + 1) % ledModes;
      }
    } else {
      ledsOn = false;
    }

    // To send codes, we should wait until there's been nothing received for a
    // period of time (say 50ms) to avoid interference
//    for (let i = 0; i < 1; i ++)
//      setOutletState(zapAddress(GEOFF_REMOTE_ID, i), isOn);
   }
});

let GEOFF_REMOTE_ID = 12;
let GEOFF_ROOM = 0;

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


function setOutletState(address, shouldBeOn) {
  let code = (address << 4) + (shouldBeOn ? 0x3 : 0xC);
  rfEmitter.sendCode(code);
}




//const rfEventMap = {};
//rfEventMap['']

console.log("Geoff room codes:");
for (let i = 0; i < 5; i ++) {
  console.log(monumentAddress(GEOFF_ROOM, i));
}

