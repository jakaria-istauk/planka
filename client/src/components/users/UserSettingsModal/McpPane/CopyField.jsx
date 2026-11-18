/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import styles from './CopyField.module.scss';

const CopyField = React.memo(({ value, multiline }) => {
  const [t] = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopyClick = useCallback(() => {
    navigator.clipboard.writeText(value);
    setIsCopied(true);

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsCopied(false), 1500);
  }, [value]);

  return (
    <div className={classNames(styles.wrapper, multiline && styles.wrapperMultiline)}>
      <pre className={styles.value}>{value}</pre>
      <Button
        basic
        size="small"
        className={styles.button}
        aria-label={t('action.copy')}
        onClick={handleCopyClick}
      >
        <Icon fitted name={isCopied ? 'check' : 'copy outline'} />
      </Button>
    </div>
  );
});

CopyField.propTypes = {
  value: PropTypes.string.isRequired,
  multiline: PropTypes.bool,
};

CopyField.defaultProps = {
  multiline: false,
};

export default CopyField;
