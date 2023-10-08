import { default as dns } from 'dns';

async function tryReverse(ip) {
  try {  
    return await dns.promises.reverse(ip);
  } catch (e) {
    return "???";
  }
}

/* Kasa devices */

import { default as kasa } from 'tplink-smarthome-api';

const kasaClient = new kasa.Client({ /* logLevel: "debug" */ });

kasaClient.startDiscovery({ discoveryInterval: 250}).on('device-new', async (device) => {
  let info = await device.getSysInfo();
  let hostname = await tryReverse(device.host);
  console.log(`${device.host} (${hostname}): Kasa ${info.mac} (${info.alias}) ` +
    `on port ${device.port}`);
});

/* Harmony hubs */

import { default as HarmonyDiscover } from '@harmonyhub/discover';

const harmonyDiscover = new HarmonyDiscover.Explorer(61991);

harmonyDiscover.on('online', async function(hub) {
  let hostname = await tryReverse(hub.ip);
  console.log(`${hub.ip} (${hostname}): Harmony Hub with UUID ${hub.uuid}`);
});

harmonyDiscover.start();
