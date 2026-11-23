import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { RecipeSchema, type Recipe, type VideoSource } from "./recipe";

export const MODEL = "claude-opus-5-5";

const SYSTEM = `You turn cooking videos into clean, structured recipes for Thea, a personal meal-planning app.

You get the video's caption (written by the creator) and, when available, its spoken transcript. Combine both:
- The caption often has the exact ingredient list and amounts; prefer it for quantities.
- The transcript often has the method, extra ingredients mentioned in passing, temperatures and times.
- If they disagree, prefer the more specific source and note the conflict in uncertainties.

Rules:
- Only include ingredients the recipe actually uses. Ignore hashtags, brand plugs, and "link in bio" text.
- Normalize ingredient names to what you'd search for at a grocery store ("scallions" -> "green onion", "EVOO" -> "olive oil").
- Convert fractions to decimals. Use US units as given; don't convert between metric and imperial.
- When an amount isn't stated, estimate a sensible one if you reasonably can and mark the ingredient uncertain; otherwise leave quantity null.
- Steps should be short, imperative, and in order. Fill gaps a home cook would need (e.g. "Salt the pasta water") only when clearly implied.
- List anything that needs a human check in uncertainties, in plain language.
- If the content isn't a recipe, set is_recipe to false and leave lists empty.`;

function buildPrompt(src: VideoSource): string {
  const parts = [
    `Platform: ${src.platform}`,
    src.author ? `Creator: @${src.author}` : null,
    src.durationSeconds ? `Video length: ${src.durationSeconds}s` : null,
    `<caption>\n${src.caption || "(none)"}\n</caption>`,
    `<transcript>\n${src.transcript || "(none available)"}\n</transcript>`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

export async function extractRecipe(src: VideoSource): Promise<{ recipe: Recipe; model: string }> {
  if (!src.caption.trim() && !src.transcript?.trim()) {
    throw new Error("This video has no caption or transcript to read a recipe from.");
  }
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(RecipeSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: buildPrompt(src) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to process this video.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Claude's answer was incomplete. Try again.");
  }
  return { recipe: response.parsed_output, model: response.model };
}
