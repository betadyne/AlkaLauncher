import { createContext, createSignal, useContext, ParentComponent } from "solid-js";
import type { VndbVnDetail, VndbCharacter, VndbUserListItem, VndbSearchResult } from "../bindings";
import * as api from "../api";

interface VndbContextValue {
    vnDetail: () => VndbVnDetail | null;
    characters: () => VndbCharacter[];
    userVn: () => VndbUserListItem | null;
    searchResults: () => VndbSearchResult[];
    isSearching: () => boolean;
    fetchDetail: (vndbId: string, forceRefresh?: boolean) => Promise<VndbVnDetail | null>;
    fetchCharacters: (vndbId: string, forceRefresh?: boolean) => Promise<VndbCharacter[]>;
    fetchUserVn: (vndbId: string) => Promise<VndbUserListItem | null>;
    searchVndb: (query: string) => Promise<VndbSearchResult[]>;
    setStatus: (vndbId: string, labelId: number) => Promise<boolean>;
    setVote: (vndbId: string, vote: number) => Promise<boolean>;
    clearSearch: () => void;
    clearDetail: () => void;
}

const VndbContext = createContext<VndbContextValue>();

export const VndbProvider: ParentComponent = (props) => {
    const [vnDetail, setVnDetail] = createSignal<VndbVnDetail | null>(null);
    const [characters, setCharacters] = createSignal<VndbCharacter[]>([]);
    const [userVn, setUserVn] = createSignal<VndbUserListItem | null>(null);
    const [searchResults, setSearchResults] = createSignal<VndbSearchResult[]>([]);
    const [isSearching, setIsSearching] = createSignal(false);

    const fetchDetail = async (vndbId: string, forceRefresh = false): Promise<VndbVnDetail | null> => {
        const result = await api.fetchVndbDetail(vndbId, forceRefresh);
        if (result.status === "ok") {
            setVnDetail(result.data);
            return result.data;
        }
        return null;
    };

    const fetchCharacters = async (vndbId: string, forceRefresh = false): Promise<VndbCharacter[]> => {
        const result = await api.fetchVndbCharacters(vndbId, forceRefresh);
        if (result.status === "ok") {
            setCharacters(result.data);
            return result.data;
        }
        return [];
    };

    const fetchUserVn = async (vndbId: string): Promise<VndbUserListItem | null> => {
        const result = await api.vndbGetUserVn(vndbId);
        if (result.status === "ok") {
            setUserVn(result.data);
            return result.data;
        }
        return null;
    };

    const searchVndb = async (query: string): Promise<VndbSearchResult[]> => {
        if (!query.trim()) {
            setSearchResults([]);
            return [];
        }
        setIsSearching(true);
        const result = await api.searchVndb(query);
        setIsSearching(false);
        if (result.status === "ok") {
            setSearchResults(result.data);
            return result.data;
        }
        return [];
    };

    const setStatus = async (vndbId: string, labelId: number): Promise<boolean> => {
        const result = await api.vndbSetStatus(vndbId, labelId);
        if (result.status === "ok") {
            await fetchUserVn(vndbId);
            return true;
        }
        return false;
    };

    const setVote = async (vndbId: string, vote: number): Promise<boolean> => {
        const result = await api.vndbSetVote(vndbId, vote);
        if (result.status === "ok") {
            await fetchUserVn(vndbId);
            return true;
        }
        return false;
    };

    const clearSearch = () => {
        setSearchResults([]);
        setIsSearching(false);
    };

    const clearDetail = () => {
        setVnDetail(null);
        setCharacters([]);
        setUserVn(null);
    };

    const value: VndbContextValue = {
        vnDetail,
        characters,
        userVn,
        searchResults,
        isSearching,
        fetchDetail,
        fetchCharacters,
        fetchUserVn,
        searchVndb,
        setStatus,
        setVote,
        clearSearch,
        clearDetail,
    };

    return <VndbContext.Provider value={value}>{props.children}</VndbContext.Provider>;
};

export const useVndb = () => {
    const context = useContext(VndbContext);
    if (!context) {
        throw new Error("useVndb must be used within a VndbProvider");
    }
    return context;
};
