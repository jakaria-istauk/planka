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

// navigator.clipboard exists only in secure contexts (HTTPS or localhost),
// so plain-HTTP deployments copy through a hidden textarea instead
const copyText = (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.select();

  const isCopied = document.execCommand('copy');
  document.body.removeChild(textarea);

  return isCopied ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
};

const CopyField = React.memo(({ value, multiline }) => {
  const [t] = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopyClick = useCallback(() => {
    copyText(value)
      .then(() => {
        setIsCopied(true);

        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsCopied(false), 1500);
      })
      .catch(() => {});
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
