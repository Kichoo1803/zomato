import { useEffect, useState } from "react";

export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQuery.addEventListener("change", onChange);
    setMatches(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, [query]);

  return matches;
};
