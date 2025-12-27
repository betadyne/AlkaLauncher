import { Show } from "solid-js";
import { Play, Clock, Loader2 } from "lucide-solid";
import { Sidebar } from "../components/Sidebar";
import { GameInfoTab } from "../components/detail/GameInfoTab";
import { CharacterList } from "../components/detail/CharacterList";
import type { Game, VndbVnDetail, VndbCharacter, VndbUserListItem, AppSettings, VndbImage } from "../types";

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
    isRefreshing: boolean;
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
    return (
        <div class="flex h-full bg-[#0F172A] font-['Figtree'] text-slate-200 overflow-hidden">
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

                {/* Loading Overlay */}
                <Show when={props.isRefreshing}>
                    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40">
                        <div class="flex flex-col items-center gap-4">
                            <Loader2 class="w-12 h-12 text-slate-400 animate-spin" />
                            <span class="text-slate-400 text-lg font-medium">Refreshing data...</span>
                        </div>
                    </div>
                </Show>

                {/* Tab Navigation Header */}
                <div class="flex items-center gap-8 px-8 py-6 z-10">
                    <div class="flex items-center gap-1 bg-[#1E293B] p-1 rounded-full">
                        <button
                            onClick={() => props.setPage("detail")}
                            class={`px-6 py-2 rounded-full text-sm font-bold transition-all ${props.page === "detail"
                                    ? "bg-[#38BDF8] text-[#0F172A] shadow-lg shadow-sky-500/20"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                        >
                            Game Info
                        </button>
                        <button
                            onClick={() => props.setPage("detail-chars")}
                            class={`px-6 py-2 rounded-full text-sm font-bold transition-all ${props.page === "detail-chars"
                                    ? "bg-[#38BDF8] text-[#0F172A] shadow-lg shadow-sky-500/20"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
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
                    {/* Game Info Tab */}
                    <Show when={props.page === "detail"}>
                        <GameInfoTab
                            game={props.game}
                            vnDetail={props.vnDetail}
                            userVn={props.userVn}
                            shouldBlur={props.shouldBlur}
                            formatPlayTime={props.formatPlayTime}
                            formatLastPlayed={props.formatLastPlayed}
                            onSetStatus={props.onSetStatus}
                            onSetVote={props.onSetVote}
                        />
                    </Show>

                    {/* Characters Tab */}
                    <Show when={props.page === "detail-chars"}>
                        <CharacterList
                            characters={props.characters}
                            vnId={props.vnDetail.id}
                            showSpoilers={props.showSpoilers}
                            shouldBlur={props.shouldBlur}
                        />
                    </Show>
                </div>
            </div>
        </div>
    );
}
