/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/* Query methods */

const createOne = (values) => OauthClient.create({ ...values }).fetch();

const getByIds = (ids) => OauthClient.find(ids);

const getOneByClientId = (clientId) =>
  OauthClient.findOne({
    clientId,
  });

module.exports = {
  createOne,
  getByIds,
  getOneByClientId,
};
