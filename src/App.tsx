import { createSignal, For, Show, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Search, X, User } from "lucide-solid";

import type { Game, VndbSearchResult, VndbVnDetail, VndbCharacter, VndbUserListItem, AppSettings, VndbImage } from "./types";
import { useLibraryFilters } from "./hooks/useLibraryFilters";

import { Library } from "./views/Library";
import { Detail } from "./views/Detail";
import { TitleBar } from "./components/TitleBar";

function App() {
  const [games, setGames] = createSignal<Game[]>([]);
  const [settings, setSettings] = createSignal<AppSettings>({ vndb_token: null, vndb_user_id: null, blur_nsfw: false });
  const [loading, setLoading] = createSignal(false);
  const [runningGame, setRunningGame] = createSignal<string | null>(null);
  const [authUser, setAuthUser] = createSignal<string | null>(null);

  const [page, setPage] = createSignal<"library" | "detail" | "detail-info" | "detail-chars">("library");
  const [currentGame, setCurrentGame] = createSignal<Game | null>(null);

  const [showSettings, setShowSettings] = createSignal(false);
  const [searchModal, setSearchModal] = createSignal<Game | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<VndbSearchResult[]>([]);
  const [searching, setSearching] = createSignal(false);

  const [vnDetail, setVnDetail] = createSignal<VndbVnDetail | null>(null);
  const [characters, setCharacters] = createSignal<VndbCharacter[]>([]);
  const [userVn, setUserVn] = createSignal<VndbUserListItem | null>(null);
  const [showSpoilers, setShowSpoilers] = createSignal(false);
  const [tokenInput, setTokenInput] = createSignal("");
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  // Library filters hook
  const libraryFilters = useLibraryFilters(games);

  const loadGames = async () => {
    const [gamesData, running] = await Promise.all([
      invoke<Game[]>("get_all_games"),
      invoke<string | null>("poll_running_game")
    ]);
    setGames(gamesData);
    setRunningGame(running);
  };
  const loadSettings = async () => {
    const s = await invoke<AppSettings>("get_settings");
    setSettings(s);
    // Defer auth check - don't block UI
    if (s.vndb_token) {
      invoke<{ username: string }>("vndb_auth_check")
        .then(r => setAuthUser(r.username))
        .catch(() => setAuthUser(null));
    }
  };

  const saveToken = async () => { if (!tokenInput()) return; await invoke("save_vndb_token", { token: tokenInput() }); await loadSettings(); setTokenInput(""); };
  const clearToken = async () => { await invoke("clear_vndb_token"); setAuthUser(null); await loadSettings(); };
  const toggleBlurNsfw = async () => { await invoke("set_blur_nsfw", { blur: !settings().blur_nsfw }); await loadSettings(); };
  const addGame = async () => { const sel = await open({ multiple: false, filters: [{ name: "Executable", extensions: ["exe"] }] }); if (sel) { setLoading(true); const g = await invoke<Game>("add_local_game", { path: sel }); await loadGames(); setLoading(false); setSearchModal(g); setSearchQuery(g.title); } };
  const launchGame = async (id: string) => { await invoke("launch_game", { id }); setRunningGame(id); };
  const stopTracking = async () => { await invoke("stop_tracking"); setRunningGame(null); await loadGames(); };
  const removeGame = async (id: string) => { await invoke("remove_game", { id }); await loadGames(); };
  const hideGame = async (id: string, hidden: boolean) => { await invoke("set_game_hidden", { id, hidden }); await loadGames(); };
  const searchVndb = async () => {
    const query = searchQuery().trim();
    if (!query) return;
    setSearching(true);
    const results = await invoke<VndbSearchResult[]>("search_vndb", { query });
    // Only update if query hasn't changed during the request
    if (searchQuery().trim() === query) {
      setSearchResults(results);
    }
    setSearching(false);
  };

  // Debounced search: auto-search 300ms after user stops typing
  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchDebounceTimer);
    if (value.trim()) {
      searchDebounceTimer = setTimeout(searchVndb, 300);
    } else {
      setSearchResults([]);
    }
  };
  onCleanup(() => clearTimeout(searchDebounceTimer));
  const linkVndb = async (vndb: VndbSearchResult) => { const g = searchModal(); if (!g) return; await invoke("update_game", { game: { ...g, title: vndb.title, vndb_id: vndb.id, cover_url: vndb.image?.url || null } }); await loadGames(); setSearchModal(null); setSearchResults([]); setSearchQuery(""); };

  const openDetail = async (game: Game, forceRefresh = false) => {
    if (!game.vndb_id) return;
    setCurrentGame(game); setPage("detail"); setShowSpoilers(false);
    const [d, c] = await Promise.all([
      invoke<VndbVnDetail>("fetch_vndb_detail", { vndbId: game.vndb_id, forceRefresh }),
      invoke<VndbCharacter[]>("fetch_vndb_characters", { vndbId: game.vndb_id, forceRefresh })
    ]);
    setVnDetail(d); setCharacters(c);
    if (settings().vndb_token) { try { setUserVn(await invoke<VndbUserListItem | null>("vndb_get_user_vn", { vndbId: game.vndb_id })); } catch { setUserVn(null); } }
  };

  const refreshDetail = async () => {
    const g = currentGame();
    if (!g) return;
    setIsRefreshing(true);
    try {
      await openDetail(g, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const goBack = () => { setPage("library"); setCurrentGame(null); setVnDetail(null); setCharacters([]); setUserVn(null); };
  const setStatus = async (labelId: number) => { const g = currentGame(); if (!g?.vndb_id) return; await invoke("vndb_set_status", { vndbId: g.vndb_id, labelId }); setUserVn(await invoke<VndbUserListItem | null>("vndb_get_user_vn", { vndbId: g.vndb_id })); };
  const setVote = async (vote: number) => { const g = currentGame(); if (!g?.vndb_id) return; await invoke("vndb_set_vote", { vndbId: g.vndb_id, vote }); setUserVn(await invoke<VndbUserListItem | null>("vndb_get_user_vn", { vndbId: g.vndb_id })); };

  // Blur NSFW: sexual >= 1 (Suggestive, Explicit) or violence >= 1 (Violent, Brutal)
  const shouldBlur = (img: VndbImage | null): boolean => !!(settings().blur_nsfw && img && (img.sexual >= 1 || img.violence >= 1));
  const formatPlayTime = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  const formatLastPlayed = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  // Listen for game-exited event from backend (replaces polling)
  let unlistenGameExited: (() => void) | undefined;
  listen<{ game_id: string; play_minutes: number }>("game-exited", async (event) => {
    console.log("Game exited:", event.payload);
    setRunningGame(null);
    await loadGames(); // Refresh to show updated playtime
  }).then(unlisten => { unlistenGameExited = unlisten; });
  onCleanup(() => unlistenGameExited?.());

  // Fast startup - init backend cache, then load data in parallel
  invoke("init_app"); // Fire and forget - pre-init cache db
  Promise.all([loadGames(), loadSettings()]);

  return (
    <div class="h-screen flex flex-col bg-[#0F172A]">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Main Content Area */}
      <div class="flex-1 overflow-hidden relative">
        {/* Library View */}
        <Show when={page() === "library"}>
          <Library
            games={games()}
            filteredGames={libraryFilters.filteredGames()}
            runningGame={runningGame()}
            loading={loading()}
            authUser={authUser()}
            searchQuery={libraryFilters.searchQuery()}
            onSearchChange={libraryFilters.setSearchQuery}
            sortBy={libraryFilters.sortBy()}
            onSortByChange={libraryFilters.setSortBy}
            sortOrder={libraryFilters.sortOrder()}
            onSortOrderChange={libraryFilters.setSortOrder}
            showHidden={libraryFilters.showHidden()}
            onShowHiddenChange={libraryFilters.setShowHidden}
            formatPlayTime={formatPlayTime}
            onAddGame={addGame}
            onStopTracking={stopTracking}
            onLaunchGame={launchGame}
            onRemoveGame={removeGame}
            onSearchGame={(g) => { setSearchModal(g); setSearchQuery(g.title); }}
            onOpenDetail={openDetail}
            onHideGame={hideGame}
            onSettings={() => setShowSettings(true)}
          />
        </Show>

        {/* Detail View */}
        <Show when={page().startsWith("detail") && vnDetail() && currentGame()}>
          <Detail
            page={page() as "detail" | "detail-chars"}
            setPage={(p) => setPage(p)}
            game={currentGame()!}
            vnDetail={vnDetail()!}
            characters={characters()}
            userVn={userVn()}
            runningGame={runningGame()}
            settings={settings()}
            showSpoilers={showSpoilers()}
            setShowSpoilers={setShowSpoilers}
            isRefreshing={isRefreshing()}
            onBack={goBack}
            onRefresh={refreshDetail}
            onSettings={() => setShowSettings(true)}
            onLaunchGame={launchGame}
            onSetStatus={setStatus}
            onSetVote={setVote}
            formatPlayTime={formatPlayTime}
            formatLastPlayed={formatLastPlayed}
            shouldBlur={shouldBlur}
          />
        </Show>
      </div>

      {/* Settings Modal */}
      <Show when={showSettings()}>
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowSettings(false)}>
          <div class="bg-slate-800 rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between p-3 border-b border-slate-700"><h2 class="text-lg font-bold text-white">Settings</h2><button onClick={() => setShowSettings(false)} class="text-gray-400 hover:text-white"><X class="w-5 h-5" /></button></div>
            <div class="p-4 space-y-4">
              <div>
                <label class="text-sm text-gray-300 mb-1 block">VNDB API Token</label>
                <Show when={authUser()} fallback={<div class="flex gap-2"><input type="password" value={tokenInput()} onInput={(e) => setTokenInput(e.currentTarget.value)} placeholder="Enter token..." class="flex-1 px-3 py-1.5 bg-slate-700 rounded text-white text-sm" /><button onClick={saveToken} class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm">Save</button></div>}>
                  <div class="flex items-center justify-between bg-slate-700 px-3 py-2 rounded"><span class="text-white flex items-center gap-2"><User class="w-4 h-4" /> {authUser()}</span><button onClick={clearToken} class="text-red-400 hover:text-red-300 text-sm">Logout</button></div>
                </Show>
                <p class="text-xs text-gray-500 mt-1">Get token from vndb.org/u/tokens</p>
              </div>
              <div class="flex items-center justify-between"><span class="text-sm text-gray-300">Blur NSFW Content</span><button onClick={toggleBlurNsfw} class={`w-10 h-5 rounded-full transition-colors ${settings().blur_nsfw ? "bg-purple-600" : "bg-slate-600"}`}><div class={`w-4 h-4 bg-white rounded-full transition-transform ${settings().blur_nsfw ? "translate-x-5" : "translate-x-0.5"}`} /></button></div>
              <div class="pt-2 border-t border-slate-700">
                <button onClick={async () => { await invoke("clear_all_cache"); alert("Cache cleared!"); }} class="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-gray-300">Clear VNDB Cache</button>
                <p class="text-xs text-gray-500 mt-1">Remove all cached VN and character data</p>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Search Modal */}
      <Show when={searchModal()}>
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div class="bg-slate-800 rounded-lg w-full max-w-lg max-h-[70vh] overflow-hidden">
            <div class="flex items-center justify-between p-3 border-b border-slate-700"><h2 class="text-lg font-bold text-white">Link to VNDB</h2><button onClick={() => { setSearchModal(null); setSearchResults([]); setSearchQuery(""); }} class="text-gray-400 hover:text-white"><X class="w-5 h-5" /></button></div>
            <div class="p-3">
              <div class="flex gap-2 mb-3"><input type="text" value={searchQuery()} onInput={(e) => handleSearchInput(e.currentTarget.value)} onKeyPress={(e) => e.key === "Enter" && searchVndb()} placeholder="Search..." class="flex-1 px-3 py-1.5 bg-slate-700 rounded text-white text-sm" /><button onClick={searchVndb} disabled={searching()} class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white"><Search class="w-4 h-4" /></button></div>
              <div class="overflow-y-auto max-h-80 space-y-1">
                <Show when={searching()}><p class="text-gray-400 text-center py-3 text-sm">Searching...</p></Show>
                <For each={searchResults()}>{(r) => (<button onClick={() => linkVndb(r)} class="w-full flex items-center gap-2 p-2 bg-slate-700 hover:bg-slate-600 rounded text-left"><div class="w-10 h-14 bg-slate-600 rounded overflow-hidden flex-shrink-0"><Show when={r.image?.url}><img src={r.image!.url} alt={r.title} class={`w-full h-full object-cover ${shouldBlur(r.image) ? "blur-lg" : ""}`} /></Show></div><div class="flex-1 min-w-0"><h4 class="text-white text-sm font-medium truncate">{r.title}</h4><p class="text-xs text-gray-400">{r.id}{r.released && ` • ${r.released}`}{r.rating && ` • ${(r.rating / 10).toFixed(1)}`}</p></div></button>)}</For>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default App;

