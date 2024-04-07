/*****************************************************************************/
/* Device list and scenes                                                    */
/*****************************************************************************/

import { devices, scenes } from './config.js';
import { e131Parameters, setE131Parameter } from './e131.js';

export let devicesByName = {};
devices.forEach(async (device) => {
  devicesByName[device.name] = device;
  if (device.type === 'func' && device.getFunc) {
    device.on = await device.getFunc();
  }
});

export async function triggerScene(sceneName) {
  let scene = scenes[sceneName];
  if (! scene) {
    console.log(`unknown scene ${sceneName}`);
    return;
  }
  for (let key in scene) {
    let device = devicesByName[key];
    if (device) {
      /* await */ setDeviceState(device, scene[key]);
    } else if (key in e131Parameters) {
      setE131Parameter(key, scene[key]);
    } else if (key === '_alexa') {
      /* nothing */
    } else {
      console.log(`unknown key ${key} in scene ${sceneName}`);
    }
  }
}

/*****************************************************************************/
/* Device state transitions                                                  */
/*****************************************************************************/

import { sleep } from './helpers.js';
import { sendHarmonyAction } from './harmony.js';
import { sendToActiveControllers } from './osc.js';

// This is called:
// 1) When a scene is triggered (triggerScene)
// 2) From a tap in the OSC app (changing just a single device)
export async function setDeviceState(device, on) {
  recordDeviceState(device, on);

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

// This is called (currently, only):
// When we receive a Kasa state change from physical Kasa device
export async function onHardwareDeviceStateChange(device, on) {
  let changedState = (device.on !== on);
  recordDeviceState(device, on);

  if (device.switchBehavior && changedState) {
    let behavior = device.switchBehavior;

    if (behavior.type === 'toggle-switch') {
      triggerScene(device.on ? behavior.onScene : behavior.offScene);
    } else if (behavior.type === 'one-button-scene-switch') {
      if (! behavior._lastPushTime) {
        behavior._lastPushTime = 0;
        behavior._selectedIndex = null;
        behavior._cleanupTimer = null;
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
      }, behavior.selectionTime);
    } else {
      throw new Error(`unknown switch behavor '${behavior.type}'`);
    }
  }
}

function recordDeviceState(device, on) {
  device.on = on;
  sendToActiveControllers(`/dev/${device.name}`, device.on ? 1 : 0);
}

/*****************************************************************************/
/* Main                                                                      */
/*****************************************************************************/

import { launchKasa } from './kasa.js';
import { launchHarmony } from './harmony.js';
import { launchE131 } from './e131.js';
import { launchOsc } from './osc.js';
import { launchAlexa } from './alexa.js';

function main() {
  launchKasa();
  launchHarmony();
  launchE131();
  launchOsc();
  launchAlexa();
}

main();

/*****************************************************************************/

