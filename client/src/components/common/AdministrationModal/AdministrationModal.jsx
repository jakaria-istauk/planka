/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Modal, Tab } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { useClosableModal } from '../../../hooks';
import UsersPane from './UsersPane';
import SmtpPane from './SmtpPane';
import WebhooksPane from './WebhooksPane';
import PromoBannerPane from './PromoBannerPane';

import styles from './AdministrationModal.module.scss';

const AdministrationModal = React.memo(() => {
  const config = useSelector(selectors.selectConfig);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const handleClose = useCallback(() => {
    dispatch(entryActions.closeModal());
  }, [dispatch]);

  const handleTabChange = useCallback((_, { activeIndex }) => {
    setActiveTabIndex(activeIndex);
  }, []);

  const [ClosableModal] = useClosableModal();

  const panes = [
    {
      menuItem: {
        key: 'users',
        icon: 'users',
        content: t('common.users', {
          context: 'title',
        }),
      },
      render: () => <UsersPane />,
    },
  ];
  if (config.smtpHost !== undefined) {
    panes.push({
      menuItem: {
        key: 'smtp',
        icon: 'mail outline',
        content: t('common.smtp', {
          context: 'title',
        }),
      },
      render: () => <SmtpPane />,
    });
  }
  panes.push({
    menuItem: {
      key: 'webhooks',
      icon: 'plug',
      content: t('common.webhooks', {
        context: 'title',
      }),
    },
    render: () => <WebhooksPane />,
  });
  panes.push({
    menuItem: {
      key: 'proBanner',
      icon: 'bullhorn',
      content: t('common.proBanner', {
        context: 'title',
      }),
    },
    render: () => <PromoBannerPane />,
  });

  const isUsersPaneActive = activeTabIndex === 0;

  return (
    <ClosableModal
      closeIcon
      size={isUsersPaneActive ? 'large' : 'small'}
      centered={false}
      className={classNames(isUsersPaneActive && styles.wrapperUsers)}
      onClose={handleClose}
    >
      <Modal.Content>
        <Tab
          menu={{
            secondary: true,
            pointing: true,
          }}
          panes={panes}
          onTabChange={handleTabChange}
        />
      </Modal.Content>
    </ClosableModal>
  );
});

export default AdministrationModal;
