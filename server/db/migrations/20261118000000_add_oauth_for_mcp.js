/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports.up = async (knex) => {
  await knex.schema.createTable('oauth_client', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.text('client_id').notNullable();
    table.text('client_secret_hash');
    table.text('name');
    table.jsonb('redirect_uris').notNullable();
    table.jsonb('metadata').notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique('client_id');
  });

  await knex.schema.createTable('oauth_authorization_code', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('oauth_client_id').notNullable();
    table.bigInteger('user_id').notNullable();

    table.text('code_hash').notNullable();
    table.text('redirect_uri').notNullable();
    table.text('code_challenge').notNullable();
    table.jsonb('scopes').notNullable();
    table.text('resource');

    table.timestamp('expires_at', true).notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique('code_hash');
    table.index('expires_at');
  });

  return knex.schema.createTable('oauth_token', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('oauth_client_id').notNullable();
    table.bigInteger('user_id').notNullable();

    table.text('access_token_hash').notNullable();
    table.text('refresh_token_hash').notNullable();
    table.jsonb('scopes').notNullable();
    table.text('resource');

    table.timestamp('access_token_expires_at', true).notNullable();
    table.timestamp('refresh_token_expires_at', true).notNullable();
    table.timestamp('last_used_at', true);

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique('access_token_hash');
    table.unique('refresh_token_hash');
    table.index(['user_id', 'oauth_client_id']);
  });
};

module.exports.down = async (knex) => {
  await knex.schema.dropTable('oauth_token');
  await knex.schema.dropTable('oauth_authorization_code');

  return knex.schema.dropTable('oauth_client');
};
