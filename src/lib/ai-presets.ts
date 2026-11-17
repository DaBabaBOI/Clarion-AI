// The AI Helper's preset functions: one tap for flashcards, a quiz, a study
// plan and more. In live mode the presets come from the ai_presets table in
// Supabase, where they can be edited (wording, instructions, order, on/off)
// without changing code. These defaults seed that table and power the demo.

import type { AiPresetInfo } from "./types";

export interface AiPreset extends AiPresetInfo {
  /** What the model is asked to do (only the server reads it in live mode). */
  instruction: string;
}

export const DEFAULT_PRESETS: AiPreset[] = [
  {
    key: "flashcards",
    audience: "student",
    label: "Flashcards",
    description: "A deck of cards to revise from",
    output: "flashcards",
    topicHint: "Topic, e.g. cell structure",
    instruction:
      "Make a deck of 8 flashcards on the TOPIC. If there is no topic, use the student's next test or most urgent work in the CONTEXT. Fronts are short questions or prompts (under 15 words); backs are short, correct answers (under 25 words). Cover the key ideas, simplest first. Put a one sentence lead-in in answer.",
  },
  {
    key: "quiz",
    audience: "student",
    label: "Quiz",
    description: "5 multiple-choice questions, marked as you go",
    output: "quiz",
    topicHint: "Topic, e.g. quadratics",
    instruction:
      "Write a 5 question multiple-choice quiz on the TOPIC, or with no topic on what the student is studying now (from the CONTEXT). Each question has 4 options with exactly one correct answer, believable wrong options, and a one sentence explanation of the right answer. Mix easy and harder questions. Put a one sentence lead-in in answer.",
  },
  {
    key: "plan",
    audience: "student",
    label: "Study plan",
    description: "A plan for tonight from your open work",
    output: "plan",
    topicHint: "How long? e.g. 2 hours",
    instruction:
      "Build a study plan from the student's open tasks in the CONTEXT, most urgent first, that fits the time in the TOPIC (90 minutes if none is given). Fill plan with task ids and minutes, and summarise it in answer.",
  },
  {
    key: "explain",
    audience: "student",
    label: "Explain simply",
    description: "Any topic in plain words, with an example",
    output: "chat",
    topicHint: "Topic, e.g. photosynthesis",
    instruction:
      "Explain the TOPIC to a 13 year old in plain words: a short explanation, one everyday example, then one quick question to check understanding. With no topic, explain the hardest idea in the student's current work.",
  },
  {
    key: "summary",
    audience: "student",
    label: "Summarise",
    description: "The key points of a topic or class",
    output: "chat",
    topicHint: "Topic or class",
    instruction:
      'Summarise the key points of the TOPIC (or of the class in focus) as 4 to 6 short lines starting with "• ". Use the CONTEXT first: teacher notes, flashcards and class posts.',
  },
  {
    key: "test-prep",
    audience: "student",
    label: "Test prep",
    description: "What to revise for your next test",
    output: "chat",
    topicHint: "Which test? (optional)",
    instruction:
      "Tell the student what to revise for their next test: what it covers (from TEACHER NOTES and class posts), the 3 most important things to practise, and one tip. Keep it encouraging.",
  },
  {
    key: "class-quiz",
    audience: "staff",
    label: "Class quiz",
    description: "5 questions to use in a lesson",
    output: "quiz",
    topicHint: "Topic, e.g. enzymes",
    instruction:
      "Write a 5 question multiple-choice quiz on the TOPIC for the class in focus, at the right level for the year group. 4 options each, exactly one correct, with a one sentence explanation. With no topic, use the work the class is doing now.",
  },
  {
    key: "class-flashcards",
    audience: "staff",
    label: "Class flashcards",
    description: "A deck you can share with your class",
    output: "flashcards",
    topicHint: "Topic, e.g. Cold War key terms",
    instruction:
      "Make a deck of 10 flashcards on the TOPIC for the class in focus: short question fronts, short correct answers, at the right level for the year group. With no topic, use the class's current work.",
  },
  {
    key: "instructions",
    audience: "staff",
    label: "Draft instructions",
    description: "Clear instructions for a piece of work",
    output: "chat",
    topicHint: "Which task? (optional)",
    instruction:
      "Draft clear instructions for the TOPIC task, or the next piece of work in the CONTEXT: what to do in one sentence, numbered steps, what to hand in, and how it will be checked.",
  },
  {
    key: "behind",
    audience: "staff",
    label: "Who is behind?",
    description: "Students missing recent work",
    output: "chat",
    topicHint: "",
    instruction:
      'List the students who are behind on work due in the last two weeks, most missing first, as lines starting with "• ", and suggest one kind way to nudge them.',
  },
  {
    key: "check-first",
    audience: "staff",
    label: "What to check first",
    description: "The oldest work waiting for you",
    output: "chat",
    topicHint: "",
    instruction: 'Say which handed-in work to check first, oldest first, as lines starting with "• ", with how long each has waited.',
  },
  {
    key: "starter",
    audience: "staff",
    label: "Lesson starter",
    description: "A 5 minute activity to open a lesson",
    output: "chat",
    topicHint: "Topic",
    instruction:
      "Suggest a 5 minute lesson starter on the TOPIC (or the class's current work): what students do, what you need, and a question to finish with.",
  },
];

/** The presets shown to someone, students' or staff's, in order. */
export function presetsFor(presets: AiPresetInfo[], staff: boolean): AiPresetInfo[] {
  return presets.filter((p) => p.audience === (staff ? "staff" : "student"));
}

/** The labels the app needs, without the instructions. */
export const DEFAULT_PRESET_INFO: AiPresetInfo[] = DEFAULT_PRESETS.map((p) => ({
  key: p.key,
  audience: p.audience,
  label: p.label,
  description: p.description,
  output: p.output,
  topicHint: p.topicHint,
}));
