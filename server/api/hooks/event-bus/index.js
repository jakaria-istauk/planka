/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * event-bus hook
 *
 * @description :: In-process event bus for integrations. Every event that goes through
 *                 `sendWebhooks` is dispatched to the subscribers registered here, whether or
 *                 not any outgoing webhook matches it.
 * @docs        :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

const { AsyncLocalStorage } = require('async_hooks');

module.exports = function defineEventBusHook(sails) {
  const subscribers = new Set();
  const originStorage = new AsyncLocalStorage();

  return {
    /**
     * Runs when this Sails app loads/lifts.
     */

    async initialize() {
      sails.log.info('Initializing custom hook (`event-bus`)');
    },

    /**
     * Registers a subscriber.
     *
     * @param {Function} handler - Called with `{ event, data, prevData, user, scope, origin }`.
     * @returns {Function} Unsubscribes the handler.
     */
    subscribe(handler) {
      subscribers.add(handler);

      return () => {
        subscribers.delete(handler);
      };
    },

    hasSubscribers() {
      return subscribers.size > 0;
    },

    /**
     * Runs `fn` with an origin (`automation`, `github`, `discord`) that every event emitted from
     * inside it carries, so a subscriber can skip the events it caused itself.
     */
    runWithOrigin(origin, fn) {
      return originStorage.run({ origin }, fn);
    },

    getOrigin() {
      const store = originStorage.getStore();
      return store ? store.origin : null;
    },

    emit(payload) {
      const event = {
        ...payload,
        origin: this.getOrigin(),
      };

      subscribers.forEach((handler) => {
        // Runs after the emitting helper returns; a failing subscriber must not break others
        Promise.resolve()
          .then(() => handler(event))
          .catch((error) => {
            sails.log.error(`Event bus subscriber failed on ${event.event} with error: ${error}`);
          });
      });
    },
  };
};
