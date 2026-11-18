/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Always uses a 12-hour clock, regardless of the locale's default time format
export default (i18n, date) => {
  const format =
    date.getFullYear() === new Date().getFullYear() ? 'MMM d, h:mm a' : 'MMM d, y, h:mm a';

  return i18n.dateFns.format(date, format);
};
