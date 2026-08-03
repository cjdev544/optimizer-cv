// Heurística simple de coincidencia de palabras clave (no es el algoritmo real
// de un ATS comercial): extrae términos significativos de la oferta y mide qué
// porcentaje aparece, literalmente, en el texto del CV.
const STOPWORDS = new Set([
  // Español
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'con', 'para', 'por', 'que', 'su',
  'al', 'del', 'se', 'es', 'lo', 'como', 'mas', 'o', 'pero', 'sus', 'le', 'ya', 'este', 'esta',
  'ha', 'nos', 'muy', 'sin', 'sobre', 'entre', 'tambien', 'hasta', 'donde', 'quien', 'desde',
  'todo', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos',
  'esto', 'antes', 'algunos', 'unos', 'yo', 'otro', 'otras', 'otra', 'tanto', 'esa', 'estos',
  'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo',
  'nosotros', 'buscamos', 'ofrecemos', 'requisitos',
  // Inglés
  'the', 'and', 'are', 'for', 'with', 'you', 'your', 'our', 'will', 'have', 'has', 'from', 'their',
  'they', 'its', 'this', 'that', 'looking', 'strong', 'experience', 'work', 'team', 'role', 'job',
]);

export interface AtsScoreResult {
  score: number;
  matchedKeywords: string[];
  totalKeywords: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function extractKeywords(jobOfferText: string): string[] {
  // El punto solo es parte de la keyword cuando une alfanuméricos (ej. "node.js",
  // "next.js"): (?:\.[a-z0-9+#]+)* exige que después de cada punto haya más
  // caracteres de palabra. Sin este límite, un simple /[a-z0-9+#.]{3,}/ también
  // engancha el punto final de cualquier oración a la última palabra (ej.
  // "TypeScript." al final de un bullet), generando keywords como "typescript."
  // que casi nunca matchean el CV aunque la habilidad sí esté presente.
  const words = normalize(jobOfferText).match(/[a-z0-9+#]{3,}(?:\.[a-z0-9+#]+)*/g) ?? [];
  return Array.from(new Set(words)).filter((word) => !STOPWORDS.has(word));
}

export function calculateAtsScore(cvText: string, jobOfferText: string): AtsScoreResult {
  const keywords = extractKeywords(jobOfferText);
  if (keywords.length === 0) {
    return { score: 0, matchedKeywords: [], totalKeywords: 0 };
  }

  const normalizedCv = normalize(cvText);
  const matchedKeywords = keywords.filter((keyword) => normalizedCv.includes(keyword));

  return {
    score: Math.round((matchedKeywords.length / keywords.length) * 100),
    matchedKeywords,
    totalKeywords: keywords.length,
  };
}
