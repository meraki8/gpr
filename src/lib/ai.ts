import "server-only";
import OpenAI from "openai";

export const ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const AI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
