import { Show, createSignal } from "solid-js";
import { Play, Search, Trash2, Gamepad2, EyeOff, Eye } from "lucide-solid";
import type { Game } from "../types";

interface GameCardProps {
    game: Game;
    isRunning: boolean;
    showHidden: boolean;
    formatPlayTime: (m: number) => string;
    onPlay: (id: string) => void;
    onRemove: (id: string) => void;
    onSearch: (game: Game) => void;
    onClick: (game: Game) => void;
    onHide: (id: string, hidden: boolean) => void;
}

export function GameCard(props: GameCardProps) {
    const [showContextMenu, setShowContextMenu] = createSignal(false);
    const [menuPosition, setMenuPosition] = createSignal({ x: 0, y: 0 });

    const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Position relative to viewport
        const x = e.clientX;
        const y = e.clientY;

        setMenuPosition({ x, y });
        setShowContextMenu(true);

        // Close menu when clicking outside
        const closeMenu = () => {
            setShowContextMenu(false);
            document.removeEventListener("click", closeMenu);
            document.removeEventListener("contextmenu", closeMenu);
        };

        // Delay adding listener to prevent immediate close
        setTimeout(() => {
            document.addEventListener("click", closeMenu);
            document.addEventListener("contextmenu", closeMenu);
        }, 0);
    };

    return (
        <>
            <div
                class={`group relative bg-slate-800/50 rounded overflow-hidden border cursor-pointer transition-all ${props.isRunning
                        ? "border-green-500"
                        : "border-slate-700 hover:border-purple-500"
                    } ${props.game.is_hidden && props.showHidden ? "opacity-50" : ""}`}
                onClick={() => props.onClick(props.game)}
                onContextMenu={handleContextMenu}
            >
                <div class="aspect-[3/4] bg-slate-700 flex items-center justify-center">
                    <Show when={props.game.cover_url} fallback={<Gamepad2 class="w-10 h-10 text-slate-500" />}>
                        <img src={props.game.cover_url!} alt={props.game.title} class="w-full h-full object-cover" />
                    </Show>
                    {/* Hidden indicator badge */}
                    <Show when={props.game.is_hidden && props.showHidden}>
                        <div class="absolute top-2 right-2 bg-slate-900/80 rounded-full p-1">
                            <EyeOff class="w-3.5 h-3.5 text-gray-400" />
                        </div>
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

            {/* Context Menu */}
            <Show when={showContextMenu()}>
                <div
                    class="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[160px]"
                    style={{ left: `${menuPosition().x}px`, top: `${menuPosition().y}px` }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onPlay(props.game.id);
                            setShowContextMenu(false);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
                    >
                        <Play class="w-4 h-4" /> Play Game
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onSearch(props.game);
                            setShowContextMenu(false);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
                    >
                        <Search class="w-4 h-4" /> Search VNDB
                    </button>
                    <div class="border-t border-slate-600 my-1" />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onHide(props.game.id, !props.game.is_hidden);
                            setShowContextMenu(false);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
                    >
                        <Show when={props.game.is_hidden} fallback={<><EyeOff class="w-4 h-4" /> Hide Game</>}>
                            <Eye class="w-4 h-4" /> Unhide Game
                        </Show>
                    </button>
                    <div class="border-t border-slate-600 my-1" />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onRemove(props.game.id);
                            setShowContextMenu(false);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                    >
                        <Trash2 class="w-4 h-4" /> Remove Game
                    </button>
                </div>
            </Show>
        </>
    );
}
