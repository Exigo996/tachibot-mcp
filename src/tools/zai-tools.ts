/**
 * z.ai Tools Implementation
 * Direct API access to ZhipuAI GLM models (GLM-5V-Turbo, GLM-5, etc.)
 * Uses OpenAI-compatible chat completions endpoint at api.z.ai
 * Falls back to OpenRouter gateway when enabled
 */

import { z } from "zod";
import { validateToolInput, ValidationContext } from "../utils/input-validator.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { withHeartbeat } from "../utils/streaming-helper.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
import { tryOpenRouterGateway, isGatewayEnabled } from "../utils/openrouter-gateway.js";
import { GLM_MODELS, TOOL_DEFAULTS } from "../config/model-constants.js";

const ZAI_API_KEY = process.env.ZAI_API_KEY;
const ZAI_API_URL = "https://api.z.ai/api/paas/v4/chat/completions";

const ZAI_TIMEOUT = parseInt(process.env.TACHI_ZAI_TIMEOUT || '90000') || 90000;

const MODEL_FALLBACKS: Record<string, string> = {
  [GLM_MODELS.GLM_5V_TURBO]: GLM_MODELS.GLM_5_TURBO,
};

interface ZaiResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export function isZaiAvailable(): boolean {
  return !!ZAI_API_KEY;
}

export function getAllZaiTools() {
  if (!isZaiAvailable()) return [];
  return [glmDesignTool];
}

const DESIGN_SYSTEM_PROMPT = `You are a senior UI/UX design consultant and frontend styling expert powered by GLM-5V-Turbo's multimodal vision capabilities.

Your expertise:
- Visual design analysis: color theory, typography, spacing, layout, visual hierarchy
- CSS/Styling: Tailwind CSS, CSS-in-JS, Sass, responsive design, animations
- UI patterns: component design, design systems, accessibility (WCAG)
- Frameworks: Vue, React, Nuxt, Next.js component styling
- Design-to-code: converting mockups/screenshots to styled components
- Cross-device: mobile-first, responsive breakpoints, touch targets

When analyzing screenshots or mockups:
1. Identify visual issues (contrast, alignment, spacing, typography)
2. Suggest specific CSS/style improvements with code examples
3. Consider accessibility (contrast ratios, focus states, ARIA)
4. Recommend responsive approaches
5. Provide concrete, copy-paste-ready code

When suggesting styles:
- Provide complete, working code snippets
- Use modern CSS features and best practices
- Consider the framework being used (Tailwind, Vue, React, etc.)
- Include responsive breakpoints when relevant
- Mention accessibility considerations

${FORMAT_INSTRUCTION}`;

async function callZai(
  messages: Array<{ role: string; content: string | any[] }>,
  model: string = GLM_MODELS.GLM_5V_TURBO,
  temperature: number = 0.7,
  maxTokens: number = 6000,
  validationContext: ValidationContext = 'llm-orchestration',
  _isRetry: boolean = false,
): Promise<string> {
  const validatedMessages = messages.map((msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const validation = validateToolInput(content, validationContext);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid message content");
    }
    return { ...msg, content: validation.sanitized };
  });

  if (isGatewayEnabled()) {
    try {
      const textMessages = validatedMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : String(m.content)
      }));
      const gatewayResult = await tryOpenRouterGateway(
        `z-ai/${model}`,
        textMessages,
        { temperature, max_tokens: maxTokens }
      );
      if (gatewayResult) return gatewayResult;
      console.error(`🔀 [z.ai] Gateway returned null, falling back to direct API`);
    } catch (gatewayError) {
      console.error(`🔀 [z.ai] Gateway error: ${gatewayError instanceof Error ? gatewayError.message : String(gatewayError)}`);
    }
  }

  if (!ZAI_API_KEY) {
    return `[z.ai API key not configured. Add ZAI_API_KEY to .env file]`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ZAI_TIMEOUT);

  try {
    const response = await fetch(ZAI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: validatedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (!_isRetry && response.status >= 500 && MODEL_FALLBACKS[model]) {
        const fallback = MODEL_FALLBACKS[model];
        console.error(`[z.ai] ${model} failed (${response.status}), falling back to ${fallback}`);
        return callZai(messages, fallback, temperature, maxTokens, validationContext, true);
      }

      throw new Error(`z.ai API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as ZaiResponse;
    const content = data.choices?.[0]?.message?.content || "No response from z.ai";
    return stripFormatting(content);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return `[z.ai timeout: Request exceeded ${ZAI_TIMEOUT / 1000}s limit]`;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    return `[z.ai error: ${errorMsg}]`;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const glmDesignTool = {
  name: "glm_design",
  description:
    "Design and styling analysis with GLM-5.1 (agentic/coding model). " +
    "Specializes in UI/UX feedback, CSS styling, color theory, responsive design, accessibility, and design-to-code conversion. " +
    "Put your REQUEST in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe(
      "Your design/styling request (REQUIRED). E.g. 'Review the color contrast', 'Suggest Tailwind styles for a hero section', 'Convert this mockup to Vue component'"
    ),
    task: z
      .enum(["design-review", "styling", "design-to-code", "accessibility", "responsive", "color-scheme", "layout", "general"])
      .optional()
      .default("general")
      .describe("Type of design task"),
    code: z.string().optional().describe("Current HTML/CSS/Vue/React code to analyze or improve"),
    files: z.array(z.string()).optional().describe(
      "File paths to read as context. Supports line ranges: 'src/components/Header.vue:10-50'. Model sees ACTUAL CODE."
    ),
    framework: z
      .enum(["tailwind", "css", "vue", "react", "nuxt", "next", "svelte", "html", "other"])
      .optional()
      .describe("Frontend framework in use (affects code suggestions)"),
    language: z.string().optional().describe("Programming/styling language context"),
  }),
  execute: async (args: {
    query: string;
    task?: string;
    code?: string;
    files?: string[];
    framework?: string;
    language?: string;
  }, context?: any) => {
    const defaults = TOOL_DEFAULTS.glm_design;

    let fileContext = "";
    if (args.files?.length) {
      try {
        fileContext = await readFilesIntoContext(args.files);
      } catch (fileError) {
        console.error(`[z.ai] File read error: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        fileContext = `[Warning: Could not read some files: ${fileError instanceof Error ? fileError.message : String(fileError)}]`;
      }
    }

    const contextParts: string[] = [];
    if (args.framework) contextParts.push(`Framework: ${args.framework}`);
    if (args.language) contextParts.push(`Language: ${args.language}`);
    if (args.task) contextParts.push(`Task type: ${args.task}`);
    if (fileContext) contextParts.push(`\n--- Code files ---\n${fileContext}`);
    if (args.code) contextParts.push(`\n--- Current code ---\n${args.code}`);

    const enrichedQuery = contextParts.length > 0
      ? `${args.query}\n\n${contextParts.join("\n")}`
      : args.query;

    const messages = [
      { role: "system", content: DESIGN_SYSTEM_PROMPT },
      { role: "user", content: enrichedQuery },
    ];

    const reportProgress = context?.reportProgress;
    if (reportProgress) {
      return withHeartbeat(
        () => callZai(messages, defaults.model, defaults.temperature, defaults.maxTokens),
        reportProgress
      );
    }

    return callZai(messages, defaults.model, defaults.temperature, defaults.maxTokens);
  },
};
