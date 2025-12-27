import { Show, For, createSignal, createEffect, onCleanup } from "solid-js";
import {
  Plus,
  Gamepad2,
  Clock,
  Settings,
  Search,
  LayoutGrid,
  List,
  Library as LibraryIcon,
  ChevronDown,
  Filter,
  User,
  Check,
} from "lucide-solid";
import { GameCard } from "../components/GameCard";
import type { Game } from "../types";
import type { SortBy, SortOrder } from "../hooks/useLibraryFilters";

interface LibraryProps {
  games: Game[];
  filteredGames: Game[];
  runningGame: string | null;
  loading: boolean;
  authUser: string | null;
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
  const [viewMode, setViewMode] = createSignal<"grid" | "list">("grid");
  const [showSortDropdown, setShowSortDropdown] = createSignal(false);
  const [showFiltersDropdown, setShowFiltersDropdown] = createSignal(false);
  const [activeContextMenu, setActiveContextMenu] = createSignal<string | null>(
    null,
  );

  // Close dropdowns when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".sort-dropdown")) {
      setShowSortDropdown(false);
    }
    if (!target.closest(".filters-dropdown")) {
      setShowFiltersDropdown(false);
    }
  };

  createEffect(() => {
    window.addEventListener("click", handleClickOutside);
    onCleanup(() => window.removeEventListener("click", handleClickOutside));
  });

  const sortOptions = [
    { value: "lastPlayed", label: "Last played" },
    { value: "playTime", label: "Most played" },
    { value: "title", label: "Name" },
  ];

  const getSortLabel = () => {
    return (
      sortOptions.find((o) => o.value === props.sortBy)?.label || "Last played"
    );
  };

  const handleContextMenuOpen = (gameId: string) => {
    setActiveContextMenu(gameId);
  };

  return (
    <div class="flex h-full bg-[#0F172A] text-slate-200 overflow-hidden font-['Figtree']">
      {/* Sidebar */}
      <aside class="w-64 bg-[#0F172A]/95 flex flex-col border-r border-slate-800/50">
        <div class="p-6 flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Gamepad2 class="w-6 h-6 text-white" />
          </div>
          <h1 class="font-bold text-xl text-white tracking-tight">
            Alka Launcher
          </h1>
        </div>

        <div class="flex-1 overflow-y-auto px-4 custom-scrollbar">
          <div class="mb-6">
            <h3 class="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Library
            </h3>
            <nav class="space-y-1">
              <button class="w-full flex items-center gap-3 px-4 py-2.5 bg-[#1E293B] text-white rounded-xl transition-all shadow-sm">
                <LibraryIcon class="w-5 h-5 text-green-400" />
                <span class="font-medium">My Games</span>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main class="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-[#0F172A] to-[#1E293B]">
        {/* Header */}
        <header class="h-20 px-8 flex items-center justify-between gap-8 border-b border-white/5">
          <h2 class="text-2xl font-bold text-white">Overview</h2>

          {/* Search Bar */}
          <div class="flex-1 max-w-xl relative group">
            <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              value={props.searchQuery}
              onInput={(e) => props.onSearchChange(e.currentTarget.value)}
              placeholder="Search game titles..."
              class="w-full pl-12 pr-4 py-3 bg-[#1E293B] border border-slate-700/50 rounded-2xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-[#1E293B]/80 transition-all font-medium"
            />
          </div>

          {/* Right Actions */}
          <div class="flex items-center gap-4">
            {/* VNDB Username */}
            <Show when={props.authUser}>
              <div class="flex items-center gap-2 px-3 py-1.5 bg-[#1E293B] border border-slate-700/50 rounded-xl">
                <User class="w-4 h-4 text-blue-400" />
                <span class="text-sm font-medium text-slate-300">
                  {props.authUser}
                </span>
              </div>
            </Show>

            <div class="flex items-center gap-3 pl-4 border-l border-white/10">
              <Show when={props.runningGame}>
                <button
                  onClick={props.onStopTracking}
                  class="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-all"
                >
                  <Clock class="w-4 h-4 animate-pulse" />
                  <span class="text-sm font-bold">Stop Game</span>
                </button>
              </Show>

              <button
                onClick={props.onAddGame}
                class="p-2.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all relative group"
                title="Add Game"
              >
                <Plus class="w-5 h-5" />
                <span class="absolute top-full right-0 mt-2 px-2 py-1 bg-black text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  Add Game
                </span>
              </button>

              <button
                onClick={props.onSettings}
                class="p-2.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all"
              >
                <Settings class="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Toolbar */}
        <div class="px-8 py-6 flex flex-col gap-6">
          <div class="flex items-center justify-between">
            {/* Title with Count */}
            <div class="flex items-center gap-2">
              <span class="text-white font-medium">All Games</span>
              <span class="text-slate-500">({props.games.length})</span>
            </div>

            {/* Sort & Filter */}
            <div class="flex items-center gap-4">
              {/* Sort Dropdown */}
              <div class="sort-dropdown relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSortDropdown(!showSortDropdown());
                    setShowFiltersDropdown(false);
                  }}
                  class="flex items-center gap-2 px-3 py-2 bg-[#1E293B] border border-slate-700/50 rounded-xl text-sm hover:border-slate-600 transition-colors"
                >
                  <span class="text-slate-400">Sort by</span>
                  <span class="text-white font-medium">{getSortLabel()}</span>
                  <ChevronDown
                    class={`w-4 h-4 text-slate-400 transition-transform ${showSortDropdown() ? "rotate-180" : ""}`}
                  />
                </button>

                <Show when={showSortDropdown()}>
                  <div class="absolute top-full right-0 mt-2 bg-[#1E293B] border border-slate-700/50 rounded-xl shadow-xl overflow-hidden min-w-[160px] z-50">
                    <For each={sortOptions}>
                      {(option) => (
                        <button
                          onClick={() => {
                            props.onSortByChange(option.value as SortBy);
                            setShowSortDropdown(false);
                          }}
                          class={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-[#334155] transition-colors ${
                            props.sortBy === option.value
                              ? "text-white"
                              : "text-slate-400"
                          }`}
                        >
                          <span>{option.label}</span>
                          <Show when={props.sortBy === option.value}>
                            <Check class="w-4 h-4 text-green-400" />
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              {/* Filters Dropdown */}
              <div class="filters-dropdown relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFiltersDropdown(!showFiltersDropdown());
                    setShowSortDropdown(false);
                  }}
                  class={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-colors ${
                    props.showHidden
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                      : "bg-[#1E293B] border-slate-700/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Filter class="w-4 h-4" />
                  <span>Filters</span>
                  <ChevronDown
                    class={`w-4 h-4 transition-transform ${showFiltersDropdown() ? "rotate-180" : ""}`}
                  />
                </button>

                <Show when={showFiltersDropdown()}>
                  <div class="absolute top-full right-0 mt-2 bg-[#1E293B] border border-slate-700/50 rounded-xl shadow-xl overflow-hidden min-w-[200px] z-50">
                    <label class="flex items-center gap-3 px-4 py-3 hover:bg-[#334155] cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={props.showHidden}
                        onChange={(e) =>
                          props.onShowHiddenChange(e.currentTarget.checked)
                        }
                        class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span class="text-sm text-slate-300">
                        Show Hidden Games
                      </span>
                    </label>
                  </div>
                </Show>
              </div>

              <div class="h-4 w-px bg-slate-700"></div>

              {/* Grid/List Toggle */}
              <div class="flex gap-1 bg-[#1E293B] border border-slate-700/50 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  class={`p-1.5 rounded transition-colors ${
                    viewMode() === "grid"
                      ? "text-white bg-slate-700/50"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <LayoutGrid class="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  class={`p-1.5 rounded transition-colors ${
                    viewMode() === "list"
                      ? "text-white bg-slate-700/50"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <List class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Game Grid/List */}
        <div class="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          <Show
            when={props.filteredGames.length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl">
                <Gamepad2 class="w-12 h-12 mb-3 opacity-20" />
                <p>No games found in this category.</p>
                <button
                  onClick={props.onAddGame}
                  class="mt-4 text-blue-400 hover:text-blue-300 font-medium"
                >
                  Add your first game
                </button>
              </div>
            }
          >
            <Show
              when={viewMode() === "grid"}
              fallback={
                // List View
                <div class="flex flex-col gap-2">
                  <For each={props.filteredGames}>
                    {(game) => (
                      <div
                        class={`group flex items-center gap-4 p-3 bg-[#1E293B] rounded-xl border border-transparent hover:border-blue-500/50 cursor-pointer transition-all ${
                          game.is_hidden && props.showHidden ? "opacity-50" : ""
                        } ${props.runningGame === game.id ? "ring-2 ring-green-500" : ""}`}
                        onClick={() =>
                          game.vndb_id
                            ? props.onOpenDetail(game)
                            : props.onSearchGame(game)
                        }
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleContextMenuOpen(game.id);
                        }}
                      >
                        {/* Cover */}
                        <div class="w-16 h-22 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                          <Show
                            when={game.cover_url}
                            fallback={
                              <div class="w-full h-full flex items-center justify-center">
                                <Gamepad2 class="w-6 h-6 text-slate-600" />
                              </div>
                            }
                          >
                            <img
                              src={game.cover_url!}
                              alt={game.title}
                              class="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </Show>
                        </div>

                        {/* Info */}
                        <div class="flex-1 min-w-0">
                          <h3 class="text-white font-medium truncate">
                            {game.title}
                          </h3>
                          <p class="text-sm text-slate-500">
                            {props.formatPlayTime(game.play_time)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Show when={props.runningGame === game.id}>
                            <span class="px-2 py-1 bg-green-500 text-black text-xs font-bold rounded animate-pulse">
                              RUNNING
                            </span>
                          </Show>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onLaunchGame(game.id);
                            }}
                            class="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-slate-200 transition-colors"
                          >
                            Play
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              }
            >
              {/* Grid View */}
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
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
                      onClick={(g) =>
                        g.vndb_id
                          ? props.onOpenDetail(g)
                          : props.onSearchGame(g)
                      }
                      onHide={props.onHideGame}
                      activeContextMenu={activeContextMenu()}
                      onContextMenuOpen={handleContextMenuOpen}
                    />
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </main>
    </div>
  );
}

// Add these styles to global CSS (already using Tailwind)
// .custom-scrollbar implementation is in index.css
