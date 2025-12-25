import { createSignal, For, Show, onCleanup, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, Play, Gamepad2, Search, X, Trash2, Clock, Settings, User, Star, Eye, EyeOff, ArrowLeft, RefreshCw, ExternalLink, ChevronDown } from "lucide-solid";

// Types
interface Game { id: string; title: string; path: string; vndb_id: string | null; cover_url: string | null; play_time: number; is_finished: boolean; last_played: string | null; }
interface VndbImage { url: string; sexual: number; violence: number; }
interface VndbSearchResult { id: string; title: string; image: VndbImage | null; released: string | null; rating: number | null; }
interface VndbTag { id: string; name: string; rating: number; spoiler: number; }
interface VndbVnDetail { id: string; title: string; image: VndbImage | null; released: string | null; rating: number | null; description: string | null; length: number | null; length_minutes: number | null; tags: VndbTag[] | null; }
interface VndbTrait { id: string; name: string; group_id: string | null; group_name: string | null; spoiler: number; }
interface VndbCharacterVn { id: string; role: string; spoiler: number; }
interface VndbCharacter { id: string; name: string; original: string | null; aliases: string[] | null; image: VndbImage | null; description: string | null; blood_type: string | null; height: number | null; weight: number | null; bust: number | null; waist: number | null; hips: number | null; cup: string | null; age: number | null; birthday: number[] | null; sex: string[] | null; vns: VndbCharacterVn[] | null; traits: VndbTrait[] | null; }
interface VndbUserListItem { id: string; vote: number | null; labels: { id: number; label: string }[] | null; }
interface AppSettings { vndb_token: string | null; vndb_user_id: string | null; blur_nsfw: boolean; }

const STATUS_LABELS = [{ id: 1, name: "Playing" }, { id: 2, name: "Finished" }, { id: 3, name: "Stalled" }, { id: 4, name: "Dropped" }, { id: 5, name: "Wishlist" }, { id: 6, name: "Blacklist" }];
const ROLE_NAMES: Record<string, string> = { "main": "Protagonist", "primary": "Main Characters", "side": "Side Characters", "appears": "Makes an Appearance" };
const LENGTH_NAMES: Record<number, string> = { 1: "Very Short (<2h)", 2: "Short (2-10h)", 3: "Medium (10-30h)", 4: "Long (30-50h)", 5: "Very Long (>50h)" };

// Trait groups order
const TRAIT_ORDER = ["Hair", "Eyes", "Body", "Clothes", "Items", "Personality", "Role", "Engages in", "Subject of", "Engages in (Sexual)", "Subject of (Sexual)"];

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
  const [showStatusDropdown, setShowStatusDropdown] = createSignal(false);
  const [showVoteDropdown, setShowVoteDropdown] = createSignal(false);

  const loadGames = async () => {
    const [games, running] = await Promise.all([
      invoke<Game[]>("get_all_games"),
      invoke<string | null>("get_running_game")
    ]);
    setGames(games);
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
  const searchVndb = async () => { if (!searchQuery().trim()) return; setSearching(true); setSearchResults(await invoke<VndbSearchResult[]>("search_vndb", { query: searchQuery() })); setSearching(false); };
  const linkVndb = async (vndb: VndbSearchResult) => { const g = searchModal(); if (!g) return; await invoke("update_game", { game: { ...g, title: vndb.title, vndb_id: vndb.id, cover_url: vndb.image?.url || null } }); await loadGames(); setSearchModal(null); setSearchResults([]); setSearchQuery(""); };

  const openDetail = async (game: Game, forceRefresh = false) => {
    if (!game.vndb_id) return;
    setCurrentGame(game); setPage("detail"); setShowSpoilers(false);
    if (forceRefresh) { setVnDetail(null); setCharacters([]); }
    const [d, c] = await Promise.all([
      invoke<VndbVnDetail>("fetch_vndb_detail", { vndbId: game.vndb_id, forceRefresh }),
      invoke<VndbCharacter[]>("fetch_vndb_characters", { vndbId: game.vndb_id, forceRefresh })
    ]);
    setVnDetail(d); setCharacters(c);
    if (settings().vndb_token) { try { setUserVn(await invoke<VndbUserListItem | null>("vndb_get_user_vn", { vndbId: game.vndb_id })); } catch { setUserVn(null); } }
  };

  const refreshDetail = async () => {
    const g = currentGame();
    if (g) await openDetail(g, true);
  };

  const goBack = () => { setPage("library"); setCurrentGame(null); setVnDetail(null); setCharacters([]); setUserVn(null); };
  const setStatus = async (labelId: number) => { const g = currentGame(); if (!g?.vndb_id) return; await invoke("vndb_set_status", { vndbId: g.vndb_id, labelId }); setUserVn(await invoke<VndbUserListItem | null>("vndb_get_user_vn", { vndbId: g.vndb_id })); };
  const setVote = async (vote: number) => { const g = currentGame(); if (!g?.vndb_id) return; await invoke("vndb_set_vote", { vndbId: g.vndb_id, vote }); setUserVn(await invoke<VndbUserListItem | null>("vndb_get_user_vn", { vndbId: g.vndb_id })); };

  const shouldBlur = (img: VndbImage | null) => settings().blur_nsfw && img && (img.sexual > 1 || img.violence > 1);
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

  // Group and sort traits
  const groupTraits = (traits: VndbTrait[] | null, showSpoiler: boolean): [string, VndbTrait[]][] => {
    if (!traits) return [];
    const groups: Record<string, VndbTrait[]> = {};
    traits.filter(t => showSpoiler || t.spoiler === 0).forEach(t => {
      const g = t.group_name || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });
    return TRAIT_ORDER.filter(g => groups[g]).map(g => [g, groups[g]] as [string, VndbTrait[]]).concat(Object.entries(groups).filter(([g]) => !TRAIT_ORDER.includes(g)));
  };

  // Render trait value with spoiler indicator
  const TraitValue = (props: { traits: VndbTrait[] }) => (
    <span>
      <For each={props.traits}>{(t, i) => (
        <><Show when={i() > 0}>, </Show><span class={t.spoiler > 0 ? "text-orange-400" : "text-gray-200"}>{t.name}<Show when={t.spoiler > 0}><sup class="text-orange-500 text-[10px] ml-0.5">S</sup></Show></span></>
      )}</For>
    </span>
  );

  let poll: number | undefined;
  createEffect(() => { if (runningGame()) { poll = setInterval(async () => { const r = await invoke<string | null>("get_running_game"); if (r !== runningGame()) { setRunningGame(r); if (!r) await loadGames(); } }, 2000) as unknown as number; } else if (poll) { clearInterval(poll); poll = undefined; } });
  onCleanup(() => poll && clearInterval(poll));

  // Fast startup - init backend cache, then load data in parallel
  invoke("init_app"); // Fire and forget - pre-init cache db
  Promise.all([loadGames(), loadSettings()]);

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Library */}
      <Show when={page() === "library"}>
        <div class="p-4">
          <header class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-2"><Gamepad2 class="w-7 h-7 text-purple-400" /><h1 class="text-2xl font-bold text-white">Alka Launcher</h1></div>
            <div class="flex items-center gap-2">
              <Show when={runningGame()}><button onClick={stopTracking} class="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white text-sm"><Clock class="w-4 h-4" /> Stop</button></Show>
              <button onClick={() => setShowSettings(true)} class="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white"><Settings class="w-5 h-5" /></button>
              <button onClick={addGame} disabled={loading()} class="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white text-sm"><Plus class="w-4 h-4" /> Add</button>
            </div>
          </header>
          <Show when={games().length > 0} fallback={<div class="flex flex-col items-center justify-center h-80 text-gray-400"><Gamepad2 class="w-12 h-12 mb-3 opacity-50" /><p>No games. Click "Add" to start.</p></div>}>
            <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <For each={games()}>{(game) => (
                <div class={`group relative bg-slate-800/50 rounded overflow-hidden border cursor-pointer transition-all ${runningGame() === game.id ? "border-green-500" : "border-slate-700 hover:border-purple-500"}`} onClick={() => game.vndb_id ? openDetail(game) : setSearchModal(game)}>
                  <div class="aspect-[3/4] bg-slate-700 flex items-center justify-center"><Show when={game.cover_url} fallback={<Gamepad2 class="w-10 h-10 text-slate-500" />}><img src={game.cover_url!} alt={game.title} class="w-full h-full object-cover" /></Show></div>
                  <div class="p-2"><h3 class="text-white text-sm font-medium truncate">{game.title}</h3><p class="text-xs text-gray-400">{formatPlayTime(game.play_time)}</p></div>
                  <div class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Show when={runningGame() !== game.id} fallback={<span class="text-green-400 text-sm">Running...</span>}>
                      <button onClick={(e) => { e.stopPropagation(); launchGame(game.id); }} class="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm"><Play class="w-4 h-4" /> Play</button>
                    </Show>
                    <button onClick={(e) => { e.stopPropagation(); setSearchModal(game); setSearchQuery(game.title); }} class="flex items-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs"><Search class="w-3 h-3" /> VNDB</button>
                    <button onClick={(e) => { e.stopPropagation(); removeGame(game.id); }} class="flex items-center gap-1 px-2 py-0.5 bg-red-600/50 hover:bg-red-600 rounded text-white text-xs"><Trash2 class="w-3 h-3" /> Remove</button>
                  </div>
                </div>
              )}</For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Detail Page */}
      <Show when={page().startsWith("detail") && vnDetail()}>
        <div class="flex h-screen bg-[#0F172A] font-['Figtree'] text-slate-200 overflow-hidden">
          {/* Sidebar Navigation */}
          <aside class="w-[80px] flex flex-col items-center py-6 bg-[#0F172A]/50 border-r border-[#1E293B] shrink-0 gap-6 z-20">
            <button onClick={goBack} class="p-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-400 hover:text-white transition-all shadow-lg" title="Back">
              <ArrowLeft class="w-6 h-6" />
            </button>

            <div class="h-px w-10 bg-[#334155] my-2"></div>

            <button onClick={refreshDetail} class="p-3 rounded-xl hover:bg-[#1E293B] text-slate-400 hover:text-white transition-all" title="Refresh Data">
              <RefreshCw class="w-6 h-6" />
            </button>

            <button onClick={() => setShowSpoilers(!showSpoilers())} class={`p-3 rounded-xl hover:bg-[#1E293B] transition-all relative ${showSpoilers() ? "text-purple-400" : "text-slate-400 hover:text-white"}`} title="Toggle Spoilers">
              <Show when={showSpoilers()} fallback={<EyeOff class="w-6 h-6" />}><Eye class="w-6 h-6" /></Show>
            </button>

            <div class="flex-1"></div>

            <button onClick={() => setShowSettings(true)} class="p-3 rounded-xl hover:bg-[#1E293B] text-slate-400 hover:text-white transition-all" title="Settings">
              <Settings class="w-6 h-6" />
            </button>
          </aside>

          {/* Main Content Area */}
          <div class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* Background Pattern/Gradient */}
            <div class="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

            {/* Tab Navigation Header */}
            <div class="flex items-center gap-8 px-8 py-6 z-10">
              {/* Tabs */}
              <div class="flex items-center gap-1 bg-[#1E293B] p-1 rounded-full">
                <button
                  onClick={() => setPage("detail")}
                  class={`px-6 py-2 rounded-full text-sm font-bold transition-all ${page() === "detail" ? "bg-[#38BDF8] text-[#0F172A] shadow-lg shadow-sky-500/20" : "text-slate-400 hover:text-slate-200"}`}
                >
                  Game Info
                </button>
                <button
                  onClick={() => setPage("detail-chars" as any)}
                  class={`px-6 py-2 rounded-full text-sm font-bold transition-all ${page() === "detail-chars" ? "bg-[#38BDF8] text-[#0F172A] shadow-lg shadow-sky-500/20" : "text-slate-400 hover:text-slate-200"}`}
                >
                  Characters
                </button>
              </div>

              <div class="flex-1"></div>

              {/* Primary Action */}
              <Show when={currentGame()}>
                <Show when={runningGame() !== currentGame()!.id} fallback={
                  <button class="px-6 py-2.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full font-bold text-sm tracking-wide flex items-center gap-2 cursor-default">
                    <Clock class="w-4 h-4" /> RUNNING
                  </button>
                }>
                  <button onClick={() => launchGame(currentGame()!.id)} class="group relative px-8 py-2.5 bg-white text-black rounded-full font-bold text-sm tracking-wide overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all">
                    <span class="relative z-10 flex items-center gap-2"><Play class="w-4 h-4 fill-current" /> PLAY NOW</span>
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                  </button>
                </Show>
              </Show>
            </div>

            {/* Scrollable Content */}
            <div class="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar z-10">

              {/* === GAME INFO TAB === */}
              <Show when={page() === "detail"}>
                <div class="max-w-6xl mx-auto space-y-8">

                  {/* Title Section */}
                  <div>
                    <h1 class="text-[64px] leading-tight font-extrabold text-white tracking-tight drop-shadow-2xl">
                      {vnDetail()!.title}
                    </h1>
                    <Show when={vnDetail()!.title !== currentGame()!.title}>
                      <p class="text-xl text-slate-400 font-light mt-2">{currentGame()!.title}</p>
                    </Show>
                  </div>

                  <div class="flex gap-10">
                    {/* Left Col: Cover */}
                    <div class="w-[300px] shrink-0">
                      <div class="aspect-[2/3] w-full rounded-[24px] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] bg-[#1E293B] border border-white/5 relative group">
                        <Show when={vnDetail()!.image?.url} fallback={<div class="flex items-center justify-center h-full"><Gamepad2 class="w-20 h-20 text-slate-600" /></div>}>
                          <img src={vnDetail()!.image!.url} alt={vnDetail()!.title} class={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${shouldBlur(vnDetail()!.image) ? "blur-xl scale-110" : ""}`} />
                        </Show>
                        {/* Rating Badge */}
                        <Show when={vnDetail()!.rating}>
                          <div class="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5 shadow-xl">
                            <Star class="w-4 h-4 text-yellow-400 fill-current" />
                            <span class="text-white font-bold">{(vnDetail()!.rating! / 10).toFixed(2)}</span>
                          </div>
                        </Show>
                      </div>
                    </div>

                    {/* Right Col: Stats & Details */}
                    <div class="flex-1 space-y-8">
                      {/* Stats Grid */}
                      <div class="grid grid-cols-3 gap-4">
                        {/* Vote Stat - Custom Dropdown */}
                        <div class="relative bg-[#1E293B]/50 border border-slate-700/50 p-4 rounded-[20px] flex flex-col gap-1 items-start group hover:bg-[#1E293B] transition-colors">
                          <div class="flex items-center gap-2 text-slate-400 text-sm font-medium">
                            <Star class="w-4 h-4" /> Your Vote
                          </div>
                          <button
                            onClick={() => setShowVoteDropdown(!showVoteDropdown())}
                            class="flex items-center gap-2 w-full text-left"
                          >
                            <span class="text-2xl font-bold text-white">
                              {userVn()?.vote ? (userVn()!.vote! / 10).toFixed(1) : "Rate..."}
                            </span>
                            <ChevronDown class={`w-5 h-5 text-slate-400 transition-transform ${showVoteDropdown() ? "rotate-180" : ""}`} />
                          </button>
                          <Show when={showVoteDropdown()}>
                            <div class="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1E293B]/95 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                              <div class="max-h-64 overflow-y-auto custom-scrollbar">
                                <button
                                  onClick={() => { setVote(0); setShowVoteDropdown(false); }}
                                  class="w-full px-4 py-3 text-left text-slate-400 hover:bg-[#334155] hover:text-white transition-colors flex items-center gap-3 border-b border-slate-700/50"
                                >
                                  <span class="text-lg">—</span>
                                  <span class="text-sm">No Rating</span>
                                </button>
                                <For each={[100, 90, 80, 70, 60, 50, 40, 30, 20, 10]}>{(v) => (
                                  <button
                                    onClick={() => { setVote(v); setShowVoteDropdown(false); }}
                                    class={`w-full px-4 py-3 text-left hover:bg-[#334155] transition-colors flex items-center gap-3 ${userVn()?.vote === v ? "bg-purple-600/20 text-purple-300" : "text-slate-200 hover:text-white"}`}
                                  >
                                    <Star class={`w-4 h-4 ${v >= 80 ? "text-yellow-400 fill-yellow-400" : v >= 60 ? "text-yellow-400" : "text-slate-500"}`} />
                                    <span class="text-lg font-bold">{(v / 10).toFixed(1)}</span>
                                    <span class="text-xs text-slate-500 ml-auto">
                                      {v === 100 ? "Masterpiece" : v === 90 ? "Excellent" : v === 80 ? "Great" : v === 70 ? "Good" : v === 60 ? "Decent" : v === 50 ? "Average" : v === 40 ? "Below Avg" : v === 30 ? "Poor" : v === 20 ? "Bad" : "Awful"}
                                    </span>
                                  </button>
                                )}</For>
                              </div>
                            </div>
                          </Show>
                        </div>

                        {/* Status Dropdown - Replaces Last Played */}
                        <div class="relative bg-[#1E293B]/50 border border-slate-700/50 p-4 rounded-[20px] flex flex-col gap-1 items-start hover:bg-[#1E293B] transition-colors">
                          <div class="flex items-center gap-2 text-slate-400 text-sm font-medium">
                            <Gamepad2 class="w-4 h-4" /> Status
                          </div>
                          <button
                            onClick={() => setShowStatusDropdown(!showStatusDropdown())}
                            class="flex items-center gap-2 w-full text-left"
                          >
                            <span class="text-2xl font-bold text-white">
                              {userVn()?.labels?.[0]?.label || "Set Status"}
                            </span>
                            <ChevronDown class={`w-5 h-5 text-slate-400 transition-transform ${showStatusDropdown() ? "rotate-180" : ""}`} />
                          </button>
                          <Show when={showStatusDropdown()}>
                            <div class="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1E293B]/95 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                              <For each={STATUS_LABELS}>{(label) => (
                                <button
                                  onClick={() => { setStatus(label.id); setShowStatusDropdown(false); }}
                                  class={`w-full px-4 py-3 text-left hover:bg-[#334155] transition-colors flex items-center gap-3 ${userVn()?.labels?.some(l => l.id === label.id) ? "bg-sky-600/20 text-sky-300" : "text-slate-200 hover:text-white"}`}
                                >
                                  <div class={`w-2 h-2 rounded-full ${label.id === 1 ? "bg-green-400" : label.id === 2 ? "bg-sky-400" : label.id === 3 ? "bg-yellow-400" : label.id === 4 ? "bg-red-400" : label.id === 5 ? "bg-purple-400" : "bg-slate-600"}`} />
                                  <span class="font-medium">{label.name}</span>
                                  <Show when={userVn()?.labels?.some(l => l.id === label.id)}>
                                    <span class="ml-auto text-sky-400 text-xs">✓</span>
                                  </Show>
                                </button>
                              )}</For>
                            </div>
                          </Show>
                        </div>

                        {/* Playtime Stat */}
                        <div class="bg-[#1E293B]/50 border border-slate-700/50 p-4 rounded-[20px] flex flex-col gap-1 items-start hover:bg-[#1E293B] transition-colors">
                          <div class="flex items-center gap-2 text-slate-400 text-sm font-medium">
                            <Clock class="w-4 h-4" /> Total Playtime
                          </div>
                          <div class="text-2xl font-bold text-white">
                            {formatPlayTime(currentGame()!.play_time)}
                          </div>
                        </div>
                      </div>

                      {/* Last Played */}
                      <div class="bg-[#1E293B]/50 border border-slate-700/50 p-4 rounded-[20px] flex flex-col gap-1 items-start hover:bg-[#1E293B] transition-colors">
                        <div class="flex items-center gap-2 text-slate-400 text-sm font-medium">
                          <Clock class="w-4 h-4" /> Last Played
                        </div>
                        <div class="text-2xl font-bold text-white">
                          {formatLastPlayed(currentGame()!.last_played)}
                        </div>
                      </div>

                      {/* Meta Info - Removed "Started", kept Length */}
                      <div class="flex flex-wrap gap-x-8 gap-y-2 text-[#94A3B8] font-light text-lg">
                        <Show when={vnDetail()!.length}>
                          <span class="flex items-center gap-2">Length: <span class="text-slate-200 font-normal">{LENGTH_NAMES[vnDetail()!.length!]}</span></span>
                        </Show>
                      </div>

                      {/* Description */}
                      <div class="font-['Roboto'] text-lg leading-relaxed text-[#F1F5F9]/80 whitespace-pre-line max-w-3xl">
                        {vnDetail()!.description?.replace(/\[.*?\]/g, "")}
                      </div>

                      {/* VNDB Link Button */}
                      <button
                        onClick={() => window.open(`https://vndb.org/${currentGame()!.vndb_id}`, "_blank")}
                        class="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#334155] to-[#1E293B] hover:from-[#475569] hover:to-[#334155] border border-slate-600/50 rounded-xl text-slate-200 hover:text-white font-medium transition-all shadow-lg hover:shadow-xl group"
                      >
                        <ExternalLink class="w-4 h-4 group-hover:scale-110 transition-transform" />
                        View on VNDB
                      </button>

                      {/* Tags */}
                      <Show when={vnDetail()!.tags?.length}>
                        <div>
                          <h3 class="text-sm uppercase tracking-wider text-slate-500 font-bold mb-3 font-['Plus_Jakarta_Sans']">Tags</h3>
                          <div class="flex flex-wrap gap-2">
                            <For each={vnDetail()!.tags!.filter(t => t.spoiler === 0).slice(0, 15)}>{(tag) => (
                              <span class="px-3 py-1.5 rounded-lg bg-[#334155]/40 text-[#CBD5E1] text-sm font-['Plus_Jakarta_Sans'] border border-white/5 hover:bg-[#334155] transition-colors cursor-default">
                                {tag.name}
                              </span>
                            )}</For>
                            <Show when={vnDetail()!.tags!.length > 15}>
                              <span class="px-3 py-1.5 text-slate-500 text-sm font-medium">+{vnDetail()!.tags!.length - 15} more</span>
                            </Show>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              </Show>

              {/* === CHARACTERS TAB === */}
              <Show when={page() === "detail-chars"}>
                <div class="max-w-6xl mx-auto">
                  <Show when={characters().length > 0} fallback={<div class="text-slate-500 text-center py-20 text-lg">No character data available.</div>}>

                    {/* Filters/Summary */}
                    <div class="flex items-center justify-between mb-8">
                      <h2 class="text-2xl font-bold text-white">Characters ({characters().filter(c => showSpoilers() || (c.vns?.find(v => v.id === vnDetail()!.id)?.spoiler || 0) === 0).length})</h2>
                      <div class="text-sm text-slate-400 bg-[#1E293B] px-4 py-2 rounded-lg border border-slate-700">
                        {showSpoilers() ? "Show Spoilers: ON" : "Show Spoilers: OFF"}
                      </div>
                    </div>

                    {/* Characters grouped by role */}
                    <div class="space-y-10">
                      <For each={(() => {
                        // Filter and group characters by role
                        const vnId = vnDetail()!.id;
                        const filtered = characters().filter(c => {
                          const v = c.vns?.find(x => x.id === vnId);
                          return showSpoilers() || (v?.spoiler || 0) === 0;
                        });

                        // Group by role
                        const groups: Record<string, VndbCharacter[]> = {};
                        filtered.forEach(char => {
                          const vnInfo = char.vns?.find(v => v.id === vnId);
                          const role = vnInfo?.role || "appears";
                          if (!groups[role]) groups[role] = [];
                          groups[role].push(char);
                        });

                        // Sort each group alphabetically
                        Object.values(groups).forEach(chars =>
                          chars.sort((a, b) => a.name.localeCompare(b.name))
                        );

                        // Return sorted by role order
                        return ["main", "primary", "side", "appears"]
                          .filter(role => groups[role]?.length)
                          .map(role => ({ role, chars: groups[role] }));
                      })()}>{(group) => (
                        <div>
                          {/* Role Section Header */}
                          <div class="flex items-center gap-4 mb-6">
                            <h3 class="text-xl font-bold text-white font-['Plus_Jakarta_Sans']">
                              {ROLE_NAMES[group.role] || group.role}
                            </h3>
                            <span class="text-sm text-slate-500 bg-[#1E293B] px-3 py-1 rounded-full border border-slate-700">
                              {group.chars.length} {group.chars.length === 1 ? "character" : "characters"}
                            </span>
                            <div class="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
                          </div>

                          {/* Characters in this role */}
                          <div class="space-y-6">
                            <For each={group.chars}>{(char) => {
                              const vn = () => char.vns?.find(v => v.id === vnDetail()!.id);
                              const isSpoiler = () => (vn()?.spoiler || 0) > 0;
                              const traits = () => groupTraits(char.traits, showSpoilers());
                              const sex = () => char.sex?.[0];
                              const role = () => vn()?.role || "appears";

                              return (
                                <div class="flex gap-6 bg-[#1E293B]/40 rounded-2xl p-6 border border-[#334155]/50 hover:border-[#38BDF8]/30 transition-all">
                                  {/* Character Image */}
                                  <div class="w-48 flex-shrink-0">
                                    <Show when={char.image?.url} fallback={<div class="aspect-[3/4] bg-slate-800 rounded-xl flex items-center justify-center"><User class="w-12 h-12 text-slate-600" /></div>}>
                                      <img src={char.image!.url} alt={char.name} class={`w-full rounded-xl shadow-lg border border-white/5 ${(!showSpoilers() && isSpoiler()) || shouldBlur(char.image) ? "blur-xl" : ""}`} />
                                    </Show>
                                  </div>

                                  {/* Character Info Table */}
                                  <div class="flex-1 min-w-0">
                                    {/* Name Header with Role Badge */}
                                    <div class="flex items-center gap-3 mb-4 border-b border-slate-700/50 pb-4 flex-wrap">
                                      <h3 class={`text-2xl font-bold font-['Plus_Jakarta_Sans'] ${isSpoiler() ? "text-orange-400" : "text-white"}`}>{char.name}</h3>
                                      <Show when={char.original}><span class="text-slate-500 text-lg">{char.original}</span></Show>

                                      {/* Role Badge */}
                                      <span class={`text-xs px-2.5 py-1 rounded-full font-bold tracking-wide border ${role() === "main" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                                        role() === "primary" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                                          role() === "side" ? "bg-sky-500/10 text-sky-400 border-sky-500/30" :
                                            "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                        }`}>
                                        {ROLE_NAMES[role()] || role()}
                                      </span>

                                      <Show when={sex()}><span class="text-sky-400 text-sm ml-auto bg-sky-500/10 px-2 py-1 rounded">
                                        {sex() === 'm' ? 'Male' : sex() === 'f' ? 'Female' : sex()}
                                      </span></Show>
                                      <Show when={isSpoiler()}><span class="text-orange-500 text-xs px-2 py-1 bg-orange-900/30 border border-orange-500/20 rounded font-bold tracking-wide">SPOILER</span></Show>
                                    </div>

                                    {/* Info Table */}
                                    <table class="w-full text-sm text-slate-300">
                                      <tbody>
                                        <Show when={char.aliases?.length}>
                                          <tr><td class="text-slate-500 py-1.5 pr-6 align-top w-32 font-medium">Aliases</td><td class="text-slate-200 py-1.5">{char.aliases!.join(", ")}</td></tr>
                                        </Show>
                                        <Show when={char.age || char.birthday}>
                                          <tr>
                                            <td class="text-slate-500 py-1.5 pr-6 align-top font-medium">Age/Birthday</td>
                                            <td class="text-slate-200 py-1.5">
                                              <Show when={char.age}>{char.age} years</Show>
                                              <Show when={char.age && char.birthday}>, </Show>
                                              <Show when={char.birthday}>{char.birthday![1]}/{char.birthday![0]}</Show>
                                            </td>
                                          </tr>
                                        </Show>

                                        {/* Measurements Row - Condensed */}
                                        <Show when={char.height || char.weight || (char.bust && char.waist && char.hips)}>
                                          <tr>
                                            <td class="text-slate-500 py-1.5 pr-6 align-top font-medium">Body</td>
                                            <td class="text-slate-200 py-1.5 flex gap-4">
                                              <Show when={char.height}><span>H: {char.height}cm</span></Show>
                                              <Show when={char.weight}><span>W: {char.weight}kg</span></Show>
                                              <Show when={char.bust}><span>BWH: {char.bust}-{char.waist}-{char.hips} <Show when={char.cup}>({char.cup})</Show></span></Show>
                                            </td>
                                          </tr>
                                        </Show>

                                        {/* Traits */}
                                        <For each={traits()}>{([tgroup, items]) => (
                                          <tr><td class="text-slate-500 py-1.5 pr-6 align-top font-medium">{tgroup}</td><td class="py-1.5"><TraitValue traits={items} /></td></tr>
                                        )}</For>

                                        {/* Description */}
                                        <Show when={char.description}>
                                          <tr>
                                            <td class="text-slate-500 py-3 pr-6 align-top font-medium" colspan="2">
                                              <div class="text-slate-300 text-sm whitespace-pre-line leading-relaxed font-['Roboto'] bg-[#0F172A]/30 p-4 rounded-lg border border-white/5 mt-2">{char.description!.replace(/\[.*?\]/g, "")}</div>
                                            </td>
                                          </tr>
                                        </Show>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            }}</For>
                          </div>
                        </div>
                      )}</For>
                    </div>

                  </Show>
                </div>
              </Show>

            </div>
          </div>
        </div>
      </Show>

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
              <div class="flex gap-2 mb-3"><input type="text" value={searchQuery()} onInput={(e) => setSearchQuery(e.currentTarget.value)} onKeyPress={(e) => e.key === "Enter" && searchVndb()} placeholder="Search..." class="flex-1 px-3 py-1.5 bg-slate-700 rounded text-white text-sm" /><button onClick={searchVndb} disabled={searching()} class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white"><Search class="w-4 h-4" /></button></div>
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
