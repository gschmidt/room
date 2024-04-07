/*****************************************************************************/
/* Alexa interface                                                           */
/*****************************************************************************/

// To edit the interactions model, visit:
// https://developer.amazon.com/alexa/console/ask/build/custom/amzn1.ask.skill.83c4d275-dd84-421b-8e1a-7b549717880c/development/en_US/dashboard

import { default as Alexa } from 'ask-sdk-core';
import { default as express} from 'express';
import { default as AskSdkExpressAdapter } from 'ask-sdk-express-adapter';
import { scenes } from './config.js';
import { triggerScene } from './app.js';

let ExpressAdapter = AskSdkExpressAdapter.ExpressAdapter;

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'What do you need?';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('My Room', speechText)
      .getResponse();
  }
};

function findMatchingScene(intent, slots) {
  const sceneNames = Object.keys(scenes);

  for (let i = 0; i < sceneNames.length; i ++) {
    const sceneName = sceneNames[i];
    const scene = scenes[sceneName];
    if (! scene._alexa)
      continue;

    for (let j = 0; j < scene._alexa.length; j ++) {
      const rule = scene._alexa[j];
      const ruleKeys = Object.keys(rule);
      if (ruleKeys.length !== 1)
        throw new Error(`bad rule ${JSON.stringify(rule)} in scene ${sceneName}`);
      const ruleIntent = ruleKeys[0];
      const ruleSlots = rule[ruleIntent];
      if (ruleIntent !== intent)
        continue;
      
      const ruleSlotKeys = Object.keys(ruleSlots);
      let match = true;
      for (let k = 0; k < ruleSlotKeys.length; k ++ ) {
        const ruleSlotKey = ruleSlotKeys[k];
        if (slots[ruleSlotKey].value !== ruleSlots[ruleSlotKey])
          match = false;
      }

      if (match) {
        return sceneName;
      }
    }
  }

  return null;
}

const MainIntentHandler = {
  canHandle(handlerInput) {
    if (handlerInput.requestEnvelope.request.type !== 'IntentRequest')
      return false;
    const intent = handlerInput.requestEnvelope.request.intent.name;
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const sceneName = findMatchingScene(intent, slots);
    return !! sceneName;
  },
  handle(handlerInput) {
    const intent = handlerInput.requestEnvelope.request.intent.name;
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const sceneName = findMatchingScene(intent, slots);
    if (! sceneName)
      throw new Error(`no matching scene for ${intent} ${slots}`)
    triggerScene(sceneName);

    const speechText = '';
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('My Room', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = "Sorry, you're on your own!";

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('My Room', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = 'As you wish!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('My Room', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    //any cleanup logic goes here
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Not recognized')
      .withShouldEndSession(true)
      .getResponse();
  },
};

const LogRequestInterceptor = {
  process(handlerInput) {
    // Log Request
    console.log("==== REQUEST ======");
    console.log(JSON.stringify(handlerInput.requestEnvelope, null, 2));
  }
}

const LogResponseInterceptor = {
  process(handlerInput, response) {
    // Log Response
    console.log("==== RESPONSE ======");
    console.log(JSON.stringify(response, null, 2));
  }
}

export function launchAlexa() {
  const app = express();
  const skillBuilder = Alexa.SkillBuilders.custom();
  skillBuilder.addRequestHandlers(
    LaunchRequestHandler,
    MainIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  );
  skillBuilder.addErrorHandlers(ErrorHandler);
  //skillBuilder.addRequestInterceptors(LogRequestInterceptor)
  //skillBuilder.addResponseInterceptors(LogResponseInterceptor)
  const skill = skillBuilder.create();
  const adapter = new ExpressAdapter(skill, true, true);

  app.post('/', adapter.getRequestHandlers());
  app.listen(12000);
}
