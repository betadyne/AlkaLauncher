import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { Router, Route, useNavigate, useParams } from "@solidjs/router";
import { open } from "@tauri-apps/plugin-dialog";
import { Search, X, User, RefreshCw } from "lucide-solid";

import type { VndbImage, VndbSearchResult } from "./bindings";
import { useLibraryFilters } from "./hooks/useLibraryFilters";
import { useUpdater } from "./hooks/useUpdater";

import { GameProvider, SettingsProvider, VndbProvider, useGame, useSettings, useVndb } from "./context";
import { Library } from "./views/Library";
import { Detail } from "./views/Detail";
import { TitleBar } from "./components/TitleBar";
import { UpdateDialog } from "./components/UpdateDialog";
import * as api from "./api";

function LibraryPage() {
  const game = useGame();
  const settings = useSettings();
  const vndb = useVndb();
  const navigate = useNavigate();

  const [showSettings, setShowSettings] = createSignal(false);
  const [searchModal, setSearchModal] = createSignal<{ id: string; title: string } | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [tokenInput, setTokenInput] = createSignal("");

  const libraryFilters = useLibraryFilters(() => game.games());
  const updater = useUpdater();

  const addGame = async () => {
    const sel = await open({
      multiple: false,
      filters: [{ name: "Executable", extensions: ["exe"] }],
    });
    if (sel) {
      const g = await game.addGame(sel as string);
      if (g) {
        setSearchModal({ id: g.id, title: g.title });
        setSearchQuery(g.title);
      }
    }
  };

  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchDebounceTimer);
    if (value.trim()) {
      searchDebounceTimer = setTimeout(() => vndb.searchVndb(value), 300);
    } else {
      vndb.clearSearch();
    }
  };
  onCleanup(() => clearTimeout(searchDebounceTimer));

  const linkVndb = async (vndbResult: VndbSearchResult) => {
    const modal = searchModal();
    if (!modal) return;
    const g = game.games().find((x) => x.id === modal.id);
    if (!g) return;
    await game.updateGame({
      ...g,
      title: vndbResult.title,
      vndb_id: vndbResult.id,
      cover_url: vndbResult.image?.url || null,
    });
    setSearchModal(null);
    vndb.clearSearch();
    setSearchQuery("");
  };

  const openDetail = (gameData: { id: string; vndb_id?: string | null }) => {
    if (!gameData.vndb_id) return;
    navigate(`/game/${gameData.id}`);
  };

  const shouldBlur = (img: VndbImage | null): boolean =>
    !!(settings.settings().blur_nsfw && img && (img.sexual >= 1 || img.violence >= 1));

  const formatPlayTime = (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  return (
    <>
      <Library
        games={game.games()}
        filteredGames={libraryFilters.filteredGames()}
        runningGame={game.runningGame()}
        loading={game.loading()}
        authUser={settings.authUser()}
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
        onStopTracking={game.stopTracking}
        onLaunchGame={game.launchGame}
        onRemoveGame={game.removeGame}
        onSearchGame={(g) => {
          setSearchModal({ id: g.id, title: g.title });
          setSearchQuery(g.title);
        }}
        onOpenDetail={openDetail}
        onHideGame={game.hideGame}
        onSettings={() => setShowSettings(true)}
      />

      {/* Settings Modal */}
      <Show when={showSettings()}>
        <SettingsModal
          tokenInput={tokenInput}
          setTokenInput={setTokenInput}
          updater={updater}
          onClose={() => setShowSettings(false)}
        />
      </Show>

      {/* Search Modal */}
      <Show when={searchModal()}>
        <SearchModal
          searchQuery={searchQuery}
          handleSearchInput={handleSearchInput}
          searchResults={vndb.searchResults}
          isSearching={vndb.isSearching}
          onSearch={() => vndb.searchVndb(searchQuery())}
          onLink={linkVndb}
          shouldBlur={shouldBlur}
          onClose={() => {
            setSearchModal(null);
            vndb.clearSearch();
            setSearchQuery("");
          }}
        />
      </Show>

      <UpdateDialog
        status={updater.status()}
        updateInfo={updater.updateInfo()}
        downloadProgress={updater.downloadProgress()}
        error={updater.error()}
        onDownload={updater.downloadAndInstall}
        onRestart={updater.restartApp}
        onDismiss={updater.dismissUpdate}
      />
    </>
  );
}

function DetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const game = useGame();
  const settings = useSettings();
  const vndb = useVndb();

  const [showSettings, setShowSettings] = createSignal(false);
  const [showSpoilers, setShowSpoilers] = createSignal(false);
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [tokenInput, setTokenInput] = createSignal("");
  const [currentTab, setCurrentTab] = createSignal<"detail" | "detail-chars">("detail");

  const updater = useUpdater();

  const currentGame = () => game.games().find((g) => g.id === params.id) || null;

  const loadDetail = async (forceRefresh = false) => {
    const g = currentGame();
    if (!g?.vndb_id) return;
    await Promise.all([
      vndb.fetchDetail(g.vndb_id, forceRefresh),
      vndb.fetchCharacters(g.vndb_id, forceRefresh),
    ]);
    if (settings.settings().vndb_token) {
      await vndb.fetchUserVn(g.vndb_id);
    }
  };

  onMount(() => {
    loadDetail();
  });

  const refreshDetail = async () => {
    setIsRefreshing(true);
    try {
      await loadDetail(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const goBack = () => {
    vndb.clearDetail();
    navigate("/");
  };

  const setStatus = async (labelId: number) => {
    const g = currentGame();
    if (!g?.vndb_id) return;
    await vndb.setStatus(g.vndb_id, labelId);
  };

  const setVote = async (vote: number) => {
    const g = currentGame();
    if (!g?.vndb_id) return;
    await vndb.setVote(g.vndb_id, vote);
  };

  const shouldBlur = (img: VndbImage | null): boolean =>
    !!(settings.settings().blur_nsfw && img && (img.sexual >= 1 || img.violence >= 1));

  const formatPlayTime = (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

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

  return (
    <>
      <Show when={vndb.vnDetail() && currentGame()} fallback={<div class="flex-1 flex items-center justify-center text-slate-400">Loading...</div>}>
        <Detail
          page={currentTab()}
          setPage={setCurrentTab}
          game={currentGame()!}
          vnDetail={vndb.vnDetail()!}
          characters={vndb.characters()}
          userVn={vndb.userVn()}
          runningGame={game.runningGame()}
          settings={settings.settings()}
          showSpoilers={showSpoilers()}
          setShowSpoilers={setShowSpoilers}
          isRefreshing={isRefreshing()}
          onBack={goBack}
          onRefresh={refreshDetail}
          onSettings={() => setShowSettings(true)}
          onLaunchGame={game.launchGame}
          onSetStatus={setStatus}
          onSetVote={setVote}
          formatPlayTime={formatPlayTime}
          formatLastPlayed={formatLastPlayed}
          shouldBlur={shouldBlur}
        />
      </Show>

      <Show when={showSettings()}>
        <SettingsModal
          tokenInput={tokenInput}
          setTokenInput={setTokenInput}
          updater={updater}
          onClose={() => setShowSettings(false)}
        />
      </Show>

      <UpdateDialog
        status={updater.status()}
        updateInfo={updater.updateInfo()}
        downloadProgress={updater.downloadProgress()}
        error={updater.error()}
        onDownload={updater.downloadAndInstall}
        onRestart={updater.restartApp}
        onDismiss={updater.dismissUpdate}
      />
    </>
  );
}

function SettingsModal(props: {
  tokenInput: () => string;
  setTokenInput: (v: string) => void;
  updater: ReturnType<typeof useUpdater>;
  onClose: () => void;
}) {
  const settings = useSettings();

  return (
    <div
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={props.onClose}
    >
      <div class="bg-slate-800 rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between p-3 border-b border-slate-700">
          <h2 class="text-lg font-bold text-white">Settings</h2>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="text-sm text-gray-300 mb-1 block">VNDB API Token</label>
            <Show
              when={settings.authUser()}
              fallback={
                <div class="flex gap-2">
                  <input
                    type="password"
                    value={props.tokenInput()}
                    onInput={(e) => props.setTokenInput(e.currentTarget.value)}
                    placeholder="Enter token..."
                    class="flex-1 px-3 py-1.5 bg-slate-700 rounded text-white text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (props.tokenInput()) {
                        await settings.saveToken(props.tokenInput());
                        props.setTokenInput("");
                      }
                    }}
                    class="px-3 py-1.5 bg-slate-50 hover:bg-slate-200 rounded text-black text-sm"
                  >
                    Save
                  </button>
                </div>
              }
            >
              <div class="flex items-center justify-between bg-slate-700 px-3 py-2 rounded">
                <span class="text-white flex items-center gap-2">
                  <User class="w-4 h-4" /> {settings.authUser()}
                </span>
                <button onClick={settings.clearToken} class="text-red-400 hover:text-red-300 text-sm">
                  Logout
                </button>
              </div>
            </Show>
            <p class="text-xs text-gray-500 mt-1">Get token from vndb.org/u/tokens</p>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-300">Blur NSFW Content</span>
            <button
              onClick={settings.toggleBlurNsfw}
              class={`w-10 h-5 rounded-full transition-colors ${settings.settings().blur_nsfw ? "bg-green-400" : "bg-slate-600"}`}
            >
              <div
                class={`w-4 h-4 bg-white rounded-full transition-transform ${settings.settings().blur_nsfw ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
          <div class="pt-2 border-t border-slate-700">
            <button
              onClick={async () => {
                await api.clearAllCache();
                alert("Cache cleared!");
              }}
              class="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-gray-300"
            >
              Clear VNDB Cache
            </button>
            <p class="text-xs text-gray-500 mt-1">Remove all cached VN and character data</p>
          </div>
          <div class="pt-2 border-t border-slate-700">
            <button
              onClick={() => props.updater.checkForUpdates(false)}
              disabled={props.updater.status() === "checking"}
              class="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-sm text-gray-300 flex items-center justify-center gap-2"
            >
              <RefreshCw class={`w-4 h-4 ${props.updater.status() === "checking" ? "animate-spin" : ""}`} />
              {props.updater.status() === "checking" ? "Checking..." : "Check for Updates"}
            </button>
            <p class="text-xs text-gray-500 mt-1">Current version: v{__APP_VERSION__}</p>
          </div>
          <div class="pt-2 border-t border-slate-700">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-300">Discord Rich Presence</span>
              <button
                onClick={settings.toggleDiscordRpc}
                class={`w-10 h-5 rounded-full transition-colors ${settings.settings().discord_rpc_enabled ? "bg-green-400" : "bg-slate-600"}`}
              >
                <div
                  class={`w-4 h-4 bg-white rounded-full transition-transform ${settings.settings().discord_rpc_enabled ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">Show currently playing game in Discord activity status</p>

            {/* Discord Buttons Settings */}
            <Show when={settings.settings().discord_rpc_enabled}>
              <div class="mt-3 pl-2 border-l-2 border-slate-600 space-y-2">
                <p class="text-xs text-gray-400 mb-2">
                  Buttons to show (max 2): {
                    [settings.settings().discord_btn_vndb_game, settings.settings().discord_btn_vndb_profile, settings.settings().discord_btn_github]
                      .filter(Boolean).length
                  }/2
                </p>

                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.settings().discord_btn_vndb_game ?? true}
                    onChange={(e) => {
                      const newValue = e.currentTarget.checked;
                      const profile = settings.settings().discord_btn_vndb_profile ?? false;
                      const github = settings.settings().discord_btn_github ?? false;
                      const count = [newValue, profile, github].filter(Boolean).length;
                      if (count <= 2) {
                        settings.updateDiscordButtons(newValue, profile, github);
                      } else {
                        e.currentTarget.checked = !newValue;
                      }
                    }}
                    class="w-4 h-4 rounded bg-slate-600 border-slate-500 text-sky-500 focus:ring-sky-500"
                  />
                  <span class="text-sm text-gray-300">View on VNDB</span>
                  <span class="text-xs text-gray-500">(game page)</span>
                </label>

                <label class={`flex items-center gap-2 ${settings.settings().vndb_token ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
                  <input
                    type="checkbox"
                    checked={settings.settings().discord_btn_vndb_profile ?? false}
                    disabled={!settings.settings().vndb_token}
                    onChange={(e) => {
                      const newValue = e.currentTarget.checked;
                      const vndbGame = settings.settings().discord_btn_vndb_game ?? true;
                      const github = settings.settings().discord_btn_github ?? false;
                      const count = [vndbGame, newValue, github].filter(Boolean).length;
                      if (count <= 2) {
                        settings.updateDiscordButtons(vndbGame, newValue, github);
                      } else {
                        e.currentTarget.checked = !newValue;
                      }
                    }}
                    class="w-4 h-4 rounded bg-slate-600 border-slate-500 text-sky-500 focus:ring-sky-500 disabled:opacity-50"
                  />
                  <span class="text-sm text-gray-300">My VNDB Profile</span>
                  <Show when={!settings.settings().vndb_token}>
                    <span class="text-xs text-amber-400">(requires VNDB token)</span>
                  </Show>
                </label>

                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.settings().discord_btn_github ?? false}
                    onChange={(e) => {
                      const newValue = e.currentTarget.checked;
                      const vndbGame = settings.settings().discord_btn_vndb_game ?? true;
                      const profile = settings.settings().discord_btn_vndb_profile ?? false;
                      const count = [vndbGame, profile, newValue].filter(Boolean).length;
                      if (count <= 2) {
                        settings.updateDiscordButtons(vndbGame, profile, newValue);
                      } else {
                        e.currentTarget.checked = !newValue;
                      }
                    }}
                    class="w-4 h-4 rounded bg-slate-600 border-slate-500 text-sky-500 focus:ring-sky-500"
                  />
                  <span class="text-sm text-gray-300">GitHub Repository</span>
                </label>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchModal(props: {
  searchQuery: () => string;
  handleSearchInput: (value: string) => void;
  searchResults: () => VndbSearchResult[];
  isSearching: () => boolean;
  onSearch: () => void;
  onLink: (result: VndbSearchResult) => void;
  shouldBlur: (img: VndbImage | null) => boolean;
  onClose: () => void;
}) {
  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="bg-slate-800 rounded-lg w-full max-w-lg max-h-[70vh] overflow-hidden">
        <div class="flex items-center justify-between p-3 border-b border-slate-700">
          <h2 class="text-lg font-bold text-white">Link to VNDB</h2>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-3">
          <div class="flex gap-2 mb-3">
            <input
              type="text"
              value={props.searchQuery()}
              onInput={(e) => props.handleSearchInput(e.currentTarget.value)}
              onKeyPress={(e) => e.key === "Enter" && props.onSearch()}
              placeholder="Search..."
              class="flex-1 px-3 py-1.5 bg-slate-700 rounded text-white text-sm"
            />
            <button
              onClick={props.onSearch}
              disabled={props.isSearching()}
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-white"
            >
              <Search class="w-4 h-4" />
            </button>
          </div>
          <div class="overflow-y-auto max-h-80 space-y-1">
            <Show when={props.isSearching()}>
              <p class="text-gray-400 text-center py-3 text-sm">Searching...</p>
            </Show>
            <For each={props.searchResults()}>
              {(r) => (
                <button
                  onClick={() => props.onLink(r)}
                  class="w-full flex items-center gap-2 p-2 bg-slate-700 hover:bg-slate-600 rounded text-left"
                >
                  <div class="w-10 h-14 bg-slate-600 rounded overflow-hidden flex-shrink-0">
                    <Show when={r.image?.url}>
                      <img
                        src={r.image!.url}
                        alt={r.title}
                        class={`w-full h-full object-cover ${props.shouldBlur(r.image ?? null) ? "blur-lg" : ""}`}
                      />
                    </Show>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4 class="text-white text-sm font-medium truncate">{r.title}</h4>
                    <p class="text-xs text-gray-400">
                      {r.id}
                      {r.released && ` • ${r.released}`}
                      {r.rating && ` • ${(r.rating / 10).toFixed(1)}`}
                    </p>
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppLayout(props: { children?: any }) {
  return (
    <GameProvider>
      <SettingsProvider>
        <VndbProvider>
          <div class="h-screen flex flex-col bg-[#0F172A]">
            <TitleBar />
            <div class="flex-1 overflow-hidden relative">
              {props.children}
            </div>
          </div>
        </VndbProvider>
      </SettingsProvider>
    </GameProvider>
  );
}

function App() {
  return (
    <Router root={AppLayout}>
      <Route path="/" component={LibraryPage} />
      <Route path="/game/:id" component={DetailPage} />
    </Router>
  );
}

export default App;
