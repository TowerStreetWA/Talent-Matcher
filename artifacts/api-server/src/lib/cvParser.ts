import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod/v4";

const ParsedCvSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  currentTitle: z.string().nullish(),
  currentCompany: z.string().nullish(),
  locationText: z.string().nullish(),
  summary: z.string().nullish(),
  seniority: z.string().nullish(),
  skills: z.array(z.string()).default([]),
  titles: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  remotePreference: z.string().nullish(),
  desiredSalaryMin: z.number().nullish(),
  desiredSalaryMax: z.number().nullish(),
  salaryCurrency: z.string().nullish(),
});

export type ParsedCv = z.infer<typeof ParsedCvSchema>;

const SYSTEM_PROMPT = `You are a CV/resume parser for a recruitment platform. Extract a structured candidate profile from raw CV text. Respond ONLY with a JSON object with these keys:
firstName (string, required), lastName (string, required), email (string|null), phone (string|null), currentTitle (string|null, most recent job title), currentCompany (string|null), locationText (string|null, e.g. "London, UK"), summary (string|null, 2-3 sentence professional summary you write based on the CV), seniority (one of: junior|mid|senior|lead|principal|executive, or null), skills (array of concise skill names, deduplicated, max 25, e.g. "React", "Stakeholder Management"), titles (array of distinct job titles held, most recent first, max 6), industries (array of industries the candidate has worked in, max 5, e.g. "Fintech", "Healthcare"), remotePreference (one of: remote|hybrid|onsite, or null if not stated), desiredSalaryMin (number|null, annual), desiredSalaryMax (number|null, annual), salaryCurrency (3-letter code like GBP/USD/EUR, or null).
If the CV states salary expectations use them; otherwise leave salary fields null. Do not invent contact details.`;

export async function parseCvText(cvText: string): Promise<ParsedCv> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: cvText.slice(0, 40_000) },
    ],
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("CV parser returned an empty response");
  }
  const parsed = ParsedCvSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`CV parser returned an invalid profile: ${parsed.error.message}`);
  }
  return parsed.data;
}
