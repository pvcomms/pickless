import Browserbase from "@browserbasehq/sdk";

let _bb: Browserbase | null = null;
export function bb(): Browserbase | null {
  if (_bb) return _bb;
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) return null;
  _bb = new Browserbase({ apiKey });
  return _bb;
}

export function projectId(): string | null {
  return process.env.BROWSERBASE_PROJECT_ID || null;
}
