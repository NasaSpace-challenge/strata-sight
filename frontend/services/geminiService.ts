import { EarthVariable, RegionHotspot, StatisticalAnalysisResult } from '../types';

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AiInvestigationResponse {
  executiveSummary: string;
  physicalMechanisms: string[];
  climateParadoxInsight: string;
  significanceInterpretation: string;
  recommendedNextSteps: string[];
  groundingSources?: GroundingSource[];
}

/**
 * Invokes Gemini 2.5 Flash as an interactive NASA Senior Earth Scientist
 * Utilizing runtimeConfig from the NASA Earth Science Data Analysis Challenge
 */
export async function analyzeTrendWithGemini(
  variable: EarthVariable,
  region: RegionHotspot,
  stats: StatisticalAnalysisResult,
  comparisonRegion?: RegionHotspot,
  comparisonStats?: StatisticalAnalysisResult,
  userQuestion?: string
): Promise<AiInvestigationResponse> {
  // Loaded on demand: the SDK is large and only needed when the user asks the AI assistant.
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });

  const prompt = `
You are a Principal NASA Earth Systems Scientist analyzing multi-decadal observations for the 2026 NASA Space Apps Challenge (Earth Science Trend Detective).
Investigate the following satellite-era observations and statistical tests:

PRIMARY EARTH SCIENCE VARIABLE:
- Name: ${variable.name} (${variable.shortCode})
- Earth Sphere: ${variable.sphere}
- Instrument / Model: ${variable.instrumentOrModel} (${variable.agency})
- Physical Unit: ${variable.unit}
- Definition: ${variable.definition}

REGION ANALYZED:
- Name: ${region.name}
- Biome: ${region.biome}
- Coordinates: Latitude ${region.coordinates.lat}°, Longitude ${region.coordinates.lon}°
- Background Context: ${region.description}

STATISTICAL DETECTION SUMMARY (Deseasonalized ${stats.startDate} to ${stats.endDate}, Reference Baseline: ${stats.baselineUsed}):
- Sample Size: ${stats.sampleSize} monthly points (${stats.timeRangeYears} years)
- OLS Decadal Slope: ${stats.slopePerDecade > 0 ? '+' : ''}${stats.slopePerDecade} ${stats.unit} / decade
- Sen's Non-Parametric Slope: ${stats.sensSlope > 0 ? '+' : ''}${stats.sensSlope} ${stats.unit} / year
- Cumulative Net Change: ${stats.totalChange > 0 ? '+' : ''}${stats.totalChange} ${stats.unit}
- Mann-Kendall Test: Z = ${stats.mkZScore}, S = ${stats.mkSScore}, p-value = ${stats.mkPValue}
- Student's t-test p-value = ${stats.pValueTTest} (R² = ${stats.rSquared})
- Pettitt Regime Shift: ${stats.changepoint.hasChangepoint ? `Regime break detected at ${stats.changepoint.date} (p = ${stats.changepoint.pValue}, Delta Mean = ${stats.changepoint.deltaMean})` : 'No sudden structural break'}
- Verdict Category: ${stats.significanceCategory} (${stats.verdictText})

${comparisonRegion && comparisonStats ? `
DUAL-REGION COMPARATIVE CONTEXT:
- Secondary Region: ${comparisonRegion.name} (${comparisonRegion.biome})
- Secondary Decadal Trend: ${comparisonStats.slopePerDecade > 0 ? '+' : ''}${comparisonStats.slopePerDecade} ${variable.unit}/decade (MK p = ${comparisonStats.mkPValue})
` : ''}

${userQuestion ? `USER SPECIFIC DETECTIVE QUESTION:\n"${userQuestion}"\n` : ''}

INSTRUCTIONS:
Synthesize your findings into a rigorous, student-friendly NASA scientific report. Format your answer with these clear labeled sections:
1. [EXECUTIVE SUMMARY]: 2-3 sentences explaining what is changing, magnitude, and whether it is statistically significant.
2. [PHYSICAL MECHANISMS]: 3 distinct atmospheric, hydrological, or thermodynamic feedback mechanisms explaining this trend.
3. [CLIMATE PARADOX INSIGHT]: Explain why similar global heating can drive contrasting regional outcomes (e.g. Clausius-Clapeyron moisture redistribution).
4. [SIGNIFICANCE INTERPRETATION]: Plain-English explanation of what the Mann-Kendall and Pettitt test results mean for distinguishing true climate trends from weather noise.
5. [RECOMMENDED NEXT STEPS]: 2-3 concrete variables or satellite missions to examine next.
`;

  try {
    // Uses Google Search grounding per runtimeConfig specifications
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: [{ text: prompt }]
      },
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2
      }
    });

    const fullText = response.text || '';

    // Extract search grounding citations if provided by Gemini
    const groundingSources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (Array.isArray(chunks)) {
      chunks.forEach(chunk => {
        if (chunk.web?.uri) {
          groundingSources.push({
            title: chunk.web.title || 'NASA Earthdata / Science Reference',
            uri: chunk.web.uri
          });
        }
      });
    }

    // Parse sections out of the text response
    const execMatch = fullText.match(/\[EXECUTIVE SUMMARY\]:?([\s\S]*?)(?=\[PHYSICAL MECHANISMS\]|$)/i);
    const mechMatch = fullText.match(/\[PHYSICAL MECHANISMS\]:?([\s\S]*?)(?=\[CLIMATE PARADOX INSIGHT\]|$)/i);
    const paradoxMatch = fullText.match(/\[CLIMATE PARADOX INSIGHT\]:?([\s\S]*?)(?=\[SIGNIFICANCE INTERPRETATION\]|$)/i);
    const sigMatch = fullText.match(/\[SIGNIFICANCE INTERPRETATION\]:?([\s\S]*?)(?=\[RECOMMENDED NEXT STEPS\]|$)/i);
    const stepsMatch = fullText.match(/\[RECOMMENDED NEXT STEPS\]:?([\s\S]*?)$/i);

    // The model sometimes leaves markdown scaffolding behind ("### 2." before the next section, leading colons, bold-only lines).
    const tidy = (raw: string): string =>
      raw
        .replace(/\n?\s*#{1,6}\s*\d*\.?\s*$/g, '')
        .replace(/^\s*[:\-–]\s*/, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const parseBulletList = (raw: string | undefined, defaultList: string[]): string[] => {
      if (!raw) return defaultList;
      const lines = tidy(raw)
        .split('\n')
        .map(l => l.replace(/^[-*•\d.]+\s+/, '').trim())
        .filter(l => l.length > 10 && !l.endsWith(':')); // drop intro lines such as "...mechanisms:"
      return lines.length > 0 ? lines.slice(0, 4) : defaultList;
    };

    return {
      executiveSummary: execMatch && tidy(execMatch[1]) ? tidy(execMatch[1]) : `Satellite and model observations over ${stats.timeRangeYears} years in ${region.name} reveal a ${stats.direction.toLowerCase()} rate of change of ${stats.slopePerDecade > 0 ? '+' : ''}${stats.slopePerDecade} ${stats.unit}/decade (${stats.significanceCategory.replace(/_/g, ' ')}).`,
      physicalMechanisms: parseBulletList(mechMatch ? mechMatch[1] : undefined, []),
      climateParadoxInsight: paradoxMatch ? tidy(paradoxMatch[1]) : '',
      significanceInterpretation: sigMatch && tidy(sigMatch[1]) ? tidy(sigMatch[1]) : `The Mann-Kendall test yields p = ${stats.mkPValue}. ${stats.verdictText} ${stats.changepoint.hasChangepoint ? `A structural shift occurred around ${stats.changepoint.date}.` : ''}`,
      recommendedNextSteps: parseBulletList(stepsMatch ? stepsMatch[1] : undefined, []),
      groundingSources: groundingSources.length > 0 ? groundingSources.slice(0, 4) : undefined
    };
  } catch (error) {
    console.error('Gemini Trend Diagnostic Error:', error);
    // No canned text: the caller shows an honest "AI unavailable" state. The statistics never depend on the AI.
    throw new AiUnavailableError(
      'The AI assistant is not available right now (it needs the Vertex AI configuration on the server). The statistics shown are computed locally and are unaffected.'
    );
  }
}
