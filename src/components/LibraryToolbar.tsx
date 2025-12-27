import { Show } from "solid-js";
import { Search, ArrowUpDown, Filter, X } from "lucide-solid";
import type { SortBy, SortOrder } from "../hooks/useLibraryFilters";

interface LibraryToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
}

export function LibraryToolbar(props: LibraryToolbarProps) {
  const sortOptions = [
    {
      value: "title-asc",
      label: "Title A-Z",
      sortBy: "title" as SortBy,
      sortOrder: "asc" as SortOrder,
    },
    {
      value: "title-desc",
      label: "Title Z-A",
      sortBy: "title" as SortBy,
      sortOrder: "desc" as SortOrder,
    },
    {
      value: "lastPlayed-desc",
      label: "Last Played ↓",
      sortBy: "lastPlayed" as SortBy,
      sortOrder: "desc" as SortOrder,
    },
    {
      value: "lastPlayed-asc",
      label: "Last Played ↑",
      sortBy: "lastPlayed" as SortBy,
      sortOrder: "asc" as SortOrder,
    },
  ];

  const currentSort = () => `${props.sortBy}-${props.sortOrder}`;

  const handleSortChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    const option = sortOptions.find((o) => o.value === value);
    if (option) {
      props.onSortByChange(option.sortBy);
      props.onSortOrderChange(option.sortOrder);
    }
  };

  return (
    <div class="flex items-center gap-3 mb-4">
      {/* Search Input */}
      <div class="relative flex-1 max-w-xs">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={props.searchQuery}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          placeholder="Search games..."
          class="w-full pl-9 pr-8 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <Show when={props.searchQuery}>
          <button
            onClick={() => props.onSearchChange("")}
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X class="w-4 h-4" />
          </button>
        </Show>
      </div>

      {/* Sort Dropdown */}
      <div class="relative">
        <ArrowUpDown class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <select
          value={currentSort()}
          onChange={handleSortChange}
          class="pl-8 pr-8 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors"
        >
          {sortOptions.map((opt) => (
            <option value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            class="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Filter Toggle */}
      <button
        onClick={() => props.onShowHiddenChange(!props.showHidden)}
        class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          props.showHidden
            ? "bg-blue-600 text-white"
            : "bg-slate-700/50 border border-slate-600 text-gray-300 hover:border-blue-500"
        }`}
      >
        <Filter class="w-4 h-4" />
        <span class="hidden sm:inline">Show Hidden</span>
      </button>
    </div>
  );
}
