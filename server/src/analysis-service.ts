import { GoogleGenerativeAI } from "@google/generative-ai";

import type { City, Project } from "./types.js";

const SYSTEM_PROMPT = [
  "You are a flood infrastructure analyst for Metro Manila",
  "Analyze ONLY the data provided. Do not invent statistics.",
  "Explain what the Effective Coverage Score means for this city",
  "Identify key concerns or strengths",
  "Keep response under 200 words"
].join("\n");

const buildUserPrompt = (city: City, projects: Project[]): string => {
  return `City dataset:\n${JSON.stringify({ city, projects })}`;
};

export const generateCityAnalysis = async (
  city: City,
  projects: Project[],
  apiKey: string
): Promise<string | null> => {
  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT
    });

    const result = await model.generateContent(buildUserPrompt(city, projects));
    const text = result.response.text().trim();

    return text === "" ? null : text;
  } catch (error: unknown) {
    console.error("[Analysis] Gemini request failed:", error instanceof Error ? error.message : error);
    return null;
  }
};
