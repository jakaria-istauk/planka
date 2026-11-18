/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const path = require('path');
const Machine = require('machine');

const CONTROLLERS_PATH = path.join(__dirname, '../../api/controllers');

const machinesByIdentity = new Map();

const getMachine = (identity) => {
  let machine = machinesByIdentity.get(identity);

  if (!machine) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const def = require(path.join(CONTROLLERS_PATH, `${identity}.js`));

    machine = Machine.buildWithCustomUsage({
      def: {
        ...def,
        identity: `mcp-${identity.replace(/\//g, '-')}`,
        exits: _.mapValues(def.exits, (exit) => _.pick(exit, ['description'])),
      },
      // Same as Sails uses for actions, so `fn(inputs)` may return its output
      implementationSniffingTactic: sails.config.implementationSniffingTactic,
    });

    machinesByIdentity.set(identity, machine);
  }

  return machine;
};

class ActionError extends Error {
  constructor(exit, message) {
    super(message);

    this.name = 'ActionError';
    this.exit = exit;
  }
}

/**
 * Runs a REST controller action as the user of `req`, with the same input validation and
 * permission checks as the HTTP route, and returns its output.
 *
 * @throws {ActionError} When the action exits through anything but success.
 */
const runAction = async (identity, inputs, req) => {
  try {
    return await getMachine(identity).with(_.omitBy(inputs, _.isUndefined)).meta({ req, sails });
  } catch (error) {
    if (error.code === 'E_INVALID_ARGINS') {
      throw new ActionError('invalidInputs', error.message);
    }

    if (error.exit && error.exit !== 'error') {
      throw new ActionError(error.exit, _.isString(error.raw) ? error.raw : error.exit);
    }

    throw error;
  }
};

module.exports = {
  ActionError,
  runAction,
};
