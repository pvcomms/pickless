// Mock order history generator — used at "connect" time so the trends/Gemini
// engine has signal to work with until the real Browserbase/email-parsing
// integration ships. Each platform produces orders in its own currency + style.

export type Order = {
  id: string;
  platform: string;
  dish: string;
  restaurant: string;
  cuisine: string;
  price: number;
  currency: string;
  orderedAt: string; // ISO
  deliveryAddress: string;
};

const SEEDS: Record<string, Omit<Order, "id" | "orderedAt">[]> = {
  swiggy: [
    {
      platform: "swiggy",
      dish: "Paneer Butter Masala + 2 Butter Naan",
      restaurant: "Punjabi Rasoi, Indiranagar",
      cuisine: "North Indian",
      price: 340,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swiggy",
      dish: "Chicken Biryani (Special)",
      restaurant: "Meghana Foods, Indiranagar",
      cuisine: "Hyderabadi",
      price: 380,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swiggy",
      dish: "Veg Thali",
      restaurant: "Mahesh Lunch Home",
      cuisine: "South Indian",
      price: 220,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swiggy",
      dish: "Margherita Pizza",
      restaurant: "1441 Pizzeria",
      cuisine: "Italian",
      price: 410,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swiggy",
      dish: "Schezwan Noodles + Manchurian",
      restaurant: "Mainland China Express",
      cuisine: "Indo-Chinese",
      price: 295,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swiggy",
      dish: "Masala Dosa + Filter Coffee",
      restaurant: "CTR Brahmins",
      cuisine: "South Indian",
      price: 175,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
  ],
  zomato: [
    {
      platform: "zomato",
      dish: "Chicken Tikka + Roomali Roti (4)",
      restaurant: "Karim's, Indiranagar",
      cuisine: "Mughlai",
      price: 425,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "zomato",
      dish: "Truffle Mac Burger + Fries",
      restaurant: "Truffles, 100ft Road",
      cuisine: "American",
      price: 320,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "zomato",
      dish: "Mutton Rogan Josh + Saffron Rice",
      restaurant: "Awadh, Koramangala",
      cuisine: "Awadhi",
      price: 510,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "zomato",
      dish: "Pad Thai + Tom Kha",
      restaurant: "Sticky Fingers",
      cuisine: "Thai",
      price: 380,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "zomato",
      dish: "Sushi Platter (12pc)",
      restaurant: "Edo, ITC Gardenia",
      cuisine: "Japanese",
      price: 890,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
  ],
  swish: [
    {
      platform: "swish",
      dish: "Filter Coffee + Buttered Bun",
      restaurant: "Swish Cafe, Indiranagar",
      cuisine: "South Indian",
      price: 95,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swish",
      dish: "Veg Maggi (extra masala)",
      restaurant: "Swish Hot Bites",
      cuisine: "Indian Snack",
      price: 75,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swish",
      dish: "Vada Pav + Cutting Chai",
      restaurant: "Swish Mumbai Express",
      cuisine: "Mumbai Street",
      price: 60,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swish",
      dish: "Chicken Roll + Cold Coffee",
      restaurant: "Swish Quick Eats",
      cuisine: "Indo-Chinese",
      price: 145,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swish",
      dish: "Idli (3) + Sambar + Chutney",
      restaurant: "Swish Tiffin",
      cuisine: "South Indian",
      price: 80,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
    {
      platform: "swish",
      dish: "Banana Chips + Lassi",
      restaurant: "Swish Pantry",
      cuisine: "Snacks",
      price: 55,
      currency: "INR",
      deliveryAddress: "Diamond District, Indiranagar",
    },
  ],
};

function randomDateWithin(daysAgo: number) {
  const ms = Date.now() - Math.random() * daysAgo * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export function generateMockOrders(platformId: string, count = 8): Order[] {
  const seeds = SEEDS[platformId];
  if (!seeds) return [];
  const orders: Order[] = [];
  for (let i = 0; i < count; i++) {
    const seed = seeds[i % seeds.length];
    orders.push({
      ...seed,
      id: `${platformId}-${Date.now()}-${i}`,
      orderedAt: randomDateWithin(90),
    });
  }
  return orders.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
}

export type Trends = {
  totalOrders: number;
  totalSpend: { currency: string; amount: number }[];
  topCuisine: string;
  topRestaurant: string;
  avgPrice: number;
  primaryCurrency: string;
  weekdayPattern: string;
  lastOrder: Order | null;
};

export function analyseTrends(orders: Order[]): Trends | null {
  if (orders.length === 0) return null;
  const cuisineCounts: Record<string, number> = {};
  const restaurantCounts: Record<string, number> = {};
  const currencyTotals: Record<string, number> = {};
  const weekdayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];

  for (const o of orders) {
    cuisineCounts[o.cuisine] = (cuisineCounts[o.cuisine] || 0) + 1;
    restaurantCounts[o.restaurant] = (restaurantCounts[o.restaurant] || 0) + 1;
    currencyTotals[o.currency] = (currencyTotals[o.currency] || 0) + o.price;
    weekdayCounts[new Date(o.orderedAt).getDay()]++;
  }

  const topCuisine =
    Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const topRestaurant =
    Object.entries(restaurantCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const peakDay = weekdayCounts.indexOf(Math.max(...weekdayCounts));
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const primaryCurrency =
    Object.entries(currencyTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "INR";
  const avgPrice = orders.reduce((s, o) => s + o.price, 0) / orders.length;

  return {
    totalOrders: orders.length,
    totalSpend: Object.entries(currencyTotals).map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount),
    })),
    topCuisine,
    topRestaurant,
    avgPrice: Math.round(avgPrice),
    primaryCurrency,
    weekdayPattern: days[peakDay],
    lastOrder: orders[0],
  };
}

export function currencySymbol(c: string) {
  return (
    (
      { INR: "₹", SEK: "kr ", USD: "$", GBP: "£", EUR: "€" } as Record<
        string,
        string
      >
    )[c] || c + " "
  );
}
