import { commands } from "../bindings";

export const getSettings = () => commands.getSettings();
export const saveVndbToken = (token: string) => commands.saveVndbToken(token);
export const clearVndbToken = () => commands.clearVndbToken();
export const setBlurNsfw = (blur: boolean) => commands.setBlurNsfw(blur);
export const setDiscordRpcEnabled = (enabled: boolean) =>
    commands.setDiscordRpcEnabled(enabled);
export const setDiscordRpcButtons = (vndbGame: boolean, vndbProfile: boolean, github: boolean) =>
    commands.setDiscordRpcButtons(vndbGame, vndbProfile, github);
export const initApp = () => commands.initApp();
