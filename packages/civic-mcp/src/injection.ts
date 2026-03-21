/**
 * Heuristic prompt-injection / unsafe-content detection for guardrail tools.
 * Not a full classifier - flags imperative overrides, URLs, code fences, and common jailbreak tokens.
 */
export function inspectPayloadForInjection(text: string): { blocked: boolean } {
  if (!text.trim()) {
    return { blocked: false };
  }

  if (text.includes("```")) {
    return { blocked: true };
  }

  if (/https?:\/\//i.test(text) || /\bwww\.\S+/i.test(text)) {
    return { blocked: true };
  }

  if (/<script/i.test(text) || /javascript:/i.test(text)) {
    return { blocked: true };
  }

  if (/\b(ignore|forget|disregard)\s+(previous|all|above|instructions|the)\b/i.test(text)) {
    return { blocked: true };
  }

  if (/\b(you must|must ignore|override|system prompt|developer message)\b/i.test(text)) {
    return { blocked: true };
  }

  if (/\b(eval|Function)\s*\(/i.test(text)) {
    return { blocked: true };
  }

  if (/\[INST\]|<\|im_start\|>|<\|im_end\|>|DAN mode|jailbreak/i.test(text)) {
    return { blocked: true };
  }

  return { blocked: false };
}
