/*****************************************************************************/
/* Devices                                                                   */
/*****************************************************************************/

import { default as rp } from 'request-promise';

export let devices = [
  {
    name: 'edison',
    on: null,
    type: 'kasa',
    host: 'edison-bulbs.kasa.geoffschmidt.com'
  },
  {
    name: 'lamp',
    on: null,
    type: 'kasa',
    host: 'lamp.kasa.geoffschmidt.com'
  },
  {
    name: 'bed',
    on: null,
    type: 'kasa',
    host: 'bed.kasa.geoffschmidt.com'
  },
  {
    name: 'closet',
    on: null,
    type: 'kasa',
    host: 'closet.kasa.geoffschmidt.com'
  },
  {
    // Used to be videoconferencing lights at desk, but is now Turkish lamp
    // Can't rename it without updating the TouchOSC config so save for later
    name: 'cam-lights',
    on: null,
    type: 'kasa',
    host: 'turkish-lamp.kasa.geoffschmidt.com'
  },
  {
    // Left side wall switch. For switching only - not connected to a load
    name: '207l-switch',
    on: null,
    type: 'kasa',
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

/*****************************************************************************/
/* Scenes                                                                    */
/*****************************************************************************/

export let scenes = {
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
