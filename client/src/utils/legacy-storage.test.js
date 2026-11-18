import migrateLegacyStorage from './legacy-storage';

const makeStorage = (entries) => {
  const map = new Map(Object.entries(entries));

  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    toObject: () => Object.fromEntries(map),
  };
};

describe('migrateLegacyStorage', () => {
  it('moves renamed keys under their new names', () => {
    const storage = makeStorage({
      'planka:filter:saved:1:2': '[]',
      'planka:descriptionDraft:1:3': 'draft',
      planka_theme_1: 'dark',
      'plankaLabels.viewMode': 'list',
      i18nextLng: 'en-US',
    });

    migrateLegacyStorage(storage);

    expect(storage.toObject()).toEqual({
      'tama:filter:saved:1:2': '[]',
      'tama:descriptionDraft:1:3': 'draft',
      tama_theme_1: 'dark',
      'tamaLabels.viewMode': 'list',
      i18nextLng: 'en-US',
    });
  });

  it('keeps a value already stored under the new name', () => {
    const storage = makeStorage({
      planka_theme_1: 'dark',
      tama_theme_1: 'light',
    });

    migrateLegacyStorage(storage);

    expect(storage.toObject()).toEqual({ tama_theme_1: 'light' });
  });
});
