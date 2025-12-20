import { createSignal, For, Show, onCleanup, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, Play, Gamepad2, Search, X, Trash2, Clock, Settings, User, Star, Eye, EyeOff, ArrowLeft, RefreshCw } from "lucide-solid";

// Types
interface Game { id: string; title: string; path: string; vndb_id: string | null; cover_url: string | null; play_time: number; is_finished: boolean; }
interface VndbImage { url: string; sexual: number; violence: number; }
interface VndbSearchResult { id: string; title: string; image: VndbImage | null; released: string | null; rating: number | null; }
interface VndbTag { id: string; name: string; rating: number; spoiler: number; }
interface VndbVnDetail { id: string; title: string; image: VndbImage | null; released: string | null; rating: number | null; description: string | null; length: number | null; length_minutes: number | null; tags: VndbTag[] | null; }
interface VndbTrait { id: string; name: string; group_id: string | null; group_name: string | null; spoiler: number; }
interface VndbCharacterVn { id: string; role: string; spoiler: number; }
interface VndbCharacter { id: string; name: string; original: string | null; aliases: string[] | null; image: VndbImage | null; description: string | null; blood_type: string | null; height: number | null; weight: number | null; bust: number | null; waist: number | null; hips: number | null; cup: string | null; age: number | null; birthday: number[] | null; sex: string[] | null; vns: VndbCharacterVn[] | null; traits: VndbTrait[] | null; }
interface VndbUserListItem { id: string; vote: number | null; labels: { id: number; label: string }[] | null; }
interface AppSettings { vndb_token: string | null; vndb_user_id: string | null; blur_nsfw: boolean; }

const STATUS_LABELS = [{ id: 1, name: "Playing" }, { id: 2, name: "Finished" }, { id: 3, name: "Stalled" }, { id: 4, name: "Dropped" }, { id: 5, name: "Wishlist" }];
const LENGTH_NAMES: Record<number, string> = { 1: "Very Short (<2h)", 2: "Short (2-10h)", 3: "Medium (10-30h)", 4: "Long (30-50h)", 5: "Very Long (>50h)" };

// Trait groups order
const TRAIT_ORDER = ["Hair", "Eyes", "Body", "Clothes", "Items", "Personality", "Role", "Engages in", "Subject of", "Engages in (Sexual)", "Subject of (Sexual)"];

function App() {
  const [games, setGames] = createSignal<Game[]>([]);
  const [settings, setSettings] = createSignal<AppSettings>({ vndb_token: null, vndb_user_id: null, blur_nsfw: false });
  const [loading, setLoading] = createSignal(false);
  const [runningGame, setRunningGame] = createSignal<string | null>(null);
  const [authUser, setAuthUser] = createSignal<string | null>(null);
  
  const [page, setPage] = createSignal<"library" | "detail">("library");
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
  const formatPlayTime = (m: number) => m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`;

  // Group and sort traits
  const groupTraits = (traits: VndbTrait[] | null, showSpoiler: boolean): [string, VndbTrait[]][] => {
    if (!traits) return [];
    const groups: Record<string, VndbTrait[]> = {};
    traits.filter(t => showSpoiler || t.spoiler === 0).forEach(t => {
      const g = t.group_name || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });
    return TRAIT_ORDER.filter(g => groups[g]).map(g => [g, groups[g]]).concat(Object.entries(groups).filter(([g]) => !TRAIT_ORDER.includes(g)));
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
      <Show when={page() === "detail" && vnDetail()}>
        <div class="min-h-screen">
          <header class="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center gap-3">
            <button onClick={goBack} class="p-1 hover:bg-slate-700 rounded"><ArrowLeft class="w-5 h-5 text-white" /></button>
            <h1 class="text-lg font-bold text-white truncate flex-1">{vnDetail()!.title}</h1>
            <button onClick={refreshDetail} title="Refresh from VNDB" class="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-gray-300"><RefreshCw class="w-4 h-4" /></button>
            <button onClick={() => setShowSpoilers(!showSpoilers())} class="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-gray-300">
              <Show when={showSpoilers()} fallback={<><EyeOff class="w-4 h-4" /> Spoilers Off</>}><Eye class="w-4 h-4" /> Spoilers On</Show>
            </button>
            <Show when={currentGame()}><button onClick={() => launchGame(currentGame()!.id)} class="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm"><Play class="w-4 h-4" /> Play</button></Show>
          </header>
          
          <div class="p-4">
            {/* VN Info */}
            <div class="flex gap-4 mb-6">
              <div class="w-36 flex-shrink-0">
                <Show when={vnDetail()!.image?.url} fallback={<div class="aspect-[3/4] bg-slate-700 rounded flex items-center justify-center"><Gamepad2 class="w-10 h-10 text-slate-500" /></div>}>
                  <img src={vnDetail()!.image!.url} alt={vnDetail()!.title} class={`w-full rounded shadow-lg ${shouldBlur(vnDetail()!.image) ? "blur-xl" : ""}`} />
                </Show>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-3 mb-2">
                  <Show when={vnDetail()!.rating}><span class="flex items-center gap-1 text-yellow-400"><Star class="w-4 h-4 fill-current" /> {vnDetail()!.rating!.toFixed(2)}</span></Show>
                  <Show when={vnDetail()!.released}><span class="text-gray-400 text-sm">{vnDetail()!.released}</span></Show>
                  <Show when={vnDetail()!.length}><span class="text-gray-400 text-sm">{LENGTH_NAMES[vnDetail()!.length!]}</span></Show>
                </div>
                <Show when={vnDetail()!.description}><p class="text-gray-300 text-sm mb-3">{vnDetail()!.description!.replace(/\[.*?\]/g, "").slice(0, 400)}{(vnDetail()!.description?.length || 0) > 400 ? "..." : ""}</p></Show>
                <Show when={vnDetail()!.tags?.length}><div class="flex flex-wrap gap-1"><For each={vnDetail()!.tags!.filter(t => t.spoiler === 0).slice(0, 12)}>{(tag) => (<span class="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-gray-300">{tag.name}</span>)}</For></div></Show>
              </div>
            </div>
            
            {/* User Controls */}
            <Show when={authUser()}>
              <div class="flex flex-wrap items-center gap-2 mb-6 p-3 bg-slate-800/50 rounded border border-slate-700">
                <span class="text-sm text-gray-400">Status:</span>
                <For each={STATUS_LABELS}>{(l) => (<button onClick={() => setStatus(l.id)} class={`px-2 py-0.5 rounded text-xs ${userVn()?.labels?.some(x => x.id === l.id) ? "bg-purple-600 text-white" : "bg-slate-700 text-gray-300 hover:bg-slate-600"}`}>{l.name}</button>)}</For>
                <span class="text-sm text-gray-400 ml-3">Vote:</span>
                <select onChange={(e) => e.currentTarget.value && setVote(parseInt(e.currentTarget.value))} class="px-2 py-0.5 bg-slate-700 rounded text-white text-sm">
                  <option value="">-</option><For each={[10,20,30,40,50,60,70,80,90,100]}>{(v) => (<option value={v} selected={userVn()?.vote === v}>{v/10}</option>)}</For>
                </select>
                <Show when={userVn()?.vote}><span class="text-yellow-400 text-sm">{(userVn()!.vote!/10).toFixed(1)}</span></Show>
              </div>
            </Show>

            {/* Characters - Vertical Scroll Layout */}
            <Show when={characters().length > 0}>
              <h2 class="text-lg font-bold text-white mb-4">Characters ({characters().filter(c => showSpoilers() || (c.vns?.find(v => v.id === vnDetail()!.id)?.spoiler || 0) === 0).length})</h2>
              <div class="space-y-6">
                <For each={characters().filter(c => { const v = c.vns?.find(x => x.id === vnDetail()!.id); return showSpoilers() || (v?.spoiler || 0) === 0; })}>{(char) => {
                  const vn = () => char.vns?.find(v => v.id === vnDetail()!.id);
                  const isSpoiler = () => (vn()?.spoiler || 0) > 0;
                  const traits = () => groupTraits(char.traits, showSpoilers());
                  const sex = () => char.sex?.[0];
                  
                  return (
                    <div class="flex gap-4 bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                      {/* Character Image */}
                      <div class="w-40 flex-shrink-0">
                        <Show when={char.image?.url} fallback={<div class="aspect-[3/4] bg-slate-700 rounded flex items-center justify-center"><User class="w-12 h-12 text-slate-500" /></div>}>
                          <img src={char.image!.url} alt={char.name} class={`w-full rounded ${(!showSpoilers() && isSpoiler()) || shouldBlur(char.image) ? "blur-lg" : ""}`} />
                        </Show>
                      </div>
                      
                      {/* Character Info Table */}
                      <div class="flex-1 min-w-0">
                        {/* Name Header */}
                        <div class="flex items-center gap-2 mb-3 border-b border-slate-600 pb-2">
                          <h3 class={`text-xl font-bold ${isSpoiler() ? "text-orange-400" : "text-white"}`}>{char.name}</h3>
                          <Show when={char.original}><span class="text-gray-400">{char.original}</span></Show>
                          <Show when={sex()}><span class="text-blue-400 text-sm">♂♀</span></Show>
                          <Show when={isSpoiler()}><span class="text-orange-500 text-xs px-1.5 py-0.5 bg-orange-900/50 rounded">SPOILER</span></Show>
                        </div>
                        
                        {/* Info Table */}
                        <table class="w-full text-sm">
                          <tbody>
                            <Show when={char.aliases?.length}>
                              <tr><td class="text-gray-500 py-1 pr-4 align-top w-28">Aliases</td><td class="text-gray-200 py-1">{char.aliases!.join(", ")}</td></tr>
                            </Show>
                            <Show when={char.age || char.birthday}>
                              <tr>
                                <td class="text-gray-500 py-1 pr-4 align-top">Age/Birthday</td>
                                <td class="text-gray-200 py-1">
                                  <Show when={char.age}>{char.age} years</Show>
                                  <Show when={char.age && char.birthday}>, </Show>
                                  <Show when={char.birthday}>{char.birthday![1]}/{char.birthday![0]}</Show>
                                </td>
                              </tr>
                            </Show>
                            <Show when={char.blood_type}>
                              <tr><td class="text-gray-500 py-1 pr-4 align-top">Blood Type</td><td class="text-gray-200 py-1">{char.blood_type}</td></tr>
                            </Show>
                            <Show when={char.height || char.weight}>
                              <tr>
                                <td class="text-gray-500 py-1 pr-4 align-top">Height/Weight</td>
                                <td class="text-gray-200 py-1">
                                  <Show when={char.height}>{char.height}cm</Show>
                                  <Show when={char.height && char.weight}>, </Show>
                                  <Show when={char.weight}>{char.weight}kg</Show>
                                </td>
                              </tr>
                            </Show>
                            <Show when={char.bust && char.waist && char.hips}>
                              <tr><td class="text-gray-500 py-1 pr-4 align-top">Measurements</td><td class="text-gray-200 py-1">{char.bust}-{char.waist}-{char.hips}<Show when={char.cup}> ({char.cup})</Show></td></tr>
                            </Show>
                            
                            {/* Traits */}
                            <For each={traits()}>{([group, items]) => (
                              <tr><td class="text-gray-500 py-1 pr-4 align-top">{group}</td><td class="py-1"><TraitValue traits={items} /></td></tr>
                            )}</For>
                            
                            {/* Description */}
                            <Show when={char.description}>
                              <tr>
                                <td class="text-gray-500 py-2 pr-4 align-top" colspan="2">
                                  <div class="font-medium mb-1">Description</div>
                                  <div class="text-gray-300 text-sm whitespace-pre-line">{char.description!.replace(/\[.*?\]/g, "")}</div>
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
            </Show>
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
                <For each={searchResults()}>{(r) => (<button onClick={() => linkVndb(r)} class="w-full flex items-center gap-2 p-2 bg-slate-700 hover:bg-slate-600 rounded text-left"><div class="w-10 h-14 bg-slate-600 rounded overflow-hidden flex-shrink-0"><Show when={r.image?.url}><img src={r.image!.url} alt={r.title} class={`w-full h-full object-cover ${shouldBlur(r.image) ? "blur-lg" : ""}`} /></Show></div><div class="flex-1 min-w-0"><h4 class="text-white text-sm font-medium truncate">{r.title}</h4><p class="text-xs text-gray-400">{r.id}{r.released && ` • ${r.released}`}{r.rating && ` • ${r.rating.toFixed(1)}`}</p></div></button>)}</For>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default App;
