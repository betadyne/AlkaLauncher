import { createSignal, createMemo, Accessor } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import type { Game } from "../types";

export type SortBy = "title" | "lastPlayed" | "playTime";
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

export function useLibraryFilters(games: Accessor<Game[]>): LibraryFilters {
    const [searchQuery, setSearchQuery] = createSignal("");

    const [sortBy, setSortBy] = makePersisted(createSignal<SortBy>("title"), { name: "library-sort-by" });
    const [sortOrder, setSortOrder] = makePersisted(createSignal<SortOrder>("asc"), { name: "library-sort-order" });
    const [showHidden, setShowHidden] = makePersisted(createSignal(false), { name: "library-show-hidden" });

    const filteredGames = createMemo(() => {
        let result = games();

        if (!showHidden()) {
            result = result.filter(g => !g.is_hidden);
        }

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
                const aTime = a.last_played ? new Date(a.last_played).getTime() : 0;
                const bTime = b.last_played ? new Date(b.last_played).getTime() : 0;
                cmp = bTime - aTime;
            } else if (sortBy() === "playTime") {
                cmp = b.play_time - a.play_time;
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
