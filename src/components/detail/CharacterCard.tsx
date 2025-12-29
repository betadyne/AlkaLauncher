import { For, Show } from "solid-js";
import { User } from "lucide-solid";
import type { VndbCharacter, VndbTrait, VndbImage } from "../../types";
import { ROLE_NAMES, TRAIT_ORDER } from "../../constants";

interface CharacterCardProps {
    character: VndbCharacter;
    vnId: string;
    showSpoilers: boolean;
    shouldBlur: (img: VndbImage | null) => boolean;
}

function groupTraits(traits: VndbTrait[] | null | undefined, showSpoiler: boolean): [string, VndbTrait[]][] {
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
}

function TraitValue(props: { traits: VndbTrait[] }) {
    return (
        <span>
            <For each={props.traits}>{(t, i) => (
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
}

export function CharacterCard(props: CharacterCardProps) {
    const vn = () => props.character.vns?.find(v => v.id === props.vnId);
    const isSpoiler = () => (vn()?.spoiler || 0) > 0;
    const traits = () => groupTraits(props.character.traits, props.showSpoilers);
    const sex = () => props.character.sex?.[0];
    const role = () => vn()?.role || "appears";
    const char = props.character;

    return (
        <div class="flex gap-6 bg-[#1E293B]/40 rounded-2xl p-6 border border-[#334155]/50 hover:border-[#38BDF8]/30 transition-all">
            {/* Character Image */}
            <div class="w-48 flex-shrink-0">
                <Show when={char.image?.url} fallback={
                    <div class="aspect-[3/4] bg-slate-800 rounded-xl flex items-center justify-center">
                        <User class="w-12 h-12 text-slate-600" />
                    </div>
                }>
                    <img
                        src={char.image!.url}
                        alt={char.name}
                        class={`w-full rounded-xl shadow-lg border border-white/5 ${(!props.showSpoilers && isSpoiler()) || props.shouldBlur(char.image) ? "blur-xl" : ""
                            }`}
                    />
                </Show>
            </div>

            {/* Character Info */}
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-4 border-b border-slate-700/50 pb-4 flex-wrap">
                    <h3 class={`text-2xl font-bold font-['Plus_Jakarta_Sans'] ${isSpoiler() ? "text-orange-400" : "text-white"}`}>
                        {char.name}
                    </h3>
                    <Show when={char.original}>
                        <span class="text-slate-500 text-lg">{char.original}</span>
                    </Show>
                    <span class={`text-xs px-2.5 py-1 rounded-full font-bold tracking-wide border ${role() === "main" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                        role() === "primary" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                            role() === "side" ? "bg-sky-500/10 text-sky-400 border-sky-500/30" :
                                "bg-slate-500/10 text-slate-400 border-slate-500/30"
                        }`}>
                        {ROLE_NAMES[role()] || role()}
                    </span>
                    <Show when={sex()}>
                        <span class="text-sky-400 text-sm ml-auto bg-sky-500/10 px-2 py-1 rounded">
                            {sex() === 'm' ? 'Male' : sex() === 'f' ? 'Female' : sex()}
                        </span>
                    </Show>
                    <Show when={isSpoiler()}>
                        <span class="text-orange-500 text-xs px-2 py-1 bg-orange-900/30 border border-orange-500/20 rounded font-bold tracking-wide">
                            SPOILER
                        </span>
                    </Show>
                </div>

                <table class="w-full text-sm text-slate-300">
                    <tbody>
                        <Show when={char.aliases?.length}>
                            <tr>
                                <td class="text-slate-500 py-1.5 pr-6 align-top w-32 font-medium">Aliases</td>
                                <td class="text-slate-200 py-1.5">{char.aliases!.join(", ")}</td>
                            </tr>
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
                                <td class="text-slate-500 py-1.5 pr-6 align-top font-medium">Measurements</td>
                                <td class="text-slate-200 py-1.5 flex gap-4">
                                    <Show when={char.height}><span>H: {char.height}cm</span></Show>
                                    <Show when={char.weight}><span>W: {char.weight}kg</span></Show>
                                    <Show when={char.bust}>
                                        <span>BWH: {char.bust}-{char.waist}-{char.hips} <Show when={char.cup}>({char.cup})</Show></span>
                                    </Show>
                                </td>
                            </tr>
                        </Show>
                        <For each={traits()}>{([tgroup, items]) => (
                            <tr>
                                <td class="text-slate-500 py-1.5 pr-6 align-top font-medium">{tgroup}</td>
                                <td class="py-1.5"><TraitValue traits={items} /></td>
                            </tr>
                        )}</For>
                        <Show when={char.description}>
                            <tr>
                                <td class="text-slate-500 py-3 pr-6 align-top font-medium" colspan="2">
                                    <div class="text-slate-300 text-sm whitespace-pre-line leading-relaxed font-['Roboto'] bg-[#0F172A]/30 p-4 rounded-lg border border-white/5 mt-2">
                                        {char.description!.replace(/\[(url|spoiler|quote|raw|code)(?:=[^\]]*)?]|\[\/(url|spoiler|quote|raw|code)]/gi, "")}
                                    </div>
                                </td>
                            </tr>
                        </Show>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
