/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

export const selectIsContentFetching = ({ core: { isContentFetching } }) => isContentFetching;

export const selectIsLogouting = ({ core: { isLogouting } }) => isLogouting;

export const selectIsFavoritesEnabled = ({ core: { isFavoritesEnabled } }) => isFavoritesEnabled;

// The edit mode lock is gone from the interface: what a user may change follows their
// permissions alone, so the mode is always on.
export const selectIsEditModeEnabled = () => true;

export const selectFilterFocusNonce = ({ core: { filterFocusNonce } }) => filterFocusNonce;

export const selectClipboard = ({ core: { clipboard } }) => clipboard;

export const selectConfig = ({ core: { config } }) => config;

export const selectAutoLogoutWarning = ({ core: { autoLogoutWarning } }) => autoLogoutWarning;

export const selectRecentCardId = ({ core: { recentCardId } }) => recentCardId;

export const selectPrevCardId = ({ core: { prevCardIds } }) => prevCardIds.at(-1);

export const selectHomeView = ({ core: { homeView } }) => homeView;

export const selectProjectsSearch = ({ core: { projectsSearch } }) => projectsSearch;

export const selectProjectsOrder = ({ core: { projectsOrder } }) => projectsOrder;

export const selectIsHiddenProjectsVisible = ({ core: { isHiddenProjectsVisible } }) =>
  isHiddenProjectsVisible;

export default {
  selectIsContentFetching,
  selectIsLogouting,
  selectIsFavoritesEnabled,
  selectIsEditModeEnabled,
  selectFilterFocusNonce,
  selectClipboard,
  selectConfig,
  selectAutoLogoutWarning,
  selectRecentCardId,
  selectPrevCardId,
  selectHomeView,
  selectProjectsSearch,
  selectProjectsOrder,
  selectIsHiddenProjectsVisible,
};
