import { createSignal, createMemo, Accessor } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import type { Game } from "../types";

export type SortBy = "title" | "lastPlayed";
export type SortOrder = "asc" | "desc";

export interface LibraryFilters {
    searchQuery: Accessor<string>;
    setSearchQuery: (q: string) => void;
    sortBy: Accessor<SortBy>;
    setSortBy: (s: SortBy) => void;
    sortOrder: Accessor<SortOrder>;
    setSortOrder: (o: SortOrder) => void;
    showHidden: Accessor<boolean>;
    setShowHidden: (v: boolean) => void;
    filteredGames: Accessor<Game[]>;
}

/**
 * Custom hook for library filtering, sorting, and searching.
 * Uses memoization for performance and persists preferences to localStorage.
 */
export function useLibraryFilters(games: Accessor<Game[]>): LibraryFilters {
    // Search query (not persisted - clears on app restart)
    const [searchQuery, setSearchQuery] = createSignal("");

    // Persisted preferences
    const [sortBy, setSortBy] = makePersisted(createSignal<SortBy>("title"), { name: "library-sort-by" });
    const [sortOrder, setSortOrder] = makePersisted(createSignal<SortOrder>("asc"), { name: "library-sort-order" });
    const [showHidden, setShowHidden] = makePersisted(createSignal(false), { name: "library-show-hidden" });

    // Memoized filtered and sorted games
    const filteredGames = createMemo(() => {
        let result = games();

        // Filter hidden games
        if (!showHidden()) {
            result = result.filter(g => !g.is_hidden);
        }

        // Filter by search query
        const query = searchQuery().toLowerCase().trim();
        if (query) {
            result = result.filter(g =>
                g.title.toLowerCase().includes(query)
            );
        }

        // Sort
        result = [...result].sort((a, b) => {
            let cmp = 0;
            if (sortBy() === "title") {
                cmp = a.title.localeCompare(b.title);
            } else if (sortBy() === "lastPlayed") {
                // Null last_played goes to the end
                const aTime = a.last_played ? new Date(a.last_played).getTime() : 0;
                const bTime = b.last_played ? new Date(b.last_played).getTime() : 0;
                cmp = bTime - aTime; // Default: most recent first
            }
            return sortOrder() === "desc" ? -cmp : cmp;
        });

        return result;
    });

    return {
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        showHidden,
        setShowHidden,
        filteredGames,
    };
}
