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

export async function sendHarmonyAction(deviceId, action) {
  console.log(`'${deviceId} ${action}'`);
  const result = await harmonyClient.send('holdAction', {
    command: action,
    deviceId: deviceId
  });
}
