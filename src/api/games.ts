import { commands } from "../bindings";

export const getAllGames = () => commands.getAllGames();
export const addLocalGame = (path: string) => commands.addLocalGame(path);
export const removeGame = (id: string) => commands.removeGame(id);
export const updateGame = (game: Parameters<typeof commands.updateGame>[0]) =>
    commands.updateGame(game);
export const setGameHidden = (id: string, hidden: boolean) =>
    commands.setGameHidden(id, hidden);
export const launchGame = (id: string) => commands.launchGame(id);
export const stopTracking = () => commands.stopTracking();
export const pollRunningGame = () => commands.pollRunningGame();
export const getElapsedTime = () => commands.getElapsedTime();
