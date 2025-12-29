import { Show, createEffect, onCleanup } from "solid-js";
import {
  Play,
  Search,
  Trash2,
  Gamepad2,
  EyeOff,
  Eye,
  MoreHorizontal,
} from "lucide-solid";
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
  activeContextMenu: string | null;
  onContextMenuOpen: (gameId: string) => void;
}

export function GameCard(props: GameCardProps) {
  let menuRef: HTMLDivElement | undefined;
  let cardRef: HTMLDivElement | undefined;

  const showMenu = () => props.activeContextMenu === props.game.id;

  const getMenuPosition = () => {
    if (!cardRef) return { x: 0, y: 0 };
    const rect = cardRef.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onContextMenuOpen(props.game.id);
  };

  const handleThreeDotsClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onContextMenuOpen(props.game.id);
  };

  const closeMenu = () => {
    if (props.activeContextMenu === props.game.id) {
      props.onContextMenuOpen("");
    }
  };

  createEffect(() => {
    if (showMenu()) {
      const handleOutsideClick = (e: MouseEvent) => {
        if (menuRef && !menuRef.contains(e.target as Node)) {
          closeMenu();
        }
      };

      setTimeout(() => {
        window.addEventListener("click", handleOutsideClick);
        window.addEventListener("contextmenu", handleOutsideClick);
      }, 0);

      onCleanup(() => {
        window.removeEventListener("click", handleOutsideClick);
        window.removeEventListener("contextmenu", handleOutsideClick);
      });
    }
  });

  return (
    <>
      <div
        ref={cardRef}
        class={`group relative aspect-[2/3] bg-[#1E293B] rounded-2xl overflow-hidden border border-white/5 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50 ${props.game.is_hidden && props.showHidden ? "opacity-50 grayscale" : ""
          } ${props.isRunning ? "ring-2 ring-green-500 shadow-[0_0_20px_rgba(74,222,128,0.3)]" : ""}`}
        onClick={() => props.onClick(props.game)}
        onContextMenu={handleContextMenu}
      >
        {/* Background Image */}
        <Show
          when={props.game.cover_url}
          fallback={
            <div class="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-900">
              <Gamepad2 class="w-16 h-16 text-slate-600 mb-4" />
              <h3 class="text-slate-400 text-center font-bold line-clamp-2">
                {props.game.title}
              </h3>
            </div>
          }
        >
          <img
            src={props.game.cover_url!}
            alt={props.game.title}
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        </Show>

        {/* Gradient Overlay */}
        <div class="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity"></div>

        {/* Content Overlay */}
        <div class="absolute inset-0 p-4 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div class="flex justify-between items-start">
            {/* 3-Dot Button - Now functional */}
            <button
              onClick={handleThreeDotsClick}
              class="bg-black/60 backdrop-blur-md rounded-full px-2 py-1 hover:bg-black/80 transition-colors"
            >
              <MoreHorizontal class="w-4 h-4 text-white" />
            </button>
          </div>

          <div class="space-y-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 pb-2">
            <h3 class="text-white font-bold leading-tight drop-shadow-md line-clamp-2">
              {props.game.title}
            </h3>

            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-300 bg-black/50 px-2 py-1 rounded-md">
                {props.formatPlayTime(props.game.play_time)}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onPlay(props.game.id);
                }}
                class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-white/20"
              >
                <Play class="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Running Indicator */}
        <Show when={props.isRunning}>
          <div class="absolute top-4 left-4 px-2 py-1 bg-green-500 text-black text-xs font-bold rounded shadow-lg animate-pulse">
            RUNNING
          </div>
        </Show>

        {/* Hidden Indicator */}
        <Show when={props.game.is_hidden && props.showHidden}>
          <div class="absolute top-4 right-4 bg-black/60 backdrop-blur rounded p-1.5">
            <EyeOff class="w-4 h-4 text-slate-400" />
          </div>
        </Show>
      </div>

      {/* Context Menu */}
      <Show when={showMenu()}>
        <div
          ref={menuRef}
          class="fixed z-50 bg-[#1E293B] border border-slate-700/50 rounded-xl shadow-2xl py-1.5 min-w-[180px] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${getMenuPosition().x}px`,
            top: `${getMenuPosition().y}px`,
            transform: "translate(-50%, -50%)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onPlay(props.game.id);
              closeMenu();
            }}
            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-200 hover:bg-[#334155] hover:text-white transition-colors"
          >
            <Play class="w-4 h-4 text-green-400" /> Play Game
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onSearch(props.game);
              closeMenu();
            }}
            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-200 hover:bg-[#334155] hover:text-white transition-colors"
          >
            <Search class="w-4 h-4 text-blue-400" /> Search VNDB
          </button>
          <div class="h-px bg-slate-700/50 my-1 mx-2" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onHide(props.game.id, !props.game.is_hidden);
              closeMenu();
            }}
            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-200 hover:bg-[#334155] hover:text-white transition-colors"
          >
            <Show
              when={props.game.is_hidden}
              fallback={
                <>
                  <EyeOff class="w-4 h-4 text-slate-400" /> Hide Game
                </>
              }
            >
              <Eye class="w-4 h-4 text-slate-400" /> Unhide Game
            </Show>
          </button>
          <div class="h-px bg-slate-700/50 my-1 mx-2" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove(props.game.id);
              closeMenu();
            }}
            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 class="w-4 h-4" /> Remove Game
          </button>
        </div>
      </Show>
    </>
  );
}
