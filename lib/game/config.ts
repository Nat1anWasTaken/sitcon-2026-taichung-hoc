export type LevelConfig = {
  id: string;
  target: string;
  blocks?: string[];
  hint?: string;
};

export type PhaseConfig = {
  id: string;
  title: string;
  mode: "blocks" | "text";
  levels: LevelConfig[];
  lockedByCue?: string;
  description?: string;
};

export type SectionConfig = {
  id: string;
  title: string;
  phases: PhaseConfig[];
};

export const sectionOne: SectionConfig = {
  id: "section-1",
  title: "Garden Builders",
  phases: [
    {
      id: "phase-1",
      title: "Prompt Blocks",
      mode: "blocks",
      description: "Drag the colorful blocks to build a sentence, then generate the picture.",
      levels: [
        {
          id: "p1-level-1",
          target: "a pile of bright orange carrots on a plate",
          blocks: [
            "Generate",
            "a",
            "pile of",
            "bright",
            "orange",
            "carrots",
            "on",
            "a",
            "plate",
            "cartoon",
            "style",
          ],
        },
        {
          id: "p1-level-2",
          target: "a cute rabbit holding carrots",
          blocks: [
            "Generate",
            "a",
            "cute",
            "rabbit",
            "holding",
            "carrots",
            "smiling",
            "cartoon",
            "style",
          ],
        },
        {
          id: "p1-level-3",
          target: "two rabbits sharing carrots in a garden",
          blocks: [
            "Generate",
            "two",
            "rabbits",
            "sharing",
            "carrots",
            "in",
            "a",
            "garden",
            "sunny",
            "day",
          ],
        },
      ],
    },
    {
      id: "phase-2",
      title: "Type Your Prompt",
      mode: "text",
      description: "No blocks now! Type a clear prompt to match the target image.",
      levels: [
        {
          id: "p2-level-1",
          target: "a rabbit chef cooking carrot soup in a pot",
        },
        {
          id: "p2-level-2",
          target: "a carrot-shaped rocket ship flying in the night sky",
        },
      ],
    },
    {
      id: "phase-3",
      title: "Final Quest",
      mode: "text",
      lockedByCue: "start-phase-3",
      description:
        "Unlocked by the admin when everyone finishes phases 1 and 2. Create the grand finale image!",
      levels: [
        {
          id: "p3-level-1",
          target: "a big carrot festival with kids and rabbits celebrating",
        },
      ],
    },
  ],
};

export function getSectionConfig(sectionId: string): SectionConfig {
  if (sectionId === sectionOne.id) return sectionOne;
  throw new Error(`Unknown section ${sectionId}`);
}
