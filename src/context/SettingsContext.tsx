import { createContext, createSignal, useContext, ParentComponent } from "solid-js";
import type { AppSettings } from "../bindings";
import * as api from "../api";

interface SettingsContextValue {
    settings: () => AppSettings;
    authUser: () => string | null;
    loading: () => boolean;
    loadSettings: () => Promise<void>;
    saveToken: (token: string) => Promise<boolean>;
    clearToken: () => Promise<void>;
    toggleBlurNsfw: () => Promise<void>;
    toggleDiscordRpc: () => Promise<void>;
    updateDiscordButtons: (vndbGame: boolean, vndbProfile: boolean, github: boolean) => Promise<boolean>;
    checkAuth: () => Promise<string | null>;
}

const SettingsContext = createContext<SettingsContextValue>();

const defaultSettings: AppSettings = {
    vndb_token: null,
    vndb_user_id: null,
    blur_nsfw: false,
    discord_rpc_enabled: true,
    discord_btn_vndb_game: true,
    discord_btn_vndb_profile: false,
    discord_btn_github: false,
};

export const SettingsProvider: ParentComponent = (props) => {
    const [settings, setSettings] = createSignal<AppSettings>(defaultSettings);
    const [authUser, setAuthUser] = createSignal<string | null>(null);
    const [loading, setLoading] = createSignal(true);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const settings = await api.getSettings();
            setSettings(settings);
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
        setLoading(false);
    };

    const saveToken = async (token: string): Promise<boolean> => {
        const result = await api.saveVndbToken(token);
        if (result.status === "ok") {
            setSettings((prev) => ({ ...prev, vndb_token: token }));
            await checkAuth();
            return true;
        }
        return false;
    };

    const clearToken = async () => {
        const result = await api.clearVndbToken();
        if (result.status === "ok") {
            setSettings((prev) => ({ ...prev, vndb_token: null, vndb_user_id: null }));
            setAuthUser(null);
        }
    };

    const toggleBlurNsfw = async () => {
        const newValue = !settings().blur_nsfw;
        const result = await api.setBlurNsfw(newValue);
        if (result.status === "ok") {
            setSettings((prev) => ({ ...prev, blur_nsfw: newValue }));
        }
    };

    const toggleDiscordRpc = async () => {
        const newValue = !settings().discord_rpc_enabled;
        const result = await api.setDiscordRpcEnabled(newValue);
        if (result.status === "ok") {
            setSettings((prev) => ({ ...prev, discord_rpc_enabled: newValue }));
        }
    };

    const checkAuth = async (): Promise<string | null> => {
        const result = await api.vndbAuthCheck();
        if (result.status === "ok") {
            setAuthUser(result.data.username);
            return result.data.username;
        }
        setAuthUser(null);
        return null;
    };

    const updateDiscordButtons = async (vndbGame: boolean, vndbProfile: boolean, github: boolean): Promise<boolean> => {
        const result = await api.setDiscordRpcButtons(vndbGame, vndbProfile, github);
        if (result.status === "ok") {
            setSettings((prev) => ({
                ...prev,
                discord_btn_vndb_game: vndbGame,
                discord_btn_vndb_profile: vndbProfile,
                discord_btn_github: github,
            }));
            return true;
        }
        return false;
    };

    loadSettings().then(() => {
        if (settings().vndb_token) {
            checkAuth();
        }
    });

    const value: SettingsContextValue = {
        settings,
        authUser,
        loading,
        loadSettings,
        saveToken,
        clearToken,
        toggleBlurNsfw,
        toggleDiscordRpc,
        updateDiscordButtons,
        checkAuth,
    };

    return <SettingsContext.Provider value={value}>{props.children}</SettingsContext.Provider>;
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
};
