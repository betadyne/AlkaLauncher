import { commands } from "../bindings";

export const searchVndb = (query: string) => commands.searchVndb(query);
export const fetchVndbDetail = (vndbId: string, forceRefresh?: boolean) =>
    commands.fetchVndbDetail(vndbId, forceRefresh ?? null);
export const fetchVndbCharacters = (vndbId: string, forceRefresh?: boolean) =>
    commands.fetchVndbCharacters(vndbId, forceRefresh ?? null);
export const clearVndbCache = (vndbId: string) => commands.clearVndbCache(vndbId);
export const clearAllCache = () => commands.clearAllCache();
export const vndbAuthCheck = () => commands.vndbAuthCheck();
export const vndbGetUserVn = (vndbId: string) => commands.vndbGetUserVn(vndbId);
export const vndbSetStatus = (vndbId: string, labelId: number) =>
    commands.vndbSetStatus(vndbId, labelId);
export const vndbSetVote = (vndbId: string, vote: number) =>
    commands.vndbSetVote(vndbId, vote);
export const vndbRemoveVote = (vndbId: string) => commands.vndbRemoveVote(vndbId);
