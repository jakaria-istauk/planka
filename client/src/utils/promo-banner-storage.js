/*!
 * Copyright (c) 2026 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Whether the PLANKA Pro banner is shown. It is off unless an administrator turns
// it on from the administration modal, and then only for that administrator in
// this browser: nobody else ever sees it.

const CHANGE_EVENT = 'planka:promoBannerChange';

const getKey = (userId) => `planka_proBannerEnabled_${userId}`;

export const isPromoBannerEnabled = (userId) => {
  try {
    return window.localStorage.getItem(getKey(userId)) === 'true';
  } catch {
    return false;
  }
};

export const setPromoBannerEnabled = (userId, isEnabled) => {
  try {
    if (isEnabled) {
      window.localStorage.setItem(getKey(userId), 'true');
    } else {
      window.localStorage.removeItem(getKey(userId));
    }
  } catch {
    /* empty */
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const subscribeToPromoBannerChange = (callback) => {
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
  };
};
