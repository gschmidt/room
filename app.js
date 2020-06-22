import {default as e131} from 'e131';
import {default as rgb} from 'hsv-rgb';
import * as osc from 'node-osc';

var client = new e131.Client('10.1.1.84');  // or use a universe
var oscServer = new osc.Server(7000, '0.0.0.0', () => {
  console.log('OSC Server is listening');
});

oscServer.on('message', function (msg, rinfo) {
  console.log(`Message: ${msg.join('$')} ${JSON.stringify(rinfo)}`);
  let out = new osc.Client(rinfo.address, rinfo.port);
  out.send('/1/brightness', 0.25);
});

let edisonState = null;
oscServer.on('/1/edison', function (msg, rinfo) {
  edisonState = msg[1] ? true : false;
  setOutletState(zapAddress(GEOFF_REMOTE_ID, 0), edisonState);
});


oscServer.on('/1', function (msg, rinfo) {
  console.log("send state");
  let out = new osc.Client(rinfo.address, rinfo.port);
  if (edisonState !== null)
    out.send('/1/edison', edisonState);
});


{"err":null,"resp":{"id":"pi_00000000d8a86d57","type":"sisbot","pi_id":"pi_00000000d8a86d57","name":"Sisyphus","firmware_version":"1.0","software_version":"1.10.54","hostname":"Sisyphus.local","local_ip":"10.1.3.249","cson":"coffeetable36.cson","is_available":"true","installing_updates":"false","installing_updates_error":"","factory_resetting":"false","factory_resetting_error":"","do_not_remind":"true","hostname_prompt":"true","reason_unavailable":"false","fault_status":"false","state":"playing","is_rgbw":"false","brightness":0.8,"is_autodim":"true","is_nightlight":"false","nightlight_brightness":0.2,"speed":0.35,"is_shuffle":"true","is_loop":"true","is_paused_between_tracks":"false","is_waiting_between_tracks":"false","favorite_playlist_id":"052f9d2f-a8e0-43e9-868e-079caacd42fa","default_playlist_id":"F42695C4-AE32-4956-8C7D-0FF6A7E9D492","active_playlist_id":"F42695C4-AE32-4956-8C7D-0FF6A7E9D492","active_track":{"id":"38cb2dad-23d6-4c53-888f-88ee591a04d6","vel":1,"accel":0.5,"thvmax":1,"firstR":0,"lastR":1,"_index":24,"reversible":"true","name":"sola3","reversed":"true","start":0},"_end_rho":1,"repeat_current":"false","is_homed":"true","is_serial_open":"true","is_servo":"false","is_hotspot":"false","is_network_separate":"true","is_network_connected":"true","is_internet_connected":"true","service_connected":{"api":"true"},"is_sleeping":"false","sleep_time":"9:00 PM","wake_time":"8:00 AM","timezone_offset":"-07:00","wifi_network":"Monument","wifi_password":"bricksareheavy","wifi_forget":"false","wifi_error":"false","failed_to_connect_to_wifi":"false","is_multiball":"false","ball_count":1,"table_settings":{},"led_enabled":"false","led_pattern":"white","led_offset":0,"led_primary_color":"#409CFFFF","led_secondary_color":"false","share_log_files":"true","playlist_ids":["F42695C4-AE32-4956-8C7D-0FF6A7E9D492","452e628f-fe10-4858-9ed0-fc4b47b6d2e9","052f9d2f-a8e0-43e9-868e-079caacd42fa"],"track_ids":["2CBDAE96-EC22-48B4-A369-BFC624463C5F","C3D8BC17-E2E1-4D6D-A91F-80FBB65620B8","2B34822B-0A27-4398-AE19-23A3C83F1220","93A90B6B-EAEE-48A3-9742-C688235D837D","B7407A2F-04C3-4C92-B907-4C3869DA86D6","7C046710-9F19-4423-B291-7394996F0913","D14E0B41-E572-4B69-9827-4A07C503D031","26FBFB10-4BC7-46BF-8D55-85AA52C19ADF","75518177-0D28-4B2A-9B73-29E4974FB702","906de7a3-4769-4964-96cd-2bcf80bad2f5","b19a2909-a9f5-490b-9f9a-d990f5a77393","6796b5c5-0f4b-47e2-b871-f30d9e967d6b","bd89c7f7-d272-44dd-b80c-aa4c1ece36f2","c0f63e2f-e63d-4228-a8bc-6a29f92da50c","b33775f0-3abf-47f3-ba46-85e85a2bb0d4","db96d725-09b9-4c80-80ec-9c77658a74ac","45540bac-3422-4386-a804-2b185776d921","f1451810-ab23-4878-9b45-cca5cfb5b1e7","580c9f06-1c74-4e36-b4ab-b63a72d6399b","3872a018-f176-4661-b580-a988e0788299","103f52ff-fc00-4c41-9098-47f2e0a7e7a1","1f274aa7-6214-4172-b251-a5ac33d36184","e0a61484-35eb-4f40-9a0a-7f9d6ee58c37","3ae084de-cea3-4729-8bf8-0c6e43d47d49","6209824a-9860-4746-a374-d02091e9f808","77a9f396-f2a3-459b-8e0d-5da024eb13b6","cfca6c0c-0d04-4fbc-a78b-3d031fd6434f","19aa381c-5856-4e3c-8ee1-81f61d44d8ca","f36a4a58-07fb-4a7b-915f-916e6e5be06f","c136f436-6962-47e6-8cae-8f35294dbfff","3ab7f7b3-55a5-4055-b94f-e2e8fb4e5234","f7552c83-ba4d-4642-9373-a1a269522e0f","6a27135c-e93b-4925-9dd9-d138b42719f0","dcaeaee1-446a-4880-a942-32ef05edcd2a","4e718106-4005-4623-825c-9e3da30a2109","38cb2dad-23d6-4c53-888f-88ee591a04d6"],"installed_updates":"false","is_autodim_allowed":"true","history_id":"false","is_deleted":"false","is_saved":"false","created_at":"2019-09-17 14:54:05","updated_at":"2019-09-17 14:54:05","created_by_id":"false","trigger_point_ids":[],"version":1,"active_track_id":"false","current_time":0,"led_pattern_ids":["white","solid","fade","spread","comet","rainbow","paint","demo"],"update_status":"false","mac_address":"b8:27:eb:fd:38:02","is_sleep_enabled":"true","_is_autodim":"true","_brightness":0.8}}%      



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

let framesPerSecond = 40;
let frame = 0;

function cycleColor() {
  let params = {};
  Object.assign(params, defaults);
  Object.assign(params, modeInfo[ledMode]);

  var now = new Date;
  var t = (now - start) / 1000;
  hueCenter = (hueCenter + (now - lastTime) / 1000 / params.speed) % 1.0;
  lastTime = now;
  frame ++;

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

    // XXX
//    buf[idx + 0] = buf[idx + 1] = buf[idx + 2] = buf[idx + 3] = 
//      (Math.sin(t * 2 * Math.PI / 5) + 1) / 2 * 255;
//    if (frame % 2 == 0)
//      buf[idx + 0] = buf[idx + 1] = buf[idx + 2] = buf[idx + 3] = 255;
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


import {default as rpi433} from 'rpi-433';
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

