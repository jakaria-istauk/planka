/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon, List, Loader } from 'semantic-ui-react';

import selectors from '../../../../selectors';
import api from '../../../../api';

import styles from './ConnectedApps.module.scss';

const formatDate = (iso, t) => (iso ? new Date(iso).toLocaleString() : t('common.never'));

// Assistants the user approved through OAuth (Claude, ChatGPT); disconnecting revokes their tokens
const ConnectedApps = React.memo(() => {
  const accessToken = useSelector(selectors.selectAccessToken);

  const [t] = useTranslation();
  const [items, setItems] = useState(null);
  const [deletingIds, setDeletingIds] = useState([]);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  useEffect(() => {
    async function fetchConnections() {
      try {
        const { items: connections } = await api.getOauthConnections(headers);
        setItems(connections);
      } catch {
        setItems([]);
      }
    }

    fetchConnections();
  }, [headers]);

  const handleDisconnectClick = useCallback(
    async (id) => {
      setDeletingIds((prevDeletingIds) => [...prevDeletingIds, id]);

      try {
        await api.deleteOauthConnection(id, headers);
        setItems((prevItems) => prevItems.filter((item) => item.id !== id));
      } catch {
        /* empty */
      }

      setDeletingIds((prevDeletingIds) =>
        prevDeletingIds.filter((deletingId) => deletingId !== id),
      );
    },
    [headers],
  );

  if (!items) {
    return <Loader active inline="centered" size="small" />;
  }

  if (items.length === 0) {
    return <p className={styles.empty}>{t('common.noConnectedApps')}</p>;
  }

  return (
    <List divided relaxed className={styles.list}>
      {items.map((item) => {
        const isDeleting = deletingIds.includes(item.id);

        return (
          <List.Item key={item.id}>
            <List.Content floated="right">
              <Button
                basic
                size="tiny"
                content={t('action.disconnect')}
                loading={isDeleting}
                disabled={isDeleting}
                onClick={() => handleDisconnectClick(item.id)}
              />
            </List.Content>
            <List.Content>
              <List.Header className={styles.name}>
                <Icon name="plug" />
                {item.name || t('common.unnamedApp')}
              </List.Header>
              <List.Description className={styles.meta}>
                {t('common.connected')}: {formatDate(item.createdAt, t)}
                {' · '}
                {t('common.lastUsed')}: {formatDate(item.lastUsedAt, t)}
              </List.Description>
            </List.Content>
          </List.Item>
        );
      })}
    </List>
  );
});

export default ConnectedApps;
