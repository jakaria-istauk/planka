/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useContext } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon, Menu } from 'semantic-ui-react';
import { Tooltip } from '../../../lib/custom-ui';
import { usePopup } from '../../../lib/popup';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import Paths from '../../../constants/Paths';
import { UserRoles } from '../../../constants/Enums';
import { SidebarContext } from '../../../contexts';
import NotificationsStep from '../../notifications/NotificationsStep';
import SelectBoardStep from '../../boards/SelectBoardStep';

import styles from './Header.module.scss';

const POPUP_PROPS = {
  position: 'bottom right',
};

const BOARDS_POPUP_PROPS = {
  position: 'bottom left',
};

const Header = React.memo(() => {
  const user = useSelector(selectors.selectCurrentUser);
  const project = useSelector(selectors.selectCurrentProject);
  const board = useSelector(selectors.selectCurrentBoard);
  const notificationIds = useSelector(selectors.selectNotificationIdsForCurrentUser);
  const canEditProject = useSelector((state) => {
    if (!project) {
      return false;
    }

    const isAdminInSharedProject = user.role === UserRoles.ADMIN && !project.ownerProjectManagerId;

    return isAdminInSharedProject || selectors.selectIsCurrentUserManagerForCurrentProject(state);
  });

  const [, setIsSidebarOpen] = useContext(SidebarContext);

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleOpenSidebarClick = useCallback(() => {
    setIsSidebarOpen(true);
  }, [setIsSidebarOpen]);

  const handleProjectSettingsClick = useCallback(() => {
    dispatch(entryActions.openProjectSettingsModal());
  }, [dispatch]);

  const NotificationsPopup = usePopup(NotificationsStep, POPUP_PROPS);
  const SelectBoardPopup = usePopup(SelectBoardStep, BOARDS_POPUP_PROPS);

  return (
    <div className={styles.wrapper}>
      <Menu size="large" className={styles.menu}>
        <Menu.Menu position="left">
          <Menu.Item
            aria-label={t('action.openMenu')}
            className={classNames(styles.item, styles.itemHoverable, styles.menuToggler)}
            onClick={handleOpenSidebarClick}
          >
            <Icon fitted name="bars" />
          </Menu.Item>
          {project ? (
            <Menu.Item className={classNames(styles.item, styles.title)}>
              <Link to={Paths.ROOT} className={styles.breadcrumb}>
                {t('common.home')}
              </Link>
              <Icon fitted name="angle right" className={styles.breadcrumbSeparator} />
              <span className={styles.titleText}>{project.name}</span>
              <Icon fitted name="angle right" className={styles.breadcrumbSeparator} />
              <SelectBoardPopup>
                <button type="button" className={styles.boardSelector}>
                  <span className={styles.titleText}>
                    {board ? board.name : t('common.selectBoard')}
                  </span>
                  <Icon fitted name="chevron down" className={styles.boardSelectorIcon} />
                </button>
              </SelectBoardPopup>
            </Menu.Item>
          ) : (
            <Menu.Item className={classNames(styles.item, styles.title)}>
              {t('common.home')}
            </Menu.Item>
          )}
        </Menu.Menu>
        <Menu.Menu position="right">
          {canEditProject && (
            <Tooltip content={t('common.openProjectSettings')}>
              <Menu.Item
                aria-label={t('common.openProjectSettings')}
                className={classNames(styles.item, styles.itemHoverable)}
                onClick={handleProjectSettingsClick}
              >
                <Icon fitted name="setting" />
              </Menu.Item>
            </Tooltip>
          )}
          <NotificationsPopup>
            <Tooltip content={t('common.openNotifications')}>
              <Menu.Item className={classNames(styles.item, styles.itemHoverable)}>
                <Icon fitted name="bell" />
                {notificationIds.length > 0 && (
                  <span className={styles.notification}>{notificationIds.length}</span>
                )}
              </Menu.Item>
            </Tooltip>
          </NotificationsPopup>
        </Menu.Menu>
      </Menu>
    </div>
  );
});

export default Header;
