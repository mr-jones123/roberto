import { GoogleGenerativeAI } from "@google/generative-ai";

import type { City, Project } from "./types.js";

const SYSTEM_PROMPT = [
  "You are a flood infrastructure analyst for Metro Manila.",
  "Analyze ONLY the data provided. Do not invent statistics.",
  "Explain what the Effective Coverage Score means for this city.",
  "Identify key concerns or strengths.",
  "Keep response under 200 words."
].join("\n");

const MAX_SAMPLE_PROJECTS = 20;

type ProjectSummary = {
  total: number;
  status_breakdown: Record<string, number>;
  avg_progress: number;
  budget_total_php: number;
  sample: Pick<Project, "name" | "status" | "progress" | "budget">[];
};

const buildCompactPrompt = (city: City, projects: Project[]): string => {
  const sample = projects
    .slice(0, MAX_SAMPLE_PROJECTS)
    .map((p) => ({ name: p.name, status: p.status, progress: p.progress, budget: p.budget }));

  const summary: ProjectSummary = {
    total: projects.length,
    status_breakdown: city.status_breakdown,
    avg_progress: city.avg_progress,
    budget_total_php: city.budget_total_php,
    sample,
  };

  const context = {
    city: {
      name: city.name,
      effective_coverage_score: city.effective_coverage_score,
      raw_coverage_ratio: city.raw_coverage_ratio,
      avg_progress: city.avg_progress,
      total_high_hazard_area_km2: city.total_high_hazard_area_km2,
      raw_covered_area_km2: city.raw_covered_area_km2,
      project_count: city.project_count,
      budget_total_php: city.budget_total_php,
    },
    projects: summary,
  };

  return `City dataset:\n${JSON.stringify(context)}`;
};

export const generateCityAnalysis = async (
  city: City,
  projects: Project[],
  apiKey: string
): Promise<{ text: string | null; error: string | null }> => {
  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT
    });

    const result = await model.generateContent(buildCompactPrompt(city, projects));
    const text = result.response.text().trim();

    return { text: text === "" ? null : text, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Analysis] Gemini request failed:", message);
    return { text: null, error: message };
  }
};
