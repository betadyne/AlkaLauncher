import { For, Show } from "solid-js";
import type { VndbCharacter, VndbImage } from "../../types";
import { ROLE_NAMES } from "../../constants";
import { CharacterCard } from "./CharacterCard";

interface CharacterListProps {
    characters: VndbCharacter[];
    vnId: string;
    showSpoilers: boolean;
    shouldBlur: (img: VndbImage | null) => boolean;
}

export function CharacterList(props: CharacterListProps) {
    // Filter and group characters by role
    const groupedCharacters = () => {
        const vnId = props.vnId;
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

        // Sort characters within each group alphabetically
        Object.values(groups).forEach(chars =>
            chars.sort((a, b) => a.name.localeCompare(b.name))
        );

        // Return in role priority order
        return ["main", "primary", "side", "appears"]
            .filter(role => groups[role]?.length)
            .map(role => ({ role, chars: groups[role] }));
    };

    const visibleCount = () => props.characters.filter(c => {
        const v = c.vns?.find(x => x.id === props.vnId);
        return props.showSpoilers || (v?.spoiler || 0) === 0;
    }).length;

    return (
        <div class="max-w-6xl mx-auto">
            <Show when={props.characters.length > 0} fallback={
                <div class="text-slate-500 text-center py-20 text-lg">No character data available.</div>
            }>
                {/* Header */}
                <div class="flex items-center justify-between mb-8">
                    <h2 class="text-2xl font-bold text-white">Characters ({visibleCount()})</h2>
                    <div class="text-sm text-slate-400 bg-[#1E293B] px-4 py-2 rounded-lg border border-slate-700">
                        {props.showSpoilers ? "Show Spoilers: ON" : "Show Spoilers: OFF"}
                    </div>
                </div>

                {/* Character Groups */}
                <div class="space-y-10">
                    <For each={groupedCharacters()}>{(group) => (
                        <div>
                            {/* Group Header */}
                            <div class="flex items-center gap-4 mb-6">
                                <h3 class="text-xl font-bold text-white font-['Plus_Jakarta_Sans']">
                                    {ROLE_NAMES[group.role] || group.role}
                                </h3>
                                <span class="text-sm text-slate-500 bg-[#1E293B] px-3 py-1 rounded-full border border-slate-700">
                                    {group.chars.length} {group.chars.length === 1 ? "character" : "characters"}
                                </span>
                                <div class="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
                            </div>

                            {/* Character Cards */}
                            <div class="space-y-6">
                                <For each={group.chars}>{(char) => (
                                    <CharacterCard
                                        character={char}
                                        vnId={props.vnId}
                                        showSpoilers={props.showSpoilers}
                                        shouldBlur={props.shouldBlur}
                                    />
                                )}</For>
                            </div>
                        </div>
                    )}</For>
                </div>
            </Show>
        </div>
    );
}
