import { z } from "zod";
import type { Tier } from "./ingredients/tiers";

export const IngredientSchema = z.object({
  name: z
    .string()
    .describe(
      "Canonical grocery item name, lowercase, singular, no prep words (e.g. 'green onion', 'cherry tomato', 'parmesan').",
    ),
  quantity: z
    .number()
    .nullable()
    .describe("Numeric amount as a decimal (1/2 -> 0.5). Null if not stated or not inferable."),
  unit: z
    .string()
    .nullable()
    .describe(
      "Standard unit: g, kg, ml, l, tsp, tbsp, cup, oz, lb, clove, can, bunch, pinch, piece, or null for countable items.",
    ),
  preparation: z.string().nullable().describe("e.g. 'minced', 'halved', 'room temperature'."),
  original_text: z.string().describe("The ingredient as the creator said or wrote it."),
  category: z
    .enum([
      "produce",
      "herbs",
      "meat_seafood",
      "dairy_eggs",
      "bakery",
      "pantry",
      "spices",
      "frozen",
      "other",
    ])
    .describe("Store section."),
  is_staple: z
    .boolean()
    .describe("True for things most kitchens already have: salt, pepper, oil, water, basic spices."),
  uncertain: z
    .boolean()
    .describe("True if the quantity or the item itself was guessed rather than stated."),
});

export const RecipeSchema = z.object({
  is_recipe: z
    .boolean()
    .describe("False if the video is not actually a recipe (e.g. a restaurant review)."),
  title: z.string().describe("Short, plain recipe name, e.g. 'Roasted Tomato Feta Pasta'."),
  servings: z.number().nullable().describe("Servings the recipe as given makes. Null if unknown."),
  servings_estimated: z.boolean().describe("True if servings was estimated rather than stated."),
  prep_minutes: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()).describe("Clear, numbered-order cooking steps, one action each."),
  equipment: z.array(z.string()).describe("Notable equipment, e.g. 'blender', 'rice cooker'."),
  tags: z.array(z.string()).describe("A few tags: cuisine, main protein, meal type, 'vegetarian' etc."),
  uncertainties: z
    .array(z.string())
    .describe("Things Wes should double-check, written as short plain sentences."),
});

export type Recipe = z.infer<typeof RecipeSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;

export type VideoSource = {
  platform: "tiktok" | "instagram" | "manual";
  url: string | null;
  videoId: string | null;
  author: string | null;
  caption: string;
  transcript: string | null;
  transcriptSource: "tiktok" | "supadata" | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
};

export type ImportResult = {
  source: VideoSource;
  recipe: Recipe;
  model: string;
  warnings: string[];
  /** Set when the import was saved to the recipe library. */
  recipeId?: string;
  /** Per ingredient line (by position): the grocery item it maps to, standard amount and freshness. */
  normalized?: NormalizedLine[];
};

export type NormalizedLine = {
  position: number;
  item: string;
  amount: number | null;
  std_unit: string | null;
  tier: Tier | null;
  shelf_days: number | null;
};
