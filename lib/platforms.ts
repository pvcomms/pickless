export type Platform = {
  id: string;
  name: string;
  color: string;
  regions: string[];
  searchUrl: (query: string) => string;
};

export const PLATFORMS: Platform[] = [
  {
    id: "swiggy",
    name: "Swiggy",
    color: "#FC8019",
    regions: ["IN"],
    searchUrl: (q) =>
      `https://www.swiggy.com/search?query=${encodeURIComponent(q)}`,
  },
  {
    id: "zomato",
    name: "Zomato",
    color: "#E23744",
    regions: ["IN"],
    searchUrl: (q) =>
      `https://www.zomato.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "blinkit",
    name: "Blinkit",
    color: "#F8CF00",
    regions: ["IN"],
    searchUrl: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
  },
  {
    id: "ubereats",
    name: "Uber Eats",
    color: "#06C167",
    regions: ["UK", "US", "AU", "EU"],
    searchUrl: (q) =>
      `https://www.ubereats.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "deliveroo",
    name: "Deliveroo",
    color: "#00CCBC",
    regions: ["UK", "EU", "AU"],
    searchUrl: (q) =>
      `https://deliveroo.co.uk/restaurants?q=${encodeURIComponent(q)}`,
  },
  {
    id: "justeat",
    name: "Just Eat",
    color: "#FF6900",
    regions: ["UK", "EU"],
    searchUrl: (q) =>
      `https://www.just-eat.co.uk/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "wolt",
    name: "Wolt",
    color: "#00C2E8",
    regions: ["EU"],
    searchUrl: (q) => `https://wolt.com/en/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "doordash",
    name: "DoorDash",
    color: "#EB1700",
    regions: ["US", "AU"],
    searchUrl: (q) =>
      `https://www.doordash.com/search/store/${encodeURIComponent(q)}/`,
  },
  {
    id: "grubhub",
    name: "Grubhub",
    color: "#F63440",
    regions: ["US"],
    searchUrl: (q) =>
      `https://www.grubhub.com/search?queryText=${encodeURIComponent(q)}`,
  },
  {
    id: "menulog",
    name: "Menulog",
    color: "#FF8000",
    regions: ["AU"],
    searchUrl: (q) =>
      `https://www.menulog.com.au/search?q=${encodeURIComponent(q)}`,
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
  budget: "low" | "mid" | "high";
  spice: "mild" | "medium" | "hot";
};
export const DEFAULT_PREFS: Preferences = {
  diet: "any",
  budget: "mid",
  spice: "medium",
};
