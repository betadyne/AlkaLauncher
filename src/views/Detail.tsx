import { createSignal, For, Show } from "solid-js";
import { Play, Gamepad2, Clock, User, Star, ExternalLink, ChevronDown } from "lucide-solid";
import { Sidebar } from "../components/Sidebar";
import type { Game, VndbVnDetail, VndbCharacter, VndbUserListItem, AppSettings, VndbTrait, VndbImage } from "../types";
import { STATUS_LABELS, ROLE_NAMES, LENGTH_NAMES, TRAIT_ORDER } from "../constants";

interface DetailProps {
    page: "detail" | "detail-chars";
    setPage: (page: "detail" | "detail-chars") => void;
    game: Game;
    vnDetail: VndbVnDetail;
    characters: VndbCharacter[];
    userVn: VndbUserListItem | null;
    runningGame: string | null;
    settings: AppSettings;
    showSpoilers: boolean;
    setShowSpoilers: (show: boolean) => void;
    onBack: () => void;
    onRefresh: () => void;
    onSettings: () => void;
    onLaunchGame: (id: string) => void;
    onSetStatus: (labelId: number) => void;
    onSetVote: (vote: number) => void;
    formatPlayTime: (m: number) => string;
    formatLastPlayed: (timestamp: string | null) => string;
    shouldBlur: (img: VndbImage | null) => boolean;
}

export function Detail(props: DetailProps) {
    const [showStatusDropdown, setShowStatusDropdown] = createSignal(false);
    const [showVoteDropdown, setShowVoteDropdown] = createSignal(false);

    // Group and sort traits
    const groupTraits = (traits: VndbTrait[] | null, showSpoiler: boolean): [string, VndbTrait[]][] => {
        if (!traits) return [];
        const groups: Record<string, VndbTrait[]> = {};
        traits.filter(t => showSpoiler || t.spoiler === 0).forEach(t => {
            const g = t.group_name || "Other";
            if (!groups[g]) groups[g] = [];
            groups[g].push(t);
        });
        return TRAIT_ORDER.filter(g => groups[g])
            .map(g => [g, groups[g]] as [string, VndbTrait[]])
            .concat(Object.entries(groups).filter(([g]) => !TRAIT_ORDER.includes(g)));
    };

    // Render trait value with spoiler indicator
    const TraitValue = (p: { traits: VndbTrait[] }) => (
        <span>
            <For each={p.traits}>{(t, i) => (
                <>
                    <Show when={i() > 0}>, </Show>
                    <span class={t.spoiler > 0 ? "text-orange-400" : "text-gray-200"}>
                        {t.name}
                        <Show when={t.spoiler > 0}>
                            <sup class="text-orange-500 text-[10px] ml-0.5">S</sup>
                        </Show>
                    </span>
                </>
            )}</For>
        </span>
    );

    return (
        <div class="flex h-screen bg-[#0F172A] font-['Figtree'] text-slate-200 overflow-hidden">
            <Sidebar
                onBack={props.onBack}
                onRefresh={props.onRefresh}
                showSpoilers={props.showSpoilers}
                onToggleSpoilers={() => props.setShowSpoilers(!props.showSpoilers)}
                onSettings={props.onSettings}
            />

            {/* Main Content Area */}
            <div class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Background Pattern/Gradient */}
                <div class="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                {/* Tab Navigation Header */}
                <div class="flex items-center gap-8 px-8 py-6 z-10">
                    <div class="flex items-center gap-1 bg-[#1E293B] p-1 rounded-full">
                        <button
                            onClick={() => props.setPage("detail")}
                            class={`px-6 py-2 rounded-full text-sm font-bold transition-all ${props.page === "detail" ? "bg-[#38BDF8] text-[#0F172A] shadow-lg shadow-sky-500/20" : "text-slate-400 hover:text-slate-200"}`}
                        >
                            Game Info
                        </button>
                        <button
                            onClick={() => props.setPage("detail-chars")}
                            class={`px-6 py-2 rounded-full text-sm font-bold transition-all ${props.page === "detail-chars" ? "bg-[#38BDF8] text-[#0F172A] shadow-lg shadow-sky-500/20" : "text-slate-400 hover:text-slate-200"}`}
                        >
                            Characters
                        </button>
                    </div>

                    <div class="flex-1"></div>

                    {/* Primary Action */}
                    <Show when={props.game}>
                        <Show when={props.runningGame !== props.game.id} fallback={
                            <button class="px-6 py-2.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full font-bold text-sm tracking-wide flex items-center gap-2 cursor-default">
                                <Clock class="w-4 h-4" /> RUNNING
                            </button>
                        }>
                            <button onClick={() => props.onLaunchGame(props.game.id)} class="group relative px-8 py-2.5 bg-white text-black rounded-full font-bold text-sm tracking-wide overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all">
                                <span class="relative z-10 flex items-center gap-2"><Play class="w-4 h-4 fill-current" /> PLAY NOW</span>
                                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                            </button>
                        </Show>
                    </Show>
                </div>

                {/* Scrollable Content */}
                <div class="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar z-10">
                    {/* === GAME INFO TAB === */}
                    <Show when={props.page === "detail"}>
                        <div class="max-w-6xl mx-auto space-y-8">
                            <div>
                                <h1 class="text-[64px] leading-tight font-extrabold text-white tracking-tight drop-shadow-2xl">
                                    {props.vnDetail.title}
                                </h1>
                                <Show when={props.vnDetail.title !== props.game.title}>
                                    <p class="text-xl text-slate-400 font-light mt-2">{props.game.title}</p>
                                </Show>
                            </div>

                            <div class="flex gap-10">
                                {/* Left Col: Cover */}
                                <div class="w-[300px] shrink-0">
                                    <div class="aspect-[2/3] w-full rounded-[24px] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] bg-[#1E293B] border border-white/5 relative group">
                                        <Show when={props.vnDetail.image?.url} fallback={<div class="flex items-center justify-center h-full"><Gamepad2 class="w-20 h-20 text-slate-600" /></div>}>
                                            <img src={props.vnDetail.image!.url} alt={props.vnDetail.title} class={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${props.shouldBlur(props.vnDetail.image) ? "blur-xl scale-110" : ""}`} />
                                        </Show>
                                        <Show when={props.vnDetail.rating}>
                                            <div class="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5 shadow-xl">
                                                <Star class="w-4 h-4 text-yellow-400 fill-current" />
                                                <span class="text-white font-bold">{(props.vnDetail.rating! / 10).toFixed(2)}</span>
                                            </div>
                                        </Show>
                                    </div>
                                </div>

                                {/* Right Col: Stats & Details */}
                                <div class="flex-1 space-y-8">
                                    <div class="grid grid-cols-3 gap-4">
                                        {/* Vote Stat */}
                                        <div class="relative bg-[#1E293B]/50 border border-slate-700/50 p-4 rounded-[20px] flex flex-col gap-1 items-start group hover:bg-[#1E293B] transition-colors">
                                            <div class="flex items-center gap-2 text-slate-400 text-sm font-medium">
                                                <Star class="w-4 h-4" /> Your Vote
                                            </div>
                                            <button onClick={() => setShowVoteDropdown(!showVoteDropdown())} class="flex items-center gap-2 w-full text-left">
                                                <span class="text-2xl font-bold text-white">
                                                    {props.userVn?.vote ? (props.userVn.vote / 10).toFixed(1) : "Rate..."}
                                                </span>
                                                <ChevronDown class={`w-5 h-5 text-slate-400 transition-transform ${showVoteDropdown() ? "rotate-180" : ""}`} />
                                            </button>
                                            <Show when={showVoteDropdown()}>
                                                <div class="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1E293B]/95 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                                                    <div class="max-h-64 overflow-y-auto custom-scrollbar">
                                                        <button onClick={() => { props.onSetVote(0); setShowVoteDropdown(false); }} class="w-full px-4 py-3 text-left text-slate-400 hover:bg-[#334155] hover:text-white transition-colors flex items-center gap-3 border-b border-slate-700/50">
                                                            <span class="text-lg">—</span>
                                                            <span class="text-sm">No Rating</span>
                                                        </button>
                                                        <For each={[100, 90, 80, 70, 60, 50, 40, 30, 20, 10]}>{(v) => (
                                                            <button onClick={() => { props.onSetVote(v); setShowVoteDropdown(false); }} class={`w-full px-4 py-3 text-left hover:bg-[#334155] transition-colors flex items-center gap-3 ${props.userVn?.vote === v ? "bg-purple-600/20 text-purple-300" : "text-slate-200 hover:text-white"}`}>
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

                                        {/* Status Dropdown */}
                                        <div class="relative bg-[#1E293B]/50 border border-slate-700/50 p-4 rounded-[20px] flex flex-col gap-1 items-start hover:bg-[#1E293B] transition-colors">
                                            <div class="flex items-center gap-2 text-slate-400 text-sm font-medium">
                                                <Gamepad2 class="w-4 h-4" /> Status
                                            </div>
                                            <button onClick={() => setShowStatusDropdown(!showStatusDropdown())} class="flex items-center gap-2 w-full text-left">
                                                <span class="text-2xl font-bold text-white">
                                                    {props.userVn?.labels?.[0]?.label || "Set Status"}
                                                </span>
                                                <ChevronDown class={`w-5 h-5 text-slate-400 transition-transform ${showStatusDropdown() ? "rotate-180" : ""}`} />
                                            </button>
                                            <Show when={showStatusDropdown()}>
                                                <div class="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1E293B]/95 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                                                    <For each={STATUS_LABELS}>{(label) => (
                                                        <button onClick={() => { props.onSetStatus(label.id); setShowStatusDropdown(false); }} class={`w-full px-4 py-3 text-left hover:bg-[#334155] transition-colors flex items-center gap-3 ${props.userVn?.labels?.some(l => l.id === label.id) ? "bg-sky-600/20 text-sky-300" : "text-slate-200 hover:text-white"}`}>
                                                            <div class={`w-2 h-2 rounded-full ${label.id === 1 ? "bg-green-400" : label.id === 2 ? "bg-sky-400" : label.id === 3 ? "bg-yellow-400" : label.id === 4 ? "bg-red-400" : label.id === 5 ? "bg-purple-400" : "bg-slate-600"}`} />
                                                            <span class="font-medium">{label.name}</span>
                                                            <Show when={props.userVn?.labels?.some(l => l.id === label.id)}>
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
                                                {props.formatPlayTime(props.game.play_time)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Last Played */}
                                    <div class="bg-[#1E293B]/50 border border-slate-700/50 p-4 rounded-[20px] flex flex-col gap-1 items-start hover:bg-[#1E293B] transition-colors">
                                        <div class="flex items-center gap-2 text-slate-400 text-sm font-medium">
                                            <Clock class="w-4 h-4" /> Last Played
                                        </div>
                                        <div class="text-2xl font-bold text-white">
                                            {props.formatLastPlayed(props.game.last_played)}
                                        </div>
                                    </div>

                                    <div class="flex flex-wrap gap-x-8 gap-y-2 text-[#94A3B8] font-light text-lg">
                                        <Show when={props.vnDetail.length}>
                                            <span class="flex items-center gap-2">Length: <span class="text-slate-200 font-normal">{LENGTH_NAMES[props.vnDetail.length!]}</span></span>
                                        </Show>
                                    </div>

                                    <div class="font-['Roboto'] text-lg leading-relaxed text-[#F1F5F9]/80 whitespace-pre-line max-w-3xl">
                                        {props.vnDetail.description?.replace(/\[.*?\]/g, "")}
                                    </div>

                                    <button onClick={() => window.open(`https://vndb.org/${props.game.vndb_id}`, "_blank")} class="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#334155] to-[#1E293B] hover:from-[#475569] hover:to-[#334155] border border-slate-600/50 rounded-xl text-slate-200 hover:text-white font-medium transition-all shadow-lg hover:shadow-xl group">
                                        <ExternalLink class="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        View on VNDB
                                    </button>

                                    <Show when={props.vnDetail.tags?.length}>
                                        <div>
                                            <h3 class="text-sm uppercase tracking-wider text-slate-500 font-bold mb-3 font-['Plus_Jakarta_Sans']">Tags</h3>
                                            <div class="flex flex-wrap gap-2">
                                                <For each={props.vnDetail.tags!.filter(t => t.spoiler === 0).slice(0, 15)}>{(tag) => (
                                                    <span class="px-3 py-1.5 rounded-lg bg-[#334155]/40 text-[#CBD5E1] text-sm font-['Plus_Jakarta_Sans'] border border-white/5 hover:bg-[#334155] transition-colors cursor-default">
                                                        {tag.name}
                                                    </span>
                                                )}</For>
                                                <Show when={props.vnDetail.tags!.length > 15}>
                                                    <span class="px-3 py-1.5 text-slate-500 text-sm font-medium">+{props.vnDetail.tags!.length - 15} more</span>
                                                </Show>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* === CHARACTERS TAB === */}
                    <Show when={props.page === "detail-chars"}>
                        <div class="max-w-6xl mx-auto">
                            <Show when={props.characters.length > 0} fallback={<div class="text-slate-500 text-center py-20 text-lg">No character data available.</div>}>
                                <div class="flex items-center justify-between mb-8">
                                    <h2 class="text-2xl font-bold text-white">Characters ({props.characters.filter(c => props.showSpoilers || (c.vns?.find(v => v.id === props.vnDetail.id)?.spoiler || 0) === 0).length})</h2>
                                    <div class="text-sm text-slate-400 bg-[#1E293B] px-4 py-2 rounded-lg border border-slate-700">
                                        {props.showSpoilers ? "Show Spoilers: ON" : "Show Spoilers: OFF"}
                                    </div>
                                </div>

                                <div class="space-y-10">
                                    <For each={(() => {
                                        const vnId = props.vnDetail.id;
                                        const filtered = props.characters.filter(c => {
                                            const v = c.vns?.find(x => x.id === vnId);
                                            return props.showSpoilers || (v?.spoiler || 0) === 0;
                                        });

                                        const groups: Record<string, VndbCharacter[]> = {};
                                        filtered.forEach(char => {
                                            const vnInfo = char.vns?.find(v => v.id === vnId);
                                            const role = vnInfo?.role || "appears";
                                            if (!groups[role]) groups[role] = [];
                                            groups[role].push(char);
                                        });

                                        Object.values(groups).forEach(chars =>
                                            chars.sort((a, b) => a.name.localeCompare(b.name))
                                        );

                                        return ["main", "primary", "side", "appears"]
                                            .filter(role => groups[role]?.length)
                                            .map(role => ({ role, chars: groups[role] }));
                                    })()}>{(group) => (
                                        <div>
                                            <div class="flex items-center gap-4 mb-6">
                                                <h3 class="text-xl font-bold text-white font-['Plus_Jakarta_Sans']">
                                                    {ROLE_NAMES[group.role] || group.role}
                                                </h3>
                                                <span class="text-sm text-slate-500 bg-[#1E293B] px-3 py-1 rounded-full border border-slate-700">
                                                    {group.chars.length} {group.chars.length === 1 ? "character" : "characters"}
                                                </span>
                                                <div class="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
                                            </div>

                                            <div class="space-y-6">
                                                <For each={group.chars}>{(char) => {
                                                    const vn = () => char.vns?.find(v => v.id === props.vnDetail.id);
                                                    const isSpoiler = () => (vn()?.spoiler || 0) > 0;
                                                    const traits = () => groupTraits(char.traits, props.showSpoilers);
                                                    const sex = () => char.sex?.[0];
                                                    const role = () => vn()?.role || "appears";

                                                    return (
                                                        <div class="flex gap-6 bg-[#1E293B]/40 rounded-2xl p-6 border border-[#334155]/50 hover:border-[#38BDF8]/30 transition-all">
                                                            <div class="w-48 flex-shrink-0">
                                                                <Show when={char.image?.url} fallback={<div class="aspect-[3/4] bg-slate-800 rounded-xl flex items-center justify-center"><User class="w-12 h-12 text-slate-600" /></div>}>
                                                                    <img src={char.image!.url} alt={char.name} class={`w-full rounded-xl shadow-lg border border-white/5 ${(!props.showSpoilers && isSpoiler()) || props.shouldBlur(char.image) ? "blur-xl" : ""}`} />
                                                                </Show>
                                                            </div>

                                                            <div class="flex-1 min-w-0">
                                                                <div class="flex items-center gap-3 mb-4 border-b border-slate-700/50 pb-4 flex-wrap">
                                                                    <h3 class={`text-2xl font-bold font-['Plus_Jakarta_Sans'] ${isSpoiler() ? "text-orange-400" : "text-white"}`}>{char.name}</h3>
                                                                    <Show when={char.original}><span class="text-slate-500 text-lg">{char.original}</span></Show>
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
                                                                        <For each={traits()}>{([tgroup, items]) => (
                                                                            <tr><td class="text-slate-500 py-1.5 pr-6 align-top font-medium">{tgroup}</td><td class="py-1.5"><TraitValue traits={items} /></td></tr>
                                                                        )}</For>
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
    );
}
