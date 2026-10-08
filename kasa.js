/*****************************************************************************/
/* TP-Link Kasa device control                                               */
/*****************************************************************************/

import { default as kasa } from 'tplink-smarthome-api';
import { devices } from './config.js';
import { onHardwareDeviceStateChange } from './app.js';

const POLL_INTERVAL_MS = 250;
// Backstop in case a request never settles (tplink-smarthome-api 2.x could hang
// forever on a half-closed socket, wedging that device's request queue). The
// library's own timeout should normally fire first.
const POLL_TIMEOUT_MS = 15000;
const RETRY_MS = 15000;

const kasaClient = new kasa.Client({
  defaultSendOptions: {
    // While UDP is probably better in theory, even a single lost packet throws
    // an exception that crashes the app (if a response isn't received in the expected
    // time). Turn UDP back on once that's been addressed
    transport: 'tcp'
  },
  /* logLevel: "debug" */ });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no response in ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Runs forever: connect, poll until the device stops responding, reconnect.
// Each reconnect gets a fresh device object (and so a fresh connection and
// request queue), abandoning anything that got stuck on the old one.
async function runKasaDevice(device) {
  while (true) {
    let kasaDevice;
    try {
      kasaDevice = await kasaClient.getDevice({ host: device.host });
      let info = await kasaDevice.getSysInfo();
      console.log(`Kasa device ${device.host} (${info.alias}) is ${info.relay_state ? 'on' : 'off'}`);
      device.on = !! info.relay_state;
    } catch (e) {
      console.log(`Kasa device ${device.host} not available, retrying in ${RETRY_MS / 1000}s: ${e.message}`);
      await sleep(RETRY_MS);
      continue;
    }

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
    // Emitted after every successful poll (whether or not the state changed)
    kasaDevice.on('power-update', (powerOn) => {
      /* await */ onHardwareDeviceStateChange(device, powerOn);
    });
    device.kasaDevice = kasaDevice;

    try {
      while (true) {
        await sleep(POLL_INTERVAL_MS);
        await withTimeout(kasaDevice.getSysInfo(), POLL_TIMEOUT_MS);
      }
    } catch (err) {
      console.log(`Kasa device ${device.host} went offline: ${err.message}`);
      // Ignore any late events from the abandoned device object
      kasaDevice.removeAllListeners('power-update');
      device.kasaDevice = null;
    }
  }
}

devices.forEach((device) => {
  if (device.type === 'kasa') {
    runKasaDevice(device);
  }
});

export function launchKasa() {
  // nothing special to do - the globals do it all
}
