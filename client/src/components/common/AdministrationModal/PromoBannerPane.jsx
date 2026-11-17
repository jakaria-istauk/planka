/*!
 * Copyright (c) 2026 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Radio, Tab } from 'semantic-ui-react';

import selectors from '../../../selectors';
import { isPromoBannerEnabled, setPromoBannerEnabled } from '../../../utils/promo-banner-storage';

import styles from './PromoBannerPane.module.scss';

const PromoBannerPane = React.memo(() => {
  const userId = useSelector(selectors.selectCurrentUserId);

  const [t] = useTranslation();
  const [isEnabled, setIsEnabled] = useState(() => isPromoBannerEnabled(userId));

  const handleToggleChange = useCallback(
    (_, { checked }) => {
      setPromoBannerEnabled(userId, checked);
      setIsEnabled(checked);
    },
    [userId],
  );

  return (
    <Tab.Pane attached={false} className={styles.wrapper}>
      <Radio
        toggle
        checked={isEnabled}
        label={t('common.showProBanner')}
        onChange={handleToggleChange}
      />
      <p className={styles.description}>{t('common.proBannerIsOnlyShownToYouInThisBrowser')}</p>
    </Tab.Pane>
  );
});

export default PromoBannerPane;
