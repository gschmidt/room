/*****************************************************************************/
/* TP-Link Kasa device control                                               */
/*****************************************************************************/

import { default as kasa } from 'tplink-smarthome-api';
import { devices } from './config.js';
import { onHardwareDeviceStateChange } from './app.js';

const kasaClient = new kasa.Client({
  defaultSendOptions: {
    // While UDP is probably better in theory, even a single lost packet throws
    // an exception that crashes the app (if a response isn't received in the expected
    // time). Turn UDP back on once that's been addressed
    transport: 'tcp'
  },
  /* logLevel: "debug" */ });

async function connectKasaDevice(device) {
  while (true) {
    try {
      const kasaDevice = await kasaClient.getDevice({ host: device.host });
      let info = await kasaDevice.getSysInfo();
      console.log(`Kasa device ${device.host} (${info.alias}) is ${info.relay_state ? 'on' : 'off'}`);
      device.on = !! info.relay_state;
      device.kasaDevice = kasaDevice;
      kasaDevice.startPolling(250);

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
        /* await */ onHardwareDeviceStateChange(device, powerOn);
      });

      kasaDevice.on('error', (err) => {
        console.log(`Kasa device ${device.host} went offline: ${err.message}`);
        kasaDevice.stopPolling();
        device.kasaDevice = null;
        connectKasaDevice(device);
      });

      break;
    } catch (e) {
      console.log(`Kasa device ${device.host} not available, retrying in 15s: ${e.message}`);
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
}

devices.forEach((device) => {
  if (device.type === 'kasa') {
    connectKasaDevice(device);
  }
});

export function launchKasa() {
  // nothing special to do - the globals do it all
}
