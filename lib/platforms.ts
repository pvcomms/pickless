export type Platform = {
  id: string;
  name: string;
  tagline: string;
  color: string;
  regions: string[];
  // mobile deep link (custom URL scheme) — opens the installed app
  appScheme: string;
  // iOS App Store / Play Store fallback
  iosUrl: string;
  androidUrl: string;
  // desktop fallback URL
  webUrl: string;
  searchUrl: (query: string) => string;
};

export const PLATFORMS: Platform[] = [
  {
    id: "swiggy",
    name: "Swiggy",
    tagline: "India · food + groceries",
    color: "#FC8019",
    regions: ["IN"],
    appScheme: "swiggy://",
    iosUrl:
      "https://apps.apple.com/in/app/swiggy-food-grocery-delivery/id989540920",
    androidUrl:
      "https://play.google.com/store/apps/details?id=in.swiggy.android",
    webUrl: "https://www.swiggy.com",
    searchUrl: (q) =>
      `https://www.swiggy.com/search?query=${encodeURIComponent(q)}`,
  },
  {
    id: "zomato",
    name: "Zomato",
    tagline: "India · restaurant ordering",
    color: "#E23744",
    regions: ["IN"],
    appScheme: "zomato://",
    iosUrl:
      "https://apps.apple.com/in/app/zomato-food-delivery-dining/id434613896",
    androidUrl:
      "https://play.google.com/store/apps/details?id=com.application.zomato",
    webUrl: "https://www.zomato.com",
    searchUrl: (q) =>
      `https://www.zomato.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "swish",
    name: "Swish",
    tagline: "Bangalore · 10-min food delivery",
    color: "#0FA968",
    regions: ["IN"],
    appScheme: "swish://",
    iosUrl: "https://apps.apple.com/in/app/swish-by-swiggy/id6477489665",
    androidUrl: "https://play.google.com/store/apps/details?id=in.swiggy.swish",
    webUrl: "https://swish.swiggy.com",
    searchUrl: (q) =>
      `https://swish.swiggy.com/search?q=${encodeURIComponent(q)}`,
  },
];

export type Recommendation = {
  dish: string;
  restaurant: string;
  platform: string;
  price: string;
  reason: string;
  tags: string[];
  sponsored: boolean;
  orderUrl: string;
  orderQuery?: string;
};

export type Preferences = {
  diet: "any" | "veg" | "vegan" | "halal";
  cuisines: string[];
  vibe: "cheap" | "healthy" | "treat" | "adventure";
  spice: "mild" | "medium" | "hot";
  budgetMax: number; // hard cap in INR
  dontEat: string[]; // hard exclusions
};
export const DEFAULT_PREFS: Preferences = {
  diet: "any",
  cuisines: [],
  vibe: "treat",
  spice: "medium",
  budgetMax: 500,
  dontEat: [],
};

export const QUIZ_CUISINES = [
  "Indian",
  "South Indian",
  "Asian",
  "Italian",
  "Mexican",
  "Healthy bowls",
  "Burgers",
  "Cafe",
  "Street food",
];

export const DONT_EAT_OPTIONS = [
  "beef",
  "pork",
  "lamb",
  "chicken",
  "fish",
  "shellfish",
  "eggs",
  "dairy",
  "nuts",
  "peanuts",
  "gluten",
  "mushroom",
  "onion",
  "garlic",
  "spicy",
];

export const BUDGET_PRESETS = [200, 350, 500, 800, 1500];
