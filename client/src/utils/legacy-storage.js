/*!
 * Copyright (c) 2026 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Keys this browser stored before the product was renamed to Tama. Each one is
// moved under its new name once, so saved filters, drafts, the theme and the
// labels view survive the upgrade. Session storage only holds per-tab state,
// so it is left to expire on its own.

const RENAMED_PREFIXES = [
  ['planka:filter:', 'tama:filter:'],
  ['planka:descriptionDraft:', 'tama:descriptionDraft:'],
  ['planka_theme_', 'tama_theme_'],
  ['plankaLabels.', 'tamaLabels.'],
];

const migrateLegacyStorage = (storage = window.localStorage) => {
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      keys.push(storage.key(i));
    }

    keys.forEach((key) => {
      const renamed = RENAMED_PREFIXES.find(([from]) => key.startsWith(from));

      if (!renamed) {
        return;
      }

      const [from, to] = renamed;
      const newKey = `${to}${key.slice(from.length)}`;

      if (storage.getItem(newKey) === null) {
        storage.setItem(newKey, storage.getItem(key));
      }

      storage.removeItem(key);
    });
  } catch {
    /* empty */
  }
};

export default migrateLegacyStorage;
