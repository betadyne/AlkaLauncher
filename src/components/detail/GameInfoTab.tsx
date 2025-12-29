import { createSignal, For, Show, onCleanup } from "solid-js";
import { Gamepad2, Clock, Star, ExternalLink, ChevronDown, AlertCircle, X } from "lucide-solid";
import { open } from "@tauri-apps/plugin-shell";
import type { Game, VndbVnDetail, VndbUserListItem, VndbImage } from "../../types";
import { STATUS_LABELS, LENGTH_NAMES } from "../../constants";

interface GameInfoTabProps {
    game: Game;
    vnDetail: VndbVnDetail;
    userVn: VndbUserListItem | null;
    isVndbConnected: boolean;
    shouldBlur: (img: VndbImage | null) => boolean;
    formatPlayTime: (m: number) => string;
    formatLastPlayed: (timestamp: string | null) => string;
    onSetStatus: (labelId: number) => void;
    onSetVote: (vote: number) => void;
}

export function GameInfoTab(props: GameInfoTabProps) {
    const [showStatusDropdown, setShowStatusDropdown] = createSignal(false);
    const [showVoteDropdown, setShowVoteDropdown] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    // Auto-dismiss error after 4 seconds
    let errorTimeout: ReturnType<typeof setTimeout> | undefined;
    const showError = (message: string) => {
        clearTimeout(errorTimeout);
        setErrorMessage(message);
        errorTimeout = setTimeout(() => setErrorMessage(null), 4000);
    };
    onCleanup(() => clearTimeout(errorTimeout));

    const handleVoteClick = () => {
        if (!props.isVndbConnected) {
            showError("You need to connect to VNDB first");
            return;
        }
        setShowVoteDropdown(!showVoteDropdown());
    };

    const handleStatusClick = () => {
        if (!props.isVndbConnected) {
            showError("You need to connect to VNDB first");
            return;
        }
        setShowStatusDropdown(!showStatusDropdown());
    };

    return (
        <>
            {/* Error Notification Toast */}
            <Show when={errorMessage()}>
                <div class="fixed top-20 left-1/2 z-[100] animate-fade-in-down">
                    <div class="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-red-900/95 to-red-800/95 backdrop-blur-xl border border-red-500/30 rounded-2xl shadow-2xl shadow-red-900/40">
                        <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
                        <span class="text-red-100 font-medium text-sm">{errorMessage()}</span>
                        <button
                            onClick={() => setErrorMessage(null)}
                            class="ml-2 p-1 hover:bg-red-700/50 rounded-lg transition-colors"
                        >
                            <X class="w-4 h-4 text-red-300" />
                        </button>
                    </div>
                </div>
            </Show>

            <div class="max-w-6xl mx-auto space-y-8">
                {/* Title */}
                <div>
                    <h1 class="text-[64px] leading-tight font-extrabold text-white tracking-tight drop-shadow-2xl">
                        {props.vnDetail.title}
                    </h1>
                    <Show when={props.vnDetail.title !== props.game.title}>
                        <p class="text-xl text-slate-400 font-light mt-2">{props.game.title}</p>
                    </Show>
                </div>

                {/* Developer */}
                <Show when={props.vnDetail.developers?.length}>
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-slate-400 text-sm font-medium">Developers : </span>
                        <For each={props.vnDetail.developers}>
                            {(dev) => (
                                <span class="px-3 py-1.5 bg-white border border-slate-600/50 rounded-lg text-black text-sm font-medium hover:bg-neutral-200 transition-colors">
                                    {dev.name}
                                </span>
                            )}
                        </For>
                    </div>
                </Show>

                <div class="flex gap-10">
                    {/* Left Col: Cover */}
                    <div class="w-[300px] shrink-0">
                        <div class="aspect-[2/3] w-full rounded-[24px] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] bg-[#1E293B] border border-white/5 relative group">
                            <Show when={props.vnDetail.image?.url} fallback={
                                <div class="flex items-center justify-center h-full">
                                    <Gamepad2 class="w-20 h-20 text-slate-600" />
                                </div>
                            }>
                                <img
                                    src={props.vnDetail.image!.url}
                                    alt={props.vnDetail.title}
                                    class={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${props.shouldBlur(props.vnDetail.image) ? "blur-xl scale-110" : ""
                                        }`}
                                />
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
                        {/* Stats Grid */}
                        <div class="grid grid-cols-3 gap-4">
                            {/* Vote Dropdown */}
                            <div class="relative bg-[#1E293B]/50 border border-slate-700/50 p-4 rounded-[20px] flex flex-col gap-1 items-start group hover:bg-[#1E293B] transition-colors">
                                <div class="flex items-center gap-2 text-slate-400 text-sm font-medium">
                                    <Star class="w-4 h-4" /> Your Vote
                                </div>
                                <button onClick={handleVoteClick} class="flex items-center gap-2 w-full text-left">
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
                                <button onClick={handleStatusClick} class="flex items-center gap-2 w-full text-left">
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

                        {/* Length */}
                        <div class="flex flex-wrap gap-x-8 gap-y-2 text-[#94A3B8] font-light text-lg">
                            <Show when={props.vnDetail.length}>
                                <span class="flex items-center gap-2">
                                    Length: <span class="text-slate-200 font-normal">{LENGTH_NAMES[props.vnDetail.length!]}</span>
                                </span>
                            </Show>
                        </div>

                        {/* Description */}
                        <div class="font-['Roboto'] text-lg leading-relaxed text-[#F1F5F9]/80 whitespace-pre-line max-w-3xl">
                            {props.vnDetail.description?.replace(/\[(url|spoiler|quote|raw|code)(?:=[^\]]*)?]|\[\/(url|spoiler|quote|raw|code)]/gi, "")}
                        </div>

                        {/* VNDB Link */}
                        <button onClick={() => open(`https://vndb.org/${props.vnDetail.id}`)} class="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#334155] to-[#1E293B] hover:from-[#475569] hover:to-[#334155] border border-slate-600/50 rounded-xl text-slate-200 hover:text-white font-medium transition-all shadow-lg hover:shadow-xl group">
                            <ExternalLink class="w-4 h-4 group-hover:scale-110 transition-transform" />
                            View on VNDB
                        </button>

                        {/* Tags */}
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
        </>
    );
}
