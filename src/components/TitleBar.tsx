import { Minus, Square, X, Copy } from "lucide-solid";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createSignal, onMount } from "solid-js";

export function TitleBar() {
    const [isMaximized, setIsMaximized] = createSignal(false);
    const appWindow = getCurrentWindow();

    onMount(async () => {
        setIsMaximized(await appWindow.isMaximized());

        await appWindow.onResized(async () => {
            setIsMaximized(await appWindow.isMaximized());
        });
    });

    const handleMinimize = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await appWindow.minimize();
    };

    const handleMaximize = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await appWindow.toggleMaximize();
    };

    const handleClose = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await appWindow.close();
    };

    const handleDragStart = async () => {
        await appWindow.startDragging();
    };

    // Prevent drag when clicking on control buttons area
    const preventDrag = (e: MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div class="h-8 bg-[#0F172A] border-b border-slate-800/50 flex items-center select-none">
            {/* Drag Region - only this area initiates drag */}
            <div
                class="flex-1 h-full cursor-default"
                onMouseDown={handleDragStart}
            ></div>

            {/* Window Controls - Right Side (no drag here) */}
            <div
                class="flex items-center h-full"
                onMouseDown={preventDrag}
            >
                {/* Minimize */}
                <button
                    onClick={handleMinimize}
                    class="h-full w-11 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                    title="Minimize"
                >
                    <Minus class="w-4 h-4" />
                </button>

                {/* Maximize/Restore */}
                <button
                    onClick={handleMaximize}
                    class="h-full w-11 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                    title={isMaximized() ? "Restore" : "Maximize"}
                >
                    {isMaximized() ? (
                        <Copy class="w-3.5 h-3.5 rotate-180" />
                    ) : (
                        <Square class="w-3 h-3" />
                    )}
                </button>

                {/* Close */}
                <button
                    onClick={handleClose}
                    class="h-full w-11 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Close"
                >
                    <X class="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
