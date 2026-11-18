/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Header, Icon, Message, Tab } from 'semantic-ui-react';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import Config from '../../../../constants/Config';
import CopyField from './CopyField';
import ConnectedApps from './ConnectedApps';
import CLIENTS, { AuthTypes } from './clients';

import styles from './McpPane.module.scss';

const API_KEY_PLACEHOLDER = '<your API key>';

const MCP_URL = `${window.location.origin}${Config.BASE_PATH}/api/mcp`;

// Hosted assistants reach the server from the internet, which needs a public HTTPS address
const IS_PUBLIC_HTTPS =
  window.location.protocol === 'https:' &&
  !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

const ConfirmStates = {
  REGENERATE: 'REGENERATE',
  DELETE: 'DELETE',
};

const McpPane = React.memo(() => {
  const user = useSelector(selectors.selectCurrentUser);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [clientId, setClientId] = useState(CLIENTS[0].id);
  const [confirmState, setConfirmState] = useState(null);

  const client = CLIENTS.find(({ id }) => id === clientId);
  const apiKey = user.apiKeyState.value;

  // The full key is only on screen right after it is created
  useEffect(
    () => () => {
      dispatch(entryActions.clearUserApiKeyValue(user.id));
    },
    [user.id, dispatch],
  );

  const handleClientClick = useCallback((id) => {
    setClientId(id);
  }, []);

  const handleCreateApiKeyClick = useCallback(() => {
    if (user.apiKeyPrefix) {
      setConfirmState(ConfirmStates.REGENERATE);
    } else {
      dispatch(entryActions.createUserApiKey(user.id));
    }
  }, [user.id, user.apiKeyPrefix, dispatch]);

  const handleDeleteApiKeyClick = useCallback(() => {
    setConfirmState(ConfirmStates.DELETE);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState === ConfirmStates.REGENERATE) {
      dispatch(entryActions.createUserApiKey(user.id));
    } else {
      dispatch(entryActions.deleteUserApiKey(user.id));
    }

    setConfirmState(null);
  }, [confirmState, user.id, dispatch]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmState(null);
  }, []);

  let apiKeyNode;
  if (confirmState) {
    const isRegenerate = confirmState === ConfirmStates.REGENERATE;

    apiKeyNode = (
      <div className={styles.confirm}>
        <p>
          {isRegenerate
            ? t('common.areYouSureYouWantToRegenerateThisApiKey')
            : t('common.areYouSureYouWantToDeleteThisApiKey')}
        </p>
        <Button
          negative={!isRegenerate}
          content={isRegenerate ? t('action.regenerateApiKey') : t('action.deleteApiKey')}
          onClick={handleConfirm}
        />
        <Button content={t('action.cancel')} onClick={handleConfirmCancel} />
      </div>
    );
  } else if (apiKey) {
    apiKeyNode = (
      <>
        <Message
          positive
          size="small"
          header={t('common.apiKeyCreated', { context: 'title' })}
          content={t('common.saveThisKeyItIsAddedToSetupBelowOnlyNow')}
        />
        <CopyField value={apiKey} />
      </>
    );
  } else if (user.apiKeyPrefix) {
    apiKeyNode = (
      <p className={styles.keyStatus}>
        <Icon name="key" />
        <code>{`${user.apiKeyPrefix}_...`}</code>
        <span className={styles.muted}>{t('common.fullKeyIsHiddenForSecurityReasons')}</span>
      </p>
    );
  } else {
    apiKeyNode = <p className={styles.muted}>{t('common.noApiKeyCreatedForMcp')}</p>;
  }

  return (
    <Tab.Pane attached={false} className={styles.wrapper}>
      <p className={styles.intro}>{t('common.mcpIntro')}</p>

      <section className={styles.section}>
        <Header as="h4" className={styles.heading}>
          {t('common.mcpServerUrl', { context: 'title' })}
        </Header>
        <CopyField value={MCP_URL} />
      </section>

      <section className={styles.section}>
        <Header as="h4" className={styles.heading}>
          {t('common.connectAnAssistant', { context: 'title' })}
        </Header>
        <div className={styles.clients}>
          {CLIENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={classNames(styles.client, item.id === clientId && styles.clientActive)}
              onClick={() => handleClientClick(item.id)}
            >
              <Icon fitted name={item.icon} />
              <span>{item.name || t(item.nameKey)}</span>
            </button>
          ))}
        </div>
        <div className={styles.clientDetails}>
          <p className={styles.clientDescription}>
            {t(client.descriptionKey)}{' '}
            <span className={styles.badge}>
              {client.authType === AuthTypes.OAUTH
                ? t('common.signInWithPlanka')
                : t('common.usesApiKey')}
            </span>
          </p>
          {client.authType === AuthTypes.OAUTH ? (
            <>
              {!IS_PUBLIC_HTTPS && (
                <Message warning size="small" content={t('common.mcpNeedsPublicHttps')} />
              )}
              <ol className={styles.steps}>
                {client.steps.map((step) => (
                  <li key={step}>{t(step, { url: MCP_URL })}</li>
                ))}
              </ol>
            </>
          ) : (
            <>
              {!apiKey && <p className={styles.muted}>{t('common.mcpCreateApiKeyFirst')}</p>}
              {client.fileName && (
                <p className={styles.fileName}>
                  <Icon name="file outline" />
                  <code>{client.fileName}</code>
                </p>
              )}
              <CopyField
                multiline
                value={client.buildSnippet(MCP_URL, apiKey || API_KEY_PLACEHOLDER)}
              />
            </>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <Header as="h4" className={styles.heading}>
          {t('common.apiKey', { context: 'title' })}
        </Header>
        {apiKeyNode}
        {!confirmState && (
          <div className={styles.keyActions}>
            <Button
              positive={!user.apiKeyPrefix}
              content={user.apiKeyPrefix ? t('action.regenerateApiKey') : t('action.createApiKey')}
              loading={user.apiKeyState.isCreating}
              disabled={user.apiKeyState.isCreating}
              onClick={handleCreateApiKeyClick}
            />
            {user.apiKeyPrefix && (
              <Button basic content={t('action.deleteApiKey')} onClick={handleDeleteApiKeyClick} />
            )}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <Header as="h4" className={styles.heading}>
          {t('common.connectedApps', { context: 'title' })}
        </Header>
        <ConnectedApps />
      </section>
    </Tab.Pane>
  );
});

export default McpPane;
