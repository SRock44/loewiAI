import Groq from 'groq-sdk';
import { DocumentIntent, CitationStyle, IntentClassificationResult } from '../types/documentIntent';

// Keywords that signal the user might want a document generated
const DOCUMENT_GATE_KEYWORDS = [
  // academic-resource (study guides etc.)
  'study guide', 'formula sheet', 'cheat sheet', 'reference sheet', 'review sheet',
  'summary sheet', 'fact sheet', 'reference card', 'quick reference', 'study sheet',
  'notes sheet', 'pdf',
  // professional-document
  'essay', 'research paper', 'lab report', 'thesis', 'report', 'cover letter',
  'resume', 'mla', 'apa', 'chicago', 'term paper', 'argumentative', 'analytical paper',
  'position paper', 'write me', 'write a', 'draft a', 'draft an',
];

// Creation-intent verbs — required for the heuristic gate to fire
const CREATION_VERBS = /\b(?:create|make|generate|write|build|produce|give me|draft|compose)\b/i;

export class ClassifierAgent {
  private groqClient: Groq | null = null;

  constructor() {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (apiKey) {
      this.groqClient = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    }
  }

  /**
   * Fast sync heuristic — called before streaming starts.
   * Returns true if the message might be a document request.
   */
  mightBeDocument(message: string): boolean {
    const lower = message.toLowerCase();
    if (!CREATION_VERBS.test(lower)) return false;
    return DOCUMENT_GATE_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * AI-powered classifier — called only when mightBeDocument() returns true.
   * Uses a fast, cheap model to produce a structured JSON classification.
   */
  async classify(message: string): Promise<IntentClassificationResult> {
    const fallback: IntentClassificationResult = {
      intent: 'academic-resource',
      documentType: null,
      citationStyle: null,
      confidence: 0.5,
    };

    if (!this.groqClient) return fallback;

    try {
      const completion = await this.groqClient.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        max_tokens: 150,
        messages: [
          {
            role: 'system',
            content: `You are a document-intent classifier. Respond ONLY with valid JSON, no other text.
Classify the user message as exactly one of:
  "none" - regular question or conversation
  "academic-resource" - study guide, formula sheet, cheat sheet, notes, reference sheet
  "professional-document" - essay, research paper, lab report, thesis, term paper, MLA/APA/Chicago formatted doc, cover letter, resume
Return: { "intent": "...", "documentType": "string|null", "citationStyle": "MLA|APA|Chicago|null", "confidence": 0.0-1.0 }`,
          },
          { role: 'user', content: message },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '';
      // Strip any markdown code fences the model might add
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonStr);

      return {
        intent: (['none', 'academic-resource', 'professional-document'].includes(parsed.intent)
          ? parsed.intent
          : 'academic-resource') as DocumentIntent,
        documentType: typeof parsed.documentType === 'string' ? parsed.documentType : null,
        citationStyle: (['MLA', 'APA', 'Chicago'].includes(parsed.citationStyle)
          ? parsed.citationStyle
          : null) as CitationStyle,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch {
      return fallback;
    }
  }
}

export const classifierAgent = new ClassifierAgent();
