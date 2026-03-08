import { GoogleGenerativeAI } from "@google/generative-ai";

import type { City, Project } from "./types.js";

export const ANALYSIS_AUDIENCES = ["public", "coordinator", "responder"] as const;
export type AnalysisAudience = (typeof ANALYSIS_AUDIENCES)[number];

type ConfidenceLevel = "high" | "medium" | "low";

const SYSTEM_PROMPT = [
  "You are a flood infrastructure analyst for Metro Manila.",
  "Analyze ONLY the data provided. Do not invent statistics.",
  "Return ONLY a single JSON object without markdown code fences.",
  "Use plain, practical language and focus on immediate action.",
  "Include audience-specific guidance for the next 24 hours.",
  "If data is weak or uncertain, lower confidence accordingly."
].join("\n");

const NODE_GUIDANCE_SYSTEM_PROMPT = [
  "You are a flood risk explainer for Metro Manila incident map nodes.",
  "Use ONLY the provided context. Do not invent city names, hazard levels, or weather values.",
  "Return ONLY a single JSON object without markdown code fences.",
  "Write practical guidance for the next 24 hours.",
  "If uncertainty is high, lower confidence.",
].join("\n");

const MAX_SAMPLE_PROJECTS = 20;

type AnalysisModelPayload = {
  situation: string;
  why_now: string;
  recommended_actions: string[];
  confidence: number;
  confidence_reason: string;
};

type NodeGuidanceModelPayload = {
  what_this_means: string;
  what_you_can_do_now: string[];
  confidence: number;
  confidence_reason: string;
};

export type NodeHazardContext = {
  level: 0 | 1 | 2 | 3;
  label: string;
};

export type NodeWeatherContext = {
  observed_at: string;
  temperature_c: number;
  feels_like_c: number;
  precipitation_mm: number;
  rain_mm: number;
  wind_kph: number;
  weather_code: number;
  weather_label: string;
  is_day: boolean;
};

export type IncidentNodeContext = {
  latitude: number;
  longitude: number;
  city: string | null;
  hazard: NodeHazardContext;
  weather: NodeWeatherContext | null;
  incident: {
    title: string;
    status: string;
    priority: number | null;
    description: string | null;
  };
};

type ProjectSummary = {
  total: number;
  status_breakdown: Record<string, number>;
  avg_progress: number;
  budget_total_php: number;
  sample: Pick<Project, "name" | "status" | "progress" | "budget">[];
};

const AUDIENCE_BRIEF: Record<AnalysisAudience, string> = {
  public:
    "Public residents: prioritize clear safety actions, go-bag prep, route awareness, and trusted alert sources.",
  coordinator:
    "Coordinators: prioritize barangay readiness, prepositioning, communication cadence, and escalation triggers.",
  responder:
    "Responders: prioritize field safety, route viability checks, triage sequence, and handoff coordination.",
};

const clampConfidence = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const confidenceLevelFromScore = (score: number): ConfidenceLevel => {
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "medium";
  return "low";
};

const tryParseModelPayload = (rawText: string): AnalysisModelPayload | null => {
  const candidates: string[] = [];
  const trimmed = rawText.trim();
  if (trimmed !== "") {
    candidates.push(trimmed);
  }

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(rawText.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        continue;
      }

      const payload = parsed as Record<string, unknown>;
      const situation = typeof payload.situation === "string" ? payload.situation.trim() : "";
      const whyNow = typeof payload.why_now === "string" ? payload.why_now.trim() : "";
      const confidence = typeof payload.confidence === "number" ? payload.confidence : Number.NaN;
      const confidenceReason =
        typeof payload.confidence_reason === "string" ? payload.confidence_reason.trim() : "";

      const recommendedActions = Array.isArray(payload.recommended_actions)
        ? payload.recommended_actions
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value !== "")
            .slice(0, 5)
        : [];

      if (
        situation === ""
        || whyNow === ""
        || recommendedActions.length === 0
        || !Number.isFinite(confidence)
        || confidenceReason === ""
      ) {
        continue;
      }

      return {
        situation,
        why_now: whyNow,
        recommended_actions: recommendedActions,
        confidence: clampConfidence(confidence),
        confidence_reason: confidenceReason,
      };
    } catch {
      continue;
    }
  }

  return null;
};

const tryParseNodeGuidanceModelPayload = (rawText: string): NodeGuidanceModelPayload | null => {
  const candidates: string[] = [];
  const trimmed = rawText.trim();

  if (trimmed !== "") {
    candidates.push(trimmed);
  }

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(rawText.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        continue;
      }

      const payload = parsed as Record<string, unknown>;
      const whatThisMeans =
        typeof payload.what_this_means === "string" ? payload.what_this_means.trim() : "";
      const confidence = typeof payload.confidence === "number" ? payload.confidence : Number.NaN;
      const confidenceReason =
        typeof payload.confidence_reason === "string" ? payload.confidence_reason.trim() : "";

      const whatYouCanDoNow = Array.isArray(payload.what_you_can_do_now)
        ? payload.what_you_can_do_now
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value !== "")
            .slice(0, 6)
        : [];

      if (
        whatThisMeans === ""
        || whatYouCanDoNow.length === 0
        || !Number.isFinite(confidence)
        || confidenceReason === ""
      ) {
        continue;
      }

      return {
        what_this_means: whatThisMeans,
        what_you_can_do_now: whatYouCanDoNow,
        confidence: clampConfidence(confidence),
        confidence_reason: confidenceReason,
      };
    } catch {
      continue;
    }
  }

  return null;
};

const buildCompactPrompt = (city: City, projects: Project[], audience: AnalysisAudience): string => {
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
    audience,
  };

  return [
    `Audience briefing: ${AUDIENCE_BRIEF[audience]}`,
    "Output JSON schema:",
    '{"situation":"...","why_now":"...","recommended_actions":["..."],"confidence":0.0,"confidence_reason":"..."}',
    "Rules:",
    "- Keep situation to 2-3 short sentences.",
    "- recommended_actions: 3-5 concrete actions for the next 24 hours.",
    "- confidence is a decimal between 0 and 1 based on dataset sufficiency.",
    "- confidence_reason is a short phrase (max 18 words).",
    "- Do not mention unavailable sensors or imaginary forecasts.",
    `City dataset:\n${JSON.stringify(context)}`,
  ].join("\n");
};

export const generateCityAnalysis = async (
  city: City,
  projects: Project[],
  apiKey: string,
  audience: AnalysisAudience,
): Promise<{
  text: string | null;
  error: string | null;
  confidenceScore: number | null;
  confidenceLevel: ConfidenceLevel | null;
}> => {
  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT
    });

    const result = await model.generateContent(buildCompactPrompt(city, projects, audience));
    const rawText = result.response.text().trim();

    if (rawText === "") {
      return { text: null, error: null, confidenceScore: null, confidenceLevel: null };
    }

    const payload = tryParseModelPayload(rawText);
    if (!payload) {
      return { text: rawText, error: null, confidenceScore: null, confidenceLevel: null };
    }

    const analysis = [
      payload.situation,
      `Why now: ${payload.why_now}`,
      `Recommended actions for ${audience}:\n- ${payload.recommended_actions.join("\n- ")}`,
      `Confidence note: ${payload.confidence_reason}`,
    ].join("\n\n");

    const confidenceScore = clampConfidence(payload.confidence);

    return {
      text: analysis,
      error: null,
      confidenceScore,
      confidenceLevel: confidenceLevelFromScore(confidenceScore),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Analysis] Gemini request failed:", message);
    return { text: null, error: message, confidenceScore: null, confidenceLevel: null };
  }
};

const buildNodeGuidancePrompt = (context: IncidentNodeContext): string => {
  return [
    "Output JSON schema:",
    '{"what_this_means":"...","what_you_can_do_now":["..."],"confidence":0.0,"confidence_reason":"..."}',
    "Rules:",
    "- what_this_means: 2-3 short sentences grounded in flood risk, city context, and weather.",
    "- what_you_can_do_now: 3-5 concrete actions for the next 24 hours.",
    "- Keep language concise and practical.",
    "- confidence is a decimal between 0 and 1.",
    "- confidence_reason is max 18 words.",
    "- Do not add official advisories outside the provided context.",
    `Node context:\n${JSON.stringify(context)}`,
  ].join("\n");
};

export const generateIncidentNodeGuidance = async (
  context: IncidentNodeContext,
  apiKey: string,
): Promise<{
  whatThisMeans: string | null;
  whatYouCanDoNow: string[];
  error: string | null;
  confidenceScore: number | null;
  confidenceLevel: ConfidenceLevel | null;
}> => {
  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: NODE_GUIDANCE_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(buildNodeGuidancePrompt(context));
    const rawText = result.response.text().trim();

    if (rawText === "") {
      return {
        whatThisMeans: null,
        whatYouCanDoNow: [],
        error: null,
        confidenceScore: null,
        confidenceLevel: null,
      };
    }

    const payload = tryParseNodeGuidanceModelPayload(rawText);
    if (!payload) {
      return {
        whatThisMeans: null,
        whatYouCanDoNow: [],
        error: "Malformed model payload",
        confidenceScore: null,
        confidenceLevel: null,
      };
    }

    const confidenceScore = clampConfidence(payload.confidence);
    return {
      whatThisMeans: payload.what_this_means,
      whatYouCanDoNow: payload.what_you_can_do_now,
      error: null,
      confidenceScore,
      confidenceLevel: confidenceLevelFromScore(confidenceScore),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Analysis] Node guidance Gemini request failed:", message);
    return {
      whatThisMeans: null,
      whatYouCanDoNow: [],
      error: message,
      confidenceScore: null,
      confidenceLevel: null,
    };
  }
};
