export const STATUS_LABELS = [
    { id: 1, name: "Playing" },
    { id: 2, name: "Finished" },
    { id: 3, name: "Stalled" },
    { id: 4, name: "Dropped" },
    { id: 5, name: "Wishlist" },
    { id: 6, name: "Blacklist" },
];

export const ROLE_NAMES: Record<string, string> = {
    main: "Protagonist",
    primary: "Main Characters",
    side: "Side Characters",
    appears: "Makes an Appearance",
};

export const LENGTH_NAMES: Record<number, string> = {
    1: "Very Short (<2h)",
    2: "Short (2-10h)",
    3: "Medium (10-30h)",
    4: "Long (30-50h)",
    5: "Very Long (>50h)",
};

export const TRAIT_ORDER = [
    "Hair",
    "Eyes",
    "Body",
    "Clothes",
    "Items",
    "Personality",
    "Role",
    "Engages in",
    "Subject of",
    "Engages in (Sexual)",
    "Subject of (Sexual)",
];
