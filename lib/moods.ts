// Quick mood picker — biases the recommendation without a full preferences flow.
// Tap one, the agent factors it in.

export type Mood = {
  id: string;
  label: string;
  jp: string;
  hint: string;
  bias: string;
};

export const MOODS: Mood[] = [
  {
    id: "cozy",
    label: "Cozy",
    jp: "暖",
    hint: "warm, comforting",
    bias: "warm comforting carb-heavy",
  },
  {
    id: "sharp",
    label: "Sharp",
    jp: "鋭",
    hint: "spicy, alive",
    bias: "bold spicy bright flavours",
  },
  {
    id: "light",
    label: "Light",
    jp: "軽",
    hint: "won't slow me down",
    bias: "light fresh under 500 cal",
  },
  {
    id: "hearty",
    label: "Hearty",
    jp: "重",
    hint: "feed me properly",
    bias: "rich substantial protein-heavy",
  },
  {
    id: "treat",
    label: "Treat",
    jp: "甘",
    hint: "I deserve it",
    bias: "indulgent rich worth-the-money",
  },
  {
    id: "adventure",
    label: "Adventure",
    jp: "新",
    hint: "surprise me",
    bias: "unusual cuisine I haven't tried",
  },
];
