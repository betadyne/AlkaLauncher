import { Show, For } from "solid-js";
import { Plus, Gamepad2, Clock, Settings } from "lucide-solid";
import { GameCard } from "../components/GameCard";
import { LibraryToolbar } from "../components/LibraryToolbar";
import type { Game } from "../types";
import type { SortBy, SortOrder } from "../hooks/useLibraryFilters";

interface LibraryProps {
    games: Game[];
    filteredGames: Game[];
    runningGame: string | null;
    loading: boolean;
    // Filter props
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortBy: SortBy;
    onSortByChange: (s: SortBy) => void;
    sortOrder: SortOrder;
    onSortOrderChange: (o: SortOrder) => void;
    showHidden: boolean;
    onShowHiddenChange: (v: boolean) => void;
    // Action props
    formatPlayTime: (m: number) => string;
    onAddGame: () => void;
    onStopTracking: () => void;
    onLaunchGame: (id: string) => void;
    onRemoveGame: (id: string) => void;
    onSearchGame: (game: Game) => void;
    onOpenDetail: (game: Game) => void;
    onHideGame: (id: string, hidden: boolean) => void;
    onSettings: () => void;
}

export function Library(props: LibraryProps) {
    return (
        <div class="p-4">
            <header class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                    <Gamepad2 class="w-7 h-7 text-purple-400" />
                    <h1 class="text-2xl font-bold text-white">Alka Launcher</h1>
                </div>
                <div class="flex items-center gap-2">
                    <Show when={props.runningGame}>
                        <button
                            onClick={props.onStopTracking}
                            class="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                        >
                            <Clock class="w-4 h-4" /> Stop
                        </button>
                    </Show>
                    <button
                        onClick={props.onSettings}
                        class="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
                    >
                        <Settings class="w-5 h-5" />
                    </button>
                    <button
                        onClick={props.onAddGame}
                        disabled={props.loading}
                        class="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white text-sm"
                    >
                        <Plus class="w-4 h-4" /> Add
                    </button>
                </div>
            </header>

            {/* Toolbar with search, sort, and filter */}
            <LibraryToolbar
                searchQuery={props.searchQuery}
                onSearchChange={props.onSearchChange}
                sortBy={props.sortBy}
                onSortByChange={props.onSortByChange}
                sortOrder={props.sortOrder}
                onSortOrderChange={props.onSortOrderChange}
                showHidden={props.showHidden}
                onShowHiddenChange={props.onShowHiddenChange}
            />

            <Show
                when={props.games.length > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center h-80 text-gray-400">
                        <Gamepad2 class="w-12 h-12 mb-3 opacity-50" />
                        <p>No games. Click "Add" to start.</p>
                    </div>
                }
            >
                <Show
                    when={props.filteredGames.length > 0}
                    fallback={
                        <div class="flex flex-col items-center justify-center h-60 text-gray-400">
                            <p>No games match your filters.</p>
                        </div>
                    }
                >
                    <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        <For each={props.filteredGames}>
                            {(game) => (
                                <GameCard
                                    game={game}
                                    isRunning={props.runningGame === game.id}
                                    showHidden={props.showHidden}
                                    formatPlayTime={props.formatPlayTime}
                                    onPlay={props.onLaunchGame}
                                    onRemove={props.onRemoveGame}
                                    onSearch={props.onSearchGame}
                                    onClick={(g) => g.vndb_id ? props.onOpenDetail(g) : props.onSearchGame(g)}
                                    onHide={props.onHideGame}
                                />
                            )}
                        </For>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
