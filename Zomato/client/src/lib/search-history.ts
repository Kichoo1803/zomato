const RECENT_SEARCHES_STORAGE_KEY = "zomato-luxe-recent-searches";
const MAX_RECENT_SEARCHES = 6;

const normalizeSearchValue = (value: string) => value.trim();

const readStoredSearches = () => {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const rawValue = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((value): value is string => typeof value === "string")
      .map(normalizeSearchValue)
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
};

const writeStoredSearches = (values: string[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(values));
};

export const readRecentSearches = () => readStoredSearches();

export const addRecentSearch = (value: string) => {
  const normalizedValue = normalizeSearchValue(value);
  if (!normalizedValue) {
    return readStoredSearches();
  }

  const nextValues = [
    normalizedValue,
    ...readStoredSearches().filter(
      (existingValue) => existingValue.toLowerCase() !== normalizedValue.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT_SEARCHES);

  writeStoredSearches(nextValues);
  return nextValues;
};

export const removeRecentSearch = (value: string) => {
  const normalizedValue = normalizeSearchValue(value);
  const nextValues = readStoredSearches().filter(
    (existingValue) => existingValue.toLowerCase() !== normalizedValue.toLowerCase(),
  );
  writeStoredSearches(nextValues);
  return nextValues;
};

export const clearRecentSearches = () => {
  writeStoredSearches([]);
  return [];
};
