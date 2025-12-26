import { Show } from "solid-js";
import { ArrowLeft, RefreshCw, Eye, EyeOff, Settings } from "lucide-solid";

interface SidebarProps {
    onBack: () => void;
    onRefresh: () => void;
    showSpoilers: boolean;
    onToggleSpoilers: () => void;
    onSettings: () => void;
}

export function Sidebar(props: SidebarProps) {
    return (
        <aside class="w-[80px] flex flex-col items-center py-6 bg-[#0F172A]/50 border-r border-[#1E293B] shrink-0 gap-6 z-20">
            <button
                onClick={props.onBack}
                class="p-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-400 hover:text-white transition-all shadow-lg"
                title="Back"
            >
                <ArrowLeft class="w-6 h-6" />
            </button>

            <div class="h-px w-10 bg-[#334155] my-2"></div>

            <button
                onClick={props.onRefresh}
                class="p-3 rounded-xl hover:bg-[#1E293B] text-slate-400 hover:text-white transition-all"
                title="Refresh Data"
            >
                <RefreshCw class="w-6 h-6" />
            </button>

            <button
                onClick={props.onToggleSpoilers}
                class={`p-3 rounded-xl hover:bg-[#1E293B] transition-all relative ${props.showSpoilers ? "text-purple-400" : "text-slate-400 hover:text-white"}`}
                title="Toggle Spoilers"
            >
                <Show when={props.showSpoilers} fallback={<EyeOff class="w-6 h-6" />}>
                    <Eye class="w-6 h-6" />
                </Show>
            </button>

            <div class="flex-1"></div>

            <button
                onClick={props.onSettings}
                class="p-3 rounded-xl hover:bg-[#1E293B] text-slate-400 hover:text-white transition-all"
                title="Settings"
            >
                <Settings class="w-6 h-6" />
            </button>
        </aside>
    );
}
