import { createContext, createSignal, useContext, onCleanup, ParentComponent } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import type { GameMetadata } from "../bindings";
import type { GameExitedPayload } from "../types";
import * as api from "../api";

interface GameContextValue {
    games: () => GameMetadata[];
    runningGame: () => string | null;
    loading: () => boolean;
    loadGames: () => Promise<void>;
    addGame: (path: string) => Promise<GameMetadata | null>;
    removeGame: (id: string) => Promise<void>;
    hideGame: (id: string, hidden: boolean) => Promise<void>;
    updateGame: (game: GameMetadata) => Promise<void>;
    launchGame: (id: string) => Promise<void>;
    stopTracking: () => Promise<number>;
}

const GameContext = createContext<GameContextValue>();

export const GameProvider: ParentComponent = (props) => {
    const [games, setGames] = createSignal<GameMetadata[]>([]);
    const [runningGame, setRunningGame] = createSignal<string | null>(null);
    const [loading, setLoading] = createSignal(true);

    const loadGames = async () => {
        setLoading(true);
        try {
            const games = await api.getAllGames();
            setGames(games);
        } catch (e) {
            console.error("Failed to load games:", e);
        }
        setLoading(false);
    };

    const addGame = async (path: string): Promise<GameMetadata | null> => {
        const result = await api.addLocalGame(path);
        if (result.status === "ok") {
            setGames((prev) => [...prev, result.data]);
            return result.data;
        }
        return null;
    };

    const removeGame = async (id: string) => {
        const result = await api.removeGame(id);
        if (result.status === "ok") {
            setGames((prev) => prev.filter((g) => g.id !== id));
        }
    };

    const hideGame = async (id: string, hidden: boolean) => {
        const result = await api.setGameHidden(id, hidden);
        if (result.status === "ok") {
            setGames((prev) => prev.map((g) => (g.id === id ? { ...g, is_hidden: hidden } : g)));
        }
    };

    const updateGame = async (game: GameMetadata) => {
        const result = await api.updateGame(game);
        if (result.status === "ok") {
            setGames((prev) => prev.map((g) => (g.id === game.id ? game : g)));
        }
    };

    const launchGame = async (id: string) => {
        const result = await api.launchGame(id);
        if (result.status === "ok") {
            setRunningGame(id);
        }
    };

    const stopTracking = async (): Promise<number> => {
        const result = await api.stopTracking();
        if (result.status === "ok") {
            setRunningGame(null);
            return result.data;
        }
        return 0;
    };

    listen<GameExitedPayload>("game-exited", (event) => {
        setRunningGame(null);
        setGames((prev) =>
            prev.map((g) =>
                g.id === event.payload.game_id
                    ? { ...g, play_time: g.play_time + event.payload.play_minutes }
                    : g
            )
        );
    }).then((unlisten) => {
        onCleanup(unlisten);
    });

    loadGames();

    const value: GameContextValue = {
        games,
        runningGame,
        loading,
        loadGames,
        addGame,
        removeGame,
        hideGame,
        updateGame,
        launchGame,
        stopTracking,
    };

    return <GameContext.Provider value={value}>{props.children}</GameContext.Provider>;
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error("useGame must be used within a GameProvider");
    }
    return context;
};
