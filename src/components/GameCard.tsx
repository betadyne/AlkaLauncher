import { Show } from "solid-js";
import { Play, Search, Trash2, Gamepad2 } from "lucide-solid";
import type { Game } from "../types";

interface GameCardProps {
    game: Game;
    isRunning: boolean;
    formatPlayTime: (m: number) => string;
    onPlay: (id: string) => void;
    onRemove: (id: string) => void;
    onSearch: (game: Game) => void;
    onClick: (game: Game) => void;
}

export function GameCard(props: GameCardProps) {
    return (
        <div
            class={`group relative bg-slate-800/50 rounded overflow-hidden border cursor-pointer transition-all ${props.isRunning ? "border-green-500" : "border-slate-700 hover:border-purple-500"}`}
            onClick={() => props.onClick(props.game)}
        >
            <div class="aspect-[3/4] bg-slate-700 flex items-center justify-center">
                <Show when={props.game.cover_url} fallback={<Gamepad2 class="w-10 h-10 text-slate-500" />}>
                    <img src={props.game.cover_url!} alt={props.game.title} class="w-full h-full object-cover" />
                </Show>
            </div>
            <div class="p-2">
                <h3 class="text-white text-sm font-medium truncate">{props.game.title}</h3>
                <p class="text-xs text-gray-400">{props.formatPlayTime(props.game.play_time)}</p>
            </div>
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                <Show when={!props.isRunning} fallback={<span class="text-green-400 text-sm">Running...</span>}>
                    <button
                        onClick={(e) => { e.stopPropagation(); props.onPlay(props.game.id); }}
                        class="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm"
                    >
                        <Play class="w-4 h-4" /> Play
                    </button>
                </Show>
                <button
                    onClick={(e) => { e.stopPropagation(); props.onSearch(props.game); }}
                    class="flex items-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs"
                >
                    <Search class="w-3 h-3" /> VNDB
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); props.onRemove(props.game.id); }}
                    class="flex items-center gap-1 px-2 py-0.5 bg-red-600/50 hover:bg-red-600 rounded text-white text-xs"
                >
                    <Trash2 class="w-3 h-3" /> Remove
                </button>
            </div>
        </div>
    );
}
