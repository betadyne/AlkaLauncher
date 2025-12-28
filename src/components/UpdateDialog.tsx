import { Show } from "solid-js";
import { X, Download, RefreshCw, CheckCircle, AlertCircle } from "lucide-solid";
import type { UpdateStatus, UpdateInfo } from "../hooks/useUpdater";

interface UpdateDialogProps {
    status: UpdateStatus;
    updateInfo: UpdateInfo | null;
    downloadProgress: number;
    error: string | null;
    onDownload: () => void;
    onRestart: () => void;
    onDismiss: () => void;
}

export function UpdateDialog(props: UpdateDialogProps) {
    const showDialog = () =>
        props.status === "available" ||
        props.status === "downloading" ||
        props.status === "ready" ||
        props.status === "error";

    return (
        <Show when={showDialog()}>
            <div
                class="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
                onClick={props.onDismiss}
            >
                <div
                    class="bg-slate-800 rounded-lg w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="flex items-center justify-between p-4 border-b border-slate-700">
                        <h2 class="text-lg font-bold text-white flex items-center gap-2">
                            <Show when={props.status === "available"}>
                                <Download class="w-5 h-5 text-blue-400" />
                                Update Available
                            </Show>
                            <Show when={props.status === "downloading"}>
                                <RefreshCw class="w-5 h-5 text-blue-400 animate-spin" />
                                Downloading Update
                            </Show>
                            <Show when={props.status === "ready"}>
                                <CheckCircle class="w-5 h-5 text-green-400" />
                                Update Ready
                            </Show>
                            <Show when={props.status === "error"}>
                                <AlertCircle class="w-5 h-5 text-red-400" />
                                Update Error
                            </Show>
                        </h2>
                        <button
                            onClick={props.onDismiss}
                            class="text-gray-400 hover:text-white"
                        >
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <div class="p-4 space-y-4">
                        {/* Update Available */}
                        <Show when={props.status === "available" && props.updateInfo}>
                            <div class="space-y-3">
                                <p class="text-gray-300">
                                    A new version <span class="text-white font-semibold">v{props.updateInfo!.version}</span> is available!
                                </p>
                                <div class="bg-slate-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                                    <h4 class="text-sm font-medium text-gray-300 mb-2">Release Notes:</h4>
                                    <p class="text-sm text-gray-400 whitespace-pre-wrap">
                                        {props.updateInfo!.body}
                                    </p>
                                </div>
                                <div class="flex gap-3 pt-2">
                                    <button
                                        onClick={props.onDownload}
                                        class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium flex items-center justify-center gap-2"
                                    >
                                        <Download class="w-4 h-4" />
                                        Download & Install
                                    </button>
                                    <button
                                        onClick={props.onDismiss}
                                        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-gray-300"
                                    >
                                        Later
                                    </button>
                                </div>
                            </div>
                        </Show>

                        {/* Downloading */}
                        <Show when={props.status === "downloading"}>
                            <div class="space-y-3">
                                <p class="text-gray-300">Downloading update...</p>
                                <div class="w-full bg-slate-700 rounded-full h-2">
                                    <div
                                        class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${props.downloadProgress}%` }}
                                    />
                                </div>
                                <p class="text-sm text-gray-400 text-center">
                                    {Math.round(props.downloadProgress)}%
                                </p>
                            </div>
                        </Show>

                        {/* Ready to Restart */}
                        <Show when={props.status === "ready"}>
                            <div class="space-y-3">
                                <p class="text-gray-300">
                                    Update downloaded successfully! Restart to apply the update.
                                </p>
                                <div class="flex gap-3 pt-2">
                                    <button
                                        onClick={props.onRestart}
                                        class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw class="w-4 h-4" />
                                        Restart Now
                                    </button>
                                    <button
                                        onClick={props.onDismiss}
                                        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-gray-300"
                                    >
                                        Later
                                    </button>
                                </div>
                            </div>
                        </Show>

                        {/* Error */}
                        <Show when={props.status === "error"}>
                            <div class="space-y-3">
                                <p class="text-red-400">
                                    Failed to check for updates: {props.error}
                                </p>
                                <button
                                    onClick={props.onDismiss}
                                    class="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-gray-300"
                                >
                                    Close
                                </button>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>
        </Show>
    );
}
