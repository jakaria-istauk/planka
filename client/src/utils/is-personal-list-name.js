/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Keep in sync with List.PERSONAL_NAME_REGEX on the server
const PERSONAL_NAME_REGEX = /^\s*my\s+(works?|tasks?|to[\s-]?dos?)\s*$/i;

export default (name) => !!name && PERSONAL_NAME_REGEX.test(name);
