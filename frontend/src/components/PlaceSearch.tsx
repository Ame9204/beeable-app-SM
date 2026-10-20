import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { distanceM } from "../hooks/useLocation";
import { PLACE_TYPE_LABEL, keyPlaces, recentPlaces, searchPlaces, type Place } from "../places";
import { Icon, POI_ICON } from "./Icon";

interface Group {
  label: string;
  places: Place[];
}

/**
 * Destination search: a combobox (ARIA 1.2 pattern). Empty: recent places + the nearest key places.
 * Typing: matches by name, word start or kind of place ("clinic", "makan", "surau").
 */
export function PlaceSearch({
  from,
  onPick,
}: {
  /** User position, for distances and to rank the nearest first; null if unknown. */
  from: [number, number] | null;
  onPick: (p: Place) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);

  const groups: Group[] = useMemo(() => {
    if (query.trim()) return [{ label: "Places", places: searchPlaces(query, from) }];
    const recent = recentPlaces();
    const key = keyPlaces(from).filter((p) => !recent.some((r) => r.id === p.id));
    return [
      ...(recent.length ? [{ label: "Recent", places: recent }] : []),
      { label: from ? "Nearby key places" : "Key places", places: key },
    ];
  }, [query, from]);
  const flat = groups.flatMap((g) => g.places);
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  function pick(p: Place) {
    setQuery("");
    setActive(-1);
    onPick(p);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      const p = flat[active] ?? (query.trim() ? flat[0] : undefined);
      if (p) {
        e.preventDefault();
        pick(p);
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setActive(-1);
    }
  }

  let index = -1;
  return (
    <div className="place-search">
      <label htmlFor={`${id}-input`} className="visually-hidden">
        Search for a place
      </label>
      <div className="search-field">
        <Icon name="search" className="search-icon" />
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          placeholder="Where to? Try “clinic” or “Perpustakaan”"
          value={query}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
          }}
          onKeyDown={onKey}
        />
        {query && (
          <button type="button" className="icon-button search-clear" onClick={() => setQuery("")} aria-label="Clear search">
            <Icon name="x" size={20} />
          </button>
        )}
      </div>

      <div id={listId} role="listbox" aria-label="Suggestions" className="suggestions">
        {flat.length === 0 && (
          <p className="muted small-text no-results" role="status">
            No campus places match “{query}”. Try the building name or what it is, e.g. “library”.
          </p>
        )}
        {groups.map((g) =>
          g.places.length ? (
            <div key={g.label} role="group" aria-label={g.label}>
              <p className="list-heading" aria-hidden="true">
                {g.label === "Recent" && <Icon name="refresh" size={16} />} {g.label}
              </p>
              {g.places.map((p) => {
                index += 1;
                const i = index;
                const d = from ? Math.round(distanceM(from, [p.lat, p.lng])) : null;
                return (
                  <div
                    key={`${g.label}-${p.id}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    className={`dest${i === active ? " dest-active" : ""}`}
                    onClick={() => pick(p)}
                    onMouseMove={() => setActive(i)}
                  >
                    <span className="dest-icon">
                      <Icon name={POI_ICON[p.type] ?? "pin"} />
                    </span>
                    <span className="dest-text">
                      <span className="dest-name">{p.name}</span>
                      <span className="dest-meta">
                        {PLACE_TYPE_LABEL[p.type]}
                        {d !== null && ` · ${d} m away`}
                      </span>
                    </span>
                    <Icon name="chevronRight" className="dest-go" />
                  </div>
                );
              })}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
