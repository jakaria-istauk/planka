/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/* Query methods */

const createOne = (values) => OauthAuthorizationCode.create({ ...values }).fetch();

const getOneUnexpiredByCodeHash = (codeHash) =>
  OauthAuthorizationCode.findOne({
    codeHash,
    expiresAt: { '>': new Date().toISOString() },
  });

// Codes are single use, so the exchange deletes the one it reads
const deleteOneByCodeHash = (codeHash) =>
  OauthAuthorizationCode.destroyOne({
    codeHash,
  });

const deleteExpired = () =>
  OauthAuthorizationCode.destroy({
    expiresAt: { '<=': new Date().toISOString() },
  });

module.exports = {
  createOne,
  getOneUnexpiredByCodeHash,
  deleteOneByCodeHash,
  deleteExpired,
};
