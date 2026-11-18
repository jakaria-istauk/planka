/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/* Query methods */

const createOne = (values) => OauthToken.create({ ...values }).fetch();

const getByUserId = (userId) =>
  OauthToken.find({
    userId,
  }).sort('createdAt DESC');

const getOneUnexpiredByAccessTokenHash = (accessTokenHash) =>
  OauthToken.findOne({
    accessTokenHash,
    accessTokenExpiresAt: { '>': new Date().toISOString() },
  });

const getOneUnexpiredByRefreshTokenHash = (refreshTokenHash) =>
  OauthToken.findOne({
    refreshTokenHash,
    refreshTokenExpiresAt: { '>': new Date().toISOString() },
  });

const updateOne = (criteria, values) => OauthToken.updateOne(criteria).set({ ...values });

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => OauthToken.destroy(criteria).fetch();

module.exports = {
  createOne,
  getByUserId,
  getOneUnexpiredByAccessTokenHash,
  getOneUnexpiredByRefreshTokenHash,
  updateOne,
  delete: delete_,
};
