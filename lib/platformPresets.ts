// Per-platform prompt presets for Stagehand. Each platform has known UX
// patterns (Swiggy "ADD" button vs Zomato "+" button, location modals, login
// nags). Specific prompts hit the model's pattern-matching way harder than
// generic ones.

export type PlatformPreset = {
  id: string;
  label: string;
  // Natural-language hints tuned to this platform's DOM/UX. The LLM uses these
  // verbatim as instructions, so they should be concrete + actionable.
  blockerDismiss: string;
  search: (dish: string) => string;
  addItem: (dish: string) => string;
  customization: string;
  verifyCart: (dish: string, restaurant: string) => string;
  // Optional first-touch nav hints — e.g. accept Swiggy's location prompt with
  // the detected GPS coords, or close the "open in app" banner.
  preflight?: string;
  // Called when the user's saved address is known — types it into address
  // search fields so the agent never blocks waiting for the user to enter it.
  addressAct?: (savedAddress: string) => string;
};

const SWIGGY: PlatformPreset = {
  id: "swiggy",
  label: "Swiggy",
  preflight:
    'on Swiggy, if there is an "Open in App" / "Continue to Web" banner, choose "Continue on Web". If a location selector asks for an address, accept the detected location or close the modal. If a "Sign In" or login prompt overlays the page, close it (do not log in — that\'s the user\'s job).',
  addressAct: (addr) =>
    `on Swiggy, look for any address / location input field on the page (a search box asking "Enter your delivery location" or similar). If you see one, click it, clear any existing text, type "${addr}", wait for autocomplete suggestions to appear, then click the first suggestion that matches. If no address field is visible, do nothing.`,
  blockerDismiss:
    'close any blocking modal on Swiggy: cookie consent, "Open in App" banner, location prompt, login nag, or first-time tutorial. Do NOT log in. Do NOT change the address. Just close/dismiss/skip whatever is in the way of the menu.',
  search: (dish) =>
    `on Swiggy's restaurant page, find the dish "${dish}" in the menu. Use the magnifying-glass search icon if the menu is long — Swiggy puts a search input near the top of the menu. Type "${dish}" into it. If there's no search icon visible, scroll down through the menu sections (Recommended, Bestsellers, Mains etc.) until you spot "${dish}".`,
  addItem: (dish) =>
    `on Swiggy, click the orange "ADD" button on the menu card for "${dish}". The ADD button is on the right side of each menu item card. If multiple dishes match, pick the closest one to "${dish}". If "${dish}" doesn't exist on this menu, do nothing.`,
  customization:
    'if Swiggy opened a customization sheet/modal (size variants, add-ons, choice of base) after clicking ADD, accept the cheapest defaults and click "Add Item" at the bottom. If no customization sheet appeared, do nothing.',
  verifyCart: (dish, restaurant) =>
    `look for Swiggy's cart strip — it appears as a floating bar at the bottom showing "View Cart" and item count, or as a panel on the right. Does it contain "${dish}" (or anything close from "${restaurant}")? Extract the cart total in ₹ if visible.`,
};

const ZOMATO: PlatformPreset = {
  id: "zomato",
  label: "Zomato",
  preflight:
    'on Zomato, if there is a "Login / Sign Up" overlay covering the page, close it. If a location modal asks "Where would you like to order?", accept the detected location.',
  addressAct: (addr) =>
    `on Zomato, look for any address / delivery location input field (a search box asking "Where would you like to order?" or similar). If visible, click it, type "${addr}", wait for suggestions, and select the best match. If no address field is visible, do nothing.`,
  blockerDismiss:
    "dismiss any blocking overlay on Zomato: login prompt, location confirm, cookie banner, app-download nag. Do NOT sign in. Do NOT change the delivery address.",
  search: (dish) =>
    `on Zomato's restaurant page, find "${dish}" in the menu. Zomato organizes the menu into sections (Recommended, Categories). There's typically a search bar at the top of the menu — if so, type "${dish}". Otherwise scroll through sections until you find it.`,
  addItem: (dish) =>
    `on Zomato, click the red "ADD" or green "+" button next to the "${dish}" menu item. The button sits to the right of each item's price. If "${dish}" doesn't exist here, do nothing.`,
  customization:
    'if Zomato opened a customization modal (preferences, choices, add-ons), pick the cheapest defaults and confirm with the "Add Item" or "Add to Cart" button at the bottom of the modal. If no modal, do nothing.',
  verifyCart: (dish, restaurant) =>
    `find Zomato's cart — usually a floating "View Cart" button at the bottom or a side panel. Does it list "${dish}" (or close match) from "${restaurant}"? Extract the total in ₹ if visible.`,
};

const SWISH: PlatformPreset = {
  id: "swish",
  label: "Swish",
  preflight:
    'on Swish (10-min delivery), if there\'s an "Open in App" banner, dismiss it. If a location modal appears, accept the detected location.',
  blockerDismiss:
    "dismiss any modal on Swish: location confirm, app banner, login nag. Do NOT sign in. Do NOT change address.",
  search: (dish) =>
    `on Swish, find "${dish}". Swish has a flat product grid — use the search bar at the top to type "${dish}", or scroll through the grid to spot it.`,
  addItem: (dish) =>
    `on Swish, click the green "+" / "Add" button on the product tile for "${dish}". If "${dish}" doesn't exist here, do nothing.`,
  customization:
    "if Swish opened a variant/size selector, pick the cheapest default and confirm. Otherwise do nothing.",
  verifyCart: (dish, restaurant) =>
    `find Swish's cart (floating bottom bar, usually green). Does it contain "${dish}" or close match? Extract the ₹ total.`,
};

const GENERIC: PlatformPreset = {
  id: "generic",
  label: "the platform",
  blockerDismiss:
    "if any popup, modal, cookie banner, location prompt, or login nag is blocking the menu, close or dismiss it. Do NOT log in. Do NOT change the delivery address. If nothing's in the way, do nothing.",
  search: (dish) =>
    `find the search/find input on this page and type "${dish}" into it. If there's no search input, scroll down through the menu looking for "${dish}".`,
  addItem: (dish) =>
    `click the "Add" / "ADD" / "+" button on the menu item titled "${dish}" (or the closest matching dish). If "${dish}" doesn't exist on this menu, do nothing.`,
  customization:
    'if a customization or "Add Item" popup appeared with options like size/spice/sides, accept the defaults and click the final "Add Item" or "Add to Cart" button. If no popup, do nothing.',
  verifyCart: (dish, restaurant) =>
    `does the cart, basket, or order summary on this page contain "${dish}" or anything matching it from "${restaurant}"? Extract the cart total in ₹ if visible.`,
};

const PRESETS: Record<string, PlatformPreset> = {
  swiggy: SWIGGY,
  zomato: ZOMATO,
  swish: SWISH,
};

export function presetFor(platform?: string): PlatformPreset {
  if (!platform) return GENERIC;
  return PRESETS[platform.toLowerCase()] || GENERIC;
}
