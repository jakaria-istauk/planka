/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = async function isApiKey(req, res, proceed) {
  if (req.currentSession) {
    return res.unauthorized('API key is required');
  }

  return proceed();
};
