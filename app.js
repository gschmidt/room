var e131 = require('e131');
var rgb = require('hsv-rgb')

var client = new e131.Client('10.1.1.84');  // or use a universe
/*
var packet = client.createPacket(510);
var slotsData = packet.getSlotsData(); // this is a Buffer
packet.setUniverse(0x01);  // make universe number consistent with the client
//packet.setOption(packet.Options.PREVIEW, true);  // don't really change any fixture
packet.setPriority(packet.DEFAULT_PRIORITY);  // not strictly needed, done automatically
*/

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


var sat_ = .75;
var br_ = .5;
var hueWidth_ = .5; //.33
var speed_ = 30; // 30
var hueCenter = 0;

var start = new Date;
var lastTime = start;

function cycleColor() {
  var now = new Date;
  var t = (now - start) / 1000;
  hueCenter = (hueCenter + (now - lastTime) / 1000 / speed_) % 1.0;
  lastTime = now;

  // demonstrates glitch at light 208
  // looks like a bug in the HSV library?
//  hueCenter = 0.8300000000000003;


  var hueStart = hueCenter - hueWidth_ / 2 + 1.0;
  var hueEnd = hueCenter + hueWidth_ / 2 + 1.0;
  var hueStep = (hueEnd - hueStart) / 240;

  console.log(hueCenter);
  //console.log(Math.floor((t * 60) % 300));

  var pixel = -1;
  var side = 0;
  var rafter = 0;
  
  for (var idx=0; idx<totalChannels; idx += channelsPerPixel) {
    pixel++;
    if (pixel === pixelsPerSide) {
      pixel = 0;
      side++;
      if (side === sidesPerRafter) {
        side = 0;
        rafter++;
      }
    }
    var x = rgb(((hueStart + pixel * hueStep) % 1) * 360, sat_ * 100, br_ * 100);

    /*
    if (Math.floor((t * 60) % 300) === (idx / 3))
      x = [255,255,255];
    else 
      x = [0, 0, 0];
    */

//   if (208 === (idx / 3))
//     x = [255,255,255];

//if (side !== 1)
  x=[0,0,0];
//x=[255,255,255];

    buf[idx + 0] = x[1]; // green
    buf[idx + 1] = x[0]; // red
    buf[idx + 2] = x[2]; // blue
//    buf[idx + 3] = (Math.sin(t/5)+1)/2*256 ; // warm white
    buf[idx + 3] = side ? 0 : 0; // warm white
//  //  console.log((idx / 3) + " " + JSON.stringify(x) + " " + JSON.stringify(
  //    [((hueStart + idx/3 * hueStep) % 1) * 360, sat_ * 100, br_ * 100]));

  }



  /*
  client.send(packet, function () {
    setTimeout(cycleColor, 1000/40);
  });
  */
  sendPackets(buf, function () {
    setTimeout(cycleColor, 1000/40);
  });
}
cycleColor();
