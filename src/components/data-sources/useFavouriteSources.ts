import { useCallback, useState } from 'react';

// Shared "favourite data sources" store. Both upload modals (DataPickerModal +
// the workflow-builder UploadDataModal) read/write the same key, so a source
// starred in one shows up favourited in the other and across reloads.
const FAVS_KEY = 'irame.datasource.favourites.v1';

function readFavs(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/** Favourited source ids + a toggle that persists to localStorage. */
export function useFavouriteSources() {
  const [favs, setFavs] = useState<Set<string>>(() => readFavs());
  const toggleFav = useCallback((id: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(FAVS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { favs, toggleFav };
}
