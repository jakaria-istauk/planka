/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Tab } from 'semantic-ui-react';

import entryActions from '../../../entry-actions';
import { useClosableModal } from '../../../hooks';
import AccountPane from './AccountPane';
import PreferencesPane from './PreferencesPane';
import NotificationsPane from './NotificationsPane';
import SecurityPane from './SecurityPane';
import McpPane from './McpPane';

import styles from './UserSettingsModal.module.scss';

const UserSettingsModal = React.memo(() => {
  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleClose = useCallback(() => {
    dispatch(entryActions.closeModal());
  }, [dispatch]);

  const [ClosableModal] = useClosableModal();

  const panes = [
    {
      menuItem: {
        key: 'account',
        icon: 'user outline',
        content: t('common.account', {
          context: 'title',
        }),
      },
      render: () => <AccountPane />,
    },
    {
      menuItem: {
        key: 'preferences',
        icon: 'sliders horizontal',
        content: t('common.preferences', {
          context: 'title',
        }),
      },
      render: () => <PreferencesPane />,
    },
    {
      menuItem: {
        key: 'notifications',
        icon: 'bell outline',
        content: t('common.notifications', {
          context: 'title',
        }),
      },
      render: () => <NotificationsPane />,
    },
    {
      menuItem: {
        key: 'security',
        icon: 'shield alternate',
        content: t('common.security', {
          context: 'title',
        }),
      },
      render: () => <SecurityPane />,
    },
    {
      menuItem: {
        key: 'aiAssistants',
        icon: 'magic',
        content: t('common.aiAssistants', {
          context: 'title',
        }),
      },
      render: () => <McpPane />,
    },
  ];

  return (
    <ClosableModal open closeIcon size="small" centered={false} onClose={handleClose}>
      <ClosableModal.Content>
        <Tab
          menu={{
            secondary: true,
            pointing: true,
            className: styles.menu,
          }}
          panes={panes}
        />
      </ClosableModal.Content>
    </ClosableModal>
  );
});

export default UserSettingsModal;
