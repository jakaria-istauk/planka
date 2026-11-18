/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation, Trans } from 'react-i18next';
import { Button, Icon, Loader, Message } from 'semantic-ui-react';

import selectors from '../../../selectors';
import api from '../../../api';

import styles from './OauthConsent.module.scss';

const REQUIRED_PARAMS = ['client_id', 'redirect_uri', 'code_challenge'];

const getHost = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

// Shown when an AI assistant (ChatGPT, Claude, ...) asks to connect to the MCP server through
// OAuth: the server's authorize endpoint sends the browser here with the request parameters
const OauthConsent = React.memo(() => {
  const accessToken = useSelector(selectors.selectAccessToken);
  const currentUser = useSelector(selectors.selectCurrentUser);
  const search = useSelector(({ router }) => router.location.search);

  const [t] = useTranslation();
  const [client, setClient] = useState(null);
  const [error, setError] = useState(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(null);

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const hasRequiredParams = REQUIRED_PARAMS.every((name) => params.get(name));

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  useEffect(() => {
    if (!hasRequiredParams) {
      return;
    }

    async function fetchClient() {
      try {
        const { item } = await api.getOauthClient(params.get('client_id'), headers);
        setClient(item);
      } catch {
        setError('common.unknownAppConnectionRequest');
      }
    }

    fetchClient();
  }, [hasRequiredParams, params, headers]);

  const answer = useCallback(
    async (isApproved) => {
      setSubmittingAnswer(isApproved);

      const data = {
        isApproved,
        clientId: params.get('client_id'),
        redirectUri: params.get('redirect_uri'),
        codeChallenge: params.get('code_challenge'),
      };

      ['state', 'scope', 'resource'].forEach((name) => {
        if (params.get(name)) {
          data[name] = params.get(name);
        }
      });

      let redirectUrl;
      try {
        ({
          item: { redirectUrl },
        } = await api.createOauthConsent(data, headers));
      } catch {
        setSubmittingAnswer(null);
        setError('common.appConnectionRequestFailed');
        return;
      }

      window.location.assign(redirectUrl);
    },
    [params, headers],
  );

  const handleAllowClick = useCallback(() => answer(true), [answer]);
  const handleDenyClick = useCallback(() => answer(false), [answer]);

  let contentNode;
  if (!hasRequiredParams || error) {
    contentNode = (
      <Message
        negative
        header={t('common.cannotConnectApp', { context: 'title' })}
        content={t(error || 'common.unknownAppConnectionRequest')}
      />
    );
  } else if (!client) {
    contentNode = <Loader active inline="centered" />;
  } else {
    const appName = client.name || t('common.unnamedApp');
    const isSubmitting = submittingAnswer !== null;

    contentNode = (
      <>
        <div className={styles.icons}>
          <span className={styles.appIcon}>
            <Icon fitted name="plug" />
          </span>
          <Icon fitted name="exchange" className={styles.connector} />
          <span className={styles.plankaIcon}>
            <Icon fitted name="columns" />
          </span>
        </div>
        <h1 className={styles.title}>
          <Trans i18nKey="common.appWantsToAccessYourAccount" values={{ appName }}>
            <strong>{appName}</strong> wants to access your PLANKA account
          </Trans>
        </h1>
        <p className={styles.signedInAs}>{t('common.signedInAs', { name: currentUser.name })}</p>
        <ul className={styles.permissions}>
          <li>
            <Icon name="eye" className={styles.permissionIcon} />
            {t('common.appCanReadProjectsBoardsAndCards')}
          </li>
          <li>
            <Icon name="edit" className={styles.permissionIcon} />
            {t('common.appCanChangeCardsTasksAndComments')}
          </li>
          <li>
            <Icon name="lock" className={styles.permissionIcon} />
            {t('common.appKeepsYourPermissions')}
          </li>
        </ul>
        <p className={styles.redirect}>
          {t('common.youWillBeSentBackTo', {
            host: getHost(params.get('redirect_uri')),
          })}
        </p>
        <div className={styles.actions}>
          <Button
            basic
            content={t('action.deny')}
            loading={submittingAnswer === false}
            disabled={isSubmitting}
            onClick={handleDenyClick}
          />
          <Button
            positive
            content={t('action.allowAccess')}
            loading={submittingAnswer === true}
            disabled={isSubmitting}
            onClick={handleAllowClick}
          />
        </div>
        <p className={styles.hint}>{t('common.youCanDisconnectAppsInSettings')}</p>
      </>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>{contentNode}</div>
    </div>
  );
});

export default OauthConsent;
