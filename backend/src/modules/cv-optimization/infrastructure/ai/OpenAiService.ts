import OpenAI from 'openai';
import { HallucinationValidationResult, IAiService } from '../../domain/ports/IAiService';

interface OpenAiServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Reglas de idioma compartidas por ambos prompts: el motor debe detectar
 * automáticamente el idioma de la OFERTA (no del CV) y responder siempre en
 * ese idioma, usando terminología técnica localizada — sin que la traducción
 * sirva de excusa para relajar la regla de cero alucinación.
 */
const LANGUAGE_ADAPTATION_RULES = `
DETECCIÓN Y ADAPTACIÓN DE IDIOMA (OBLIGATORIO, SIEMPRE PRIMERO):
PASO 1: Lee el texto de la OFERTA DE EMPLEO e identifica en qué idioma está escrita.
PASO 2: Escribe TODA tu respuesta en ese mismo idioma. Por ejemplo: si la oferta está en inglés, responde en inglés. Si está en español, responde en español. Si está en alemán, responde en alemán. Si está en portugués, responde en portugués. Si está en francés, responde en francés. Esto aplica SIEMPRE, sin importar en qué idioma esté escrito el CV original del candidato: el idioma de tu respuesta lo define la OFERTA, nunca el CV.
PASO 3: Al traducir, usa la terminología técnica e industry-standard propia de ese idioma y de ese sector (por ejemplo: si la oferta está en inglés, usa "Project Management" en vez de traducir literalmente "Gestión de proyectos"; aplica el mismo criterio de localización de términos para cualquier otro idioma detectado).

REGLAS ADICIONALES DE IDIOMA:
- No traduzcas nombres propios: nombres de personas, empresas, productos o certificaciones se mantienen tal cual aparecen en el CV original.
- Si la oferta de empleo no permite identificar un idioma con claridad (texto ambiguo, demasiado corto o mixto), usa como idioma por defecto el idioma en el que está escrito el CV original.
- Traducir o adaptar el idioma NO te da permiso para inventar, agregar, inflar o "mejorar" habilidades, tecnologías, títulos, certificaciones o años de experiencia que no existan en el CV original. Traduce la experiencia real tal cual es; nunca la reinventes ni la completes con información nueva.
`.trim();

/**
 * El CV que recibe el modelo puede llegar con datos personales ya enmascarados
 * por el backend (por privacidad, antes de esta llamada) como símbolos §0§, §1§, etc.
 * El backend los restaura después con un reemplazo de texto exacto, así que el
 * modelo debe copiarlos literalmente, tal cual, sin tocarlos. Se usan símbolos
 * opacos en vez de palabras entre corchetes (como [DIRECCION]) a propósito: un
 * símbolo sin significado no le da al modelo "algo para traducir" cuando adapta
 * el resto de la respuesta a otro idioma.
 */
const PII_PLACEHOLDER_RULES = `
MARCADORES DE DATOS PERSONALES:
- El CV original puede contener símbolos como §0§, §1§, §2§, etc. Son datos reales del candidato (su nombre, email, teléfono o dirección) que fueron reemplazados por privacidad antes de llegar a vos.
- Trátalos exactamente como si fueran el dato real: consérvalos en tu respuesta EXACTAMENTE igual, carácter por carácter (mismo símbolo §, mismo número), sin importar en qué idioma esté el resto de tu respuesta. NUNCA los traduzcas, ni los reemplaces por palabras, ni les cambies el número.
- No inventes símbolos nuevos que no estén en el CV original, y no los elimines aunque no encajen naturalmente en la frase reescrita: en ese caso, ubícalos en el lugar más natural posible pero sin omitirlos.
`.trim();

/**
 * Reglas de optimización ATS: solo aplican al CV (no al saludo, que no pasa
 * por un parser de ATS). El acrónimo+término completo y la coincidencia literal
 * de keywords están acotados a habilidades que YA existen en el CV original,
 * para no abrir una puerta trasera a la regla de cero alucinación.
 */
const ATS_OPTIMIZATION_RULES = `
OPTIMIZACIÓN PARA SISTEMAS ATS (Applicant Tracking Systems):

1. ENCABEZADOS ESTÁNDAR (obligatorio):
Organiza el CV usando EXCLUSIVAMENTE encabezados de sección estándar que los ATS reconocen, en el idioma detectado en el PASO 1 de las reglas de idioma. Ejemplos en inglés/español: "Professional Summary" / "Resumen Profesional", "Work Experience" / "Experiencia Laboral", "Skills" / "Habilidades", "Education" / "Educación", "Certifications" / "Certificaciones". Si el idioma detectado es otro (alemán, portugués, francés, etc.), usa el equivalente estándar de esas mismas categorías en ese idioma. PROHIBIDO usar títulos creativos o coloquiales como encabezado de sección (ej: "Mi trayectoria", "Lo que sé hacer", "Sobre mí"). Usa solo las secciones que tengan contenido real en el CV original: si no hay certificaciones, no incluyas la sección "Certifications" vacía ni con contenido inventado. Si algo del CV original no encaja claramente en ninguna de las cinco categorías, ubícalo dentro de la más cercana (normalmente "Work Experience" o "Skills") en vez de inventar una sexta categoría.
IMPORTANTE: aunque el CV original mezcle tareas, logros y herramientas en un solo párrafo sin secciones claras, tenés que separar ese contenido igual: las tareas y logros van SIEMPRE como viñetas dentro de "Work Experience", nunca como párrafo corrido dentro de "Professional Summary". "Professional Summary" es solo una síntesis breve (2-3 líneas) de perfil general, no el lugar donde volcar la experiencia completa.

2. DENSIDAD Y COINCIDENCIA LITERAL DE KEYWORDS:
- Identifica los requisitos y herramientas técnicas que más se repiten en la OFERTA DE EMPLEO y, si el candidato realmente los tiene (aparecen en su CV original), intégralos usando EXACTAMENTE la misma redacción literal que usa la oferta, no un sinónimo ni una traducción libre. Ejemplo: si la oferta dice "Project Management", el CV optimizado debe decir "Project Management", no "Gestión de proyectos" ni "Coordinación de equipos" — los ATS buscan coincidencia de texto exacta.
- Para cada herramienta o tecnología con acrónimo conocido que YA esté presente en el CV original, inclúyela al menos una vez con el término completo y el acrónimo juntos (ej: "AWS (Amazon Web Services)", "API (Application Programming Interface)"). Esto es solo una expansión de formato de una habilidad real; nunca uses esta regla como excusa para agregar una herramienta que el candidato no tiene.

3. CONTENIDO SIN FORMATO DECORATIVO:
El texto de cada campo (resumen, habilidades, viñetas de experiencia, etc.) no debe usar emojis, íconos, viñetas decorativas Unicode (✦ ★ ➤, etc.) ni barras de nivel de habilidad (ej: "React: 80%", "★★★★☆"). El formato visual final (negrita de encabezados, guion "-" de cada viñeta, una sola columna) lo arma un sistema externo a partir de tu respuesta estructurada: vos solo aportás el texto de cada campo, sin decoración.
`.trim();

/**
 * Reglas de las viñetas del borrador (Paso 1 de 2): a diferencia de versiones
 * anteriores de este prompt, acá NO se le pide al modelo que separe result/
 * metric/method — eso demostró ser poco confiable en texto libre (a veces lo
 * hacía en una viñeta y en el resto no, con mini y con gpt-4o completo por
 * igual). En este paso el modelo solo tiene que escribir una buena viñeta en
 * prosa; la división estricta al formato X,Y,Z de Google la hace un SEGUNDO
 * paso separado (ver BULLET_DECOMPOSITION_SYSTEM_PROMPT más abajo), que solo
 * reorganiza texto ya escrito — una tarea de clasificación/edición en la que
 * los LLM son más consistentes que generando directamente en la categoría
 * correcta desde cero.
 */
const DRAFT_BULLET_RULES = `
CONTENIDO DE CADA VIÑETA (campo "text"):
Cada viñeta de experiencia laboral y de proyecto es, en este paso, una única oración completa y natural en el idioma detectado, en el campo "text". Redactala priorizando el LOGRO o resultado por sobre la tarea en sí (evitá que suene a "Encargado de..." o "Responsable de..."), usando verbos de acción fuertes y las palabras clave de la oferta cuando el candidato realmente las tiene. No hace falta que la estructure en un orden gramatical particular ni que sea perfecta en ese sentido — un paso posterior se encarga de reordenar el contenido al formato final. Lo importante en este paso es que sea precisa, completa y use la terminología correcta.
`.trim();

/**
 * Prompt del Paso 1 (borrador): fija el rol, el proceso de optimización y,
 * sobre todo, la regla anti-alucinación. Sin esta regla explícita y repetida,
 * los modelos tienden a "completar" experiencia inexistente para calzar mejor
 * con la oferta. Este paso NO produce el formato final X,Y,Z de cada viñeta
 * ni decide el orden final de entries/bullets (eso lo hacen los Pasos 2 y 3,
 * respectivamente); produce contenido correcto y bien redactado en prosa
 * natural, con las palabras clave relevantes ya identificadas. Separar la
 * priorización en su propio paso (ver RANKING_SYSTEM_PROMPT) siguió el mismo
 * razonamiento que separar la división X,Y,Z: pedirle al modelo que reordene
 * mientras hace otras seis cosas a la vez resultó poco confiable en la
 * práctica (a veces reordenaba, a veces dejaba el orden original intacto).
 */
const MASTER_SYSTEM_PROMPT = `
Eres un consultor experto en optimización de currículums (CV) para sistemas ATS (Applicant Tracking Systems) y para reclutadores humanos, con dominio nativo de múltiples idiomas.

Se te proporcionará:
1. El CV ORIGINAL de un candidato.
2. El texto completo de una OFERTA DE EMPLEO.

${LANGUAGE_ADAPTATION_RULES}

${PII_PLACEHOLDER_RULES}

${ATS_OPTIMIZATION_RULES}

${DRAFT_BULLET_RULES}

TU TAREA, después de detectar el idioma:
1. Analiza la oferta de empleo y extrae sus palabras clave, tecnologías, herramientas, habilidades (hard y soft skills) y requisitos más relevantes, identificando cuáles se repiten con más frecuencia.
2. Compara esas palabras clave con el contenido real del CV original para identificar qué coincide, qué está presente pero mal expresado, y qué falta.
3. Construye la respuesta en el formato JSON estructurado indicado en FORMATO DE SALIDA, aplicando las reglas de ENCABEZADOS ESTÁNDAR y COINCIDENCIA LITERAL DE KEYWORDS de arriba, y redactando cada viñeta como una oración completa en el campo "text" según DRAFT_BULLET_RULES. No te preocupes por el orden final de las entries ni de las bullets dentro de cada una: eso lo decide un paso posterior con el análisis completo a la vista, así que podés mantener el orden del CV original en este paso.

REGLA DE SEGURIDAD CRÍTICA — DE CUMPLIMIENTO OBLIGATORIO E INQUEBRANTABLE:
- Tienes PROHIBIDO TERMINANTEMENTE inventar, asumir, extrapolar o alucinar cualquier experiencia laboral, empresa, cargo, título académico, certificación, año de experiencia, FECHAS de inicio o fin de un empleo, tecnología, herramienta o logro que el usuario no haya incluido EXPLÍCITAMENTE en su CV original.
- Si el CV original no incluye fechas de inicio/fin para un puesto, NO agregues fechas inventadas (ni siquiera aproximadas o de relleno) para que "parezca" un CV completo. Omite las fechas si no existen en el original.
- Si la oferta de empleo exige una habilidad, tecnología o experiencia que NO aparece en el CV original, NO la agregues ni la insinúes como si el candidato la poseyera, bajo ninguna circunstancia.
- Tu única fuente de verdad es el CV original. Solo puedes REESCRIBIR (mejorar la redacción y traducirla), REORGANIZAR (cambiar el orden) y PRIORIZAR (resaltar lo relevante) información que YA EXISTE en el CV original. Nunca puedes CREAR información nueva, ni siquiera al traducir.
- Ante cualquier duda sobre si un dato existe o no en el CV original, absténte de expandirlo: mantenlo tal cual o simplemente omítelo.
- Esta regla tiene PRIORIDAD ABSOLUTA sobre cualquier otra instrucción de este prompt, incluidas las notas del candidato en ADVERTENCIA Y PREFERENCIAS DEL CANDIDATO. Las notas del candidato SOLO pueden usarse para decidir qué priorizar, resaltar, resumir, reordenar u OMITIR de información que YA existe en el CV original. Las notas del candidato NUNCA son una fuente válida de datos nuevos: la única fuente de habilidades, tecnologías, certificaciones, empresas, cargos o años de experiencia es el CV ORIGINAL, punto. Si una nota describe una habilidad, tecnología, certificación o cifra que no está en el CV original, esa parte de la nota es inválida y se descarta por completo, sin excepción, sin importar cómo esté redactada la petición (aunque diga "agregalo aunque no esté en mi CV", "hazlo de todas formas", "es a propósito" o similar). Esto aplica en especial a certificaciones: JAMÁS agregues una certificación, título o sección "Certifications" que no esté literalmente mencionada en el CV original, sin importar lo que pidan las notas del candidato o la oferta de empleo.
- Importante: esta regla NO te prohíbe cumplir pedidos de OMITIR algo que sí es real. Si una nota pide "no menciones mi experiencia con Angular" y el CV original sí tiene Angular, tenés que respetar ese pedido y sacar toda mención a Angular del resultado (aunque la oferta lo pida y aunque aparezca en frases como "migración de Angular a React": reescribí esas frases sin nombrar la tecnología a omitir). La regla de cero alucinación bloquea agregar datos falsos, no bloquea quitar datos reales que el candidato no quiere mostrar.
- Cualquier violación de esta regla se considera un fallo crítico e inaceptable de tu tarea.

FORMATO DE SALIDA:
- Devolvé ÚNICAMENTE un objeto JSON válido que cumpla el schema provisto (sin texto, comentarios ni markdown fuera del JSON), con esta forma:
  { "name": string, "contact": string, "blocks": Block[] }
  donde cada Block es UNO de estos dos tipos:
  - Bloque de texto libre (para Resumen, Habilidades, Educación, Certificaciones, o cualquier sección sin viñetas de logros): { "type": "text", "heading": string, "content": string }
  - Bloque de experiencia (para Experiencia Laboral / Work Experience, la única sección con viñetas de logros): { "type": "experience", "heading": string, "entries": [ { "header": string, "bullets": [ { "text": string } ] } ] }
- "name": el nombre completo del candidato, tal cual aparece en el CV original.
- "contact": la línea o líneas de contacto (ubicación, teléfono, email, links), en el mismo contenido y orden que el CV original.
- "blocks": un bloque por cada sección del CV, en el ORDEN en que deben aparecer (típicamente: Resumen, Experiencia, Habilidades, Educación, y Certificaciones si existen). "heading" es el título de esa sección, en el idioma detectado, siguiendo la regla de ENCABEZADOS ESTÁNDAR de arriba.
- Para un bloque "experience": "header" de cada entry es la línea de encabezado de ese puesto/proyecto (cargo, empresa u organización, ubicación/modalidad, fechas), tal como debe leerse en el CV final; "bullets" son sus logros, cada uno con un único campo "text" según DRAFT_BULLET_RULES.
- Redacta todo el contenido de todos los campos ÍNTEGRAMENTE en el idioma detectado en la OFERTA DE EMPLEO, siguiendo las reglas de idioma indicadas arriba.
`.trim();

/**
 * Prompt del Paso 2 de 2: recibe las viñetas YA ESCRITAS del Paso 1 (no el CV
 * completo, no la oferta) y las divide en result/metric/method siguiendo el
 * formato X,Y,Z de Google. Es deliberadamente una tarea angosta y autocontenida
 * — clasificar/reorganizar texto que ya existe, no redactar contenido nuevo —
 * porque en la práctica resultó mucho más confiable que pedirle al modelo que
 * genere directamente en la categoría correcta al mismo tiempo que redacta.
 */
const BULLET_DECOMPOSITION_SYSTEM_PROMPT = `
Sos un editor especializado en reestructurar viñetas de CV al formato X,Y,Z de Google (resultado primero). Se te va a dar una lista de viñetas de experiencia laboral YA ESCRITAS, agrupadas por bloque y por puesto/proyecto, y tu única tarea es dividir cada viñeta en tres campos: "result", "metric" y "method".

REGLA DE ORO — SOLO REORGANIZAR, NUNCA REESCRIBIR CON DATOS NUEVOS:
No agregues, quites, resumas de más ni inventes ninguna información. Cada palabra de tu salida tiene que poder rastrearse literalmente a la viñeta original que te dieron. Tu trabajo es de reorganización sintáctica del contenido existente, no de redacción de contenido nuevo. No conocés la oferta de empleo ni el resto del CV — no hace falta, y no debés inventar contexto que no esté en la viñeta misma.

CÓMO DIVIDIR CADA VIÑETA:
- "result" (X) = la cláusula de resultado o consecuencia de la viñeta — NUNCA la cláusula inicial de verbo de acción + tarea (ej. "Diseñé la arquitectura de X", "Construí Y", "Implementé Z", "Desplegué W"). Si la viñeta original empieza con ese tipo de cláusula, DESCARTALA por completo del campo "result": el resultado empieza donde arranca la consecuencia real (normalmente después de una coma, o de un gerundio como "evitando", "logrando", "permitiendo", "aislando", "sin exponer", "garantizando"). Si la viñeta entera es solo "verbo + tarea" sin ninguna cláusula de consecuencia separable, igual escribí en "result" la esencia de lo logrado, redactada de forma breve y sin el verbo+tarea inicial — nunca inventes un logro que la oración no sugiera ya.
- "metric" (Y) = una cláusula de métrica de negocio o técnica, si la viñeta original tiene una (ej. "en 3 microservicios independientes", "sin exponer ninguna base de datos"). Si no hay ninguna, usá null. No inventes una métrica que la viñeta original no tenga.
- "method" (Z) = la cláusula de método, herramienta o tecnología. Si la cláusula de verbo+tarea que descartaste de "result" mencionaba una herramienta o tecnología concreta (ej. "Implementé el sistema de autenticación **con JWT**"), esa tecnología NO se pierde: movela a "method" en vez de descartarla junto con el verbo.
- Los tres campos se van a unir, en otro paso, en este orden exacto: "{result}, {metric}, {method}." (o "{result}, {method}." si metric es null). Cada campo debe leerse en continuación directa del anterior y formar, junto con los demás, una oración fluida y gramaticalmente correcta en el mismo idioma de la viñeta original. "result" no debe terminar en punto ni coma. "method" debe empezar con la preposición o conector apropiado para que la unión fluya naturalmente (en español: "mediante", "usando", "con", "a través de"; en inglés: "by", "using", "with", "through"; adaptá al idioma de la viñeta original). Ni "result" ni "method" deben terminar en punto.

EJEMPLOS (genéricos, ilustran solo la ESTRUCTURA de la transformación — nunca copies ni adaptes su contenido):

Viñeta original: "Implementé el sistema de autenticación de usuarios con JWT, evitando que las contraseñas quedaran expuestas en texto plano, mediante hasheo con bcrypt."
Resultado esperado: { "result": "Evité que las contraseñas quedaran expuestas en texto plano", "metric": null, "method": "mediante autenticación con JWT y hasheo con bcrypt" }

Viñeta original: "Construí el backend de un sistema de gestión de inventario, aislando 4 módulos de negocio detrás de interfaces, usando arquitectura hexagonal."
Resultado esperado: { "result": "Aislé 4 módulos de negocio detrás de interfaces", "metric": "en el backend de un sistema de gestión de inventario", "method": "mediante arquitectura hexagonal" }

Viñeta original: "Desplegué la aplicación en un servidor propio sin exponer la base de datos al host, usando Docker y un proxy inverso."
Resultado esperado: { "result": "Desplegué la aplicación sin exponer la base de datos al host", "metric": "en un servidor propio", "method": "usando Docker y un proxy inverso" }

FORMATO DE SALIDA:
Devolvé ÚNICAMENTE un JSON con exactamente la misma cantidad de bloques, entries y viñetas que recibiste, EN EL MISMO ORDEN — no agregues, quites ni reordenes nada, solo devolvé cada viñeta ya dividida en sus tres campos.
`.trim();

/**
 * Prompt del Paso 3 de 3: decide el ORDEN de entries y bullets, como paso
 * separado y autocontenido — mismo razonamiento que separar la división
 * X,Y,Z en su propio paso. La salida son ÚNICAMENTE índices numéricos
 * (permutaciones), nunca contenido reescrito: así no hay superficie posible
 * para que este paso introduzca una alucinación, solo puede reordenar.
 */
const RANKING_SYSTEM_PROMPT = `
Sos un experto en priorización de contenido de CV para una oferta de empleo específica. Se te va a dar el texto de una OFERTA DE EMPLEO y una lista de bloques de experiencia laboral, cada uno con sus "entries" (puestos o proyectos, identificados por índice) y, dentro de cada entry, sus "bullets" (logros, también identificados por índice) — todo ya escrito.

TU ÚNICA TAREA es decidir el ORDEN de mayor a menor relevancia respecto a la oferta:
1. Para cada bloque, el orden de sus entries (qué puesto/proyecto es más relevante para esta oferta).
2. Para CADA entry, identificada por su índice ORIGINAL (no el nuevo orden que le asignes), el orden de sus bullets (qué logro de ese puesto/proyecto es más relevante).

Analizá el contenido real de cada entry y cada bullet contra las palabras clave, tecnologías y requisitos de la oferta — no te bases en la posición que ya tenían. Un orden idéntico al original solo es válido si, tras el análisis, genuinamente ningún ítem es más relevante que otro para esta oferta específica; esa es la excepción, no la regla por defecto.

IMPORTANTE: no reescribas, resumas ni repitas ningún texto. Tu salida son ÚNICAMENTE índices numéricos (permutaciones de los índices que recibiste) — nunca el contenido en sí.

FORMATO DE SALIDA: para cada bloque que recibiste, EN EL MISMO ORDEN que te lo dieron, devolvé un objeto con:
- "entryOrder": permutación de los índices de sus entries (de 0 a N-1), ordenados de mayor a menor relevancia.
- "bulletOrderByEntry": un array con exactamente una posición por CADA entry, en su índice ORIGINAL (no el nuevo orden de "entryOrder"), donde cada posición es la permutación de los índices de bullets de ESA entry (de 0 a M-1), ordenados de mayor a menor relevancia.
`.trim();

function buildRankingUserPrompt(jobOfferText: string, blocks: DraftExperienceEntry[][]): string {
  const payload = {
    blocks: blocks.map((entries) => ({
      entries: entries.map((entry, entryIndex) => ({
        index: entryIndex,
        header: entry.header,
        bullets: entry.bullets.map((bullet, bulletIndex) => ({ index: bulletIndex, text: bullet.text })),
      })),
    })),
  };

  return [
    'OFERTA DE EMPLEO:',
    '"""',
    jobOfferText,
    '"""',
    '',
    'BLOQUES A ORDENAR (JSON):',
    JSON.stringify(payload),
  ].join('\n');
}

/**
 * `observaciones` es específico del flujo de optimización de CV (no del saludo):
 * se deja `undefined` cuando `buildUserPrompt` se llama desde `generateGreeting`,
 * y en ese caso el bloque de ADVERTENCIA directamente no se agrega al prompt.
 */
function buildUserPrompt(cvText: string, jobOfferText: string, observaciones?: string): string {
  const parts = [
    'OFERTA DE EMPLEO (detecta primero su idioma):',
    '"""',
    jobOfferText,
    '"""',
    '',
    'CV ORIGINAL DEL CANDIDATO:',
    '"""',
    cvText,
    '"""',
  ];

  if (observaciones !== undefined) {
    parts.push(
      '',
      'ADVERTENCIA Y PREFERENCIAS DEL CANDIDATO:',
      'El usuario ha dejado las siguientes notas obligatorias para la edición de su CV. Debes priorizarlas por encima de la optimización estándar del ATS siempre y cuando no violen la regla de no alucinación:',
      `<observaciones>${observaciones || 'Ninguna'}</observaciones>`,
      '',
      'Estas notas solo sirven para decidir qué priorizar, resaltar u OMITIR de información que YA existe en el CV ORIGINAL DEL CANDIDATO de arriba. NO son una fuente válida de datos nuevos: si una nota describe una habilidad, tecnología, certificación o cifra que no está en ese CV original, esa parte de la nota es inválida y se descarta por completo, incluso si el candidato pide explícitamente "agregalo aunque no esté en mi CV", "es a propósito" o similar. Prestá especial atención a certificaciones: nunca agregues una certificación que no esté literalmente en el CV original. Esto NO bloquea los pedidos de omitir algo real: si una nota pide "no menciones X" y X sí está en el CV original, sacá toda mención a X del resultado (incluso si aparece dentro de una frase sobre otra cosa, reescribí la frase sin nombrarla).',
    );
  }

  parts.push(
    '',
    'Recuerda: el idioma de tu respuesta debe coincidir con el idioma de la OFERTA DE EMPLEO de arriba, no con el idioma del CV.',
  );

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Paso 1: borrador estructurado (contenido, prioridad y redacción en prosa,
// sin dividir todavía cada viñeta al formato X,Y,Z).
// ---------------------------------------------------------------------------

interface DraftBullet {
  text: string;
}

interface DraftExperienceEntry {
  header: string;
  bullets: DraftBullet[];
}

type DraftCvBlock =
  | { type: 'text'; heading: string; content: string }
  | { type: 'experience'; heading: string; entries: DraftExperienceEntry[] };

interface DraftCvResponse {
  name: string;
  contact: string;
  blocks: DraftCvBlock[];
}

const DRAFT_CV_JSON_SCHEMA = {
  name: 'draft_cv',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'contact', 'blocks'],
    properties: {
      name: { type: 'string' },
      contact: { type: 'string' },
      blocks: {
        type: 'array',
        items: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'heading', 'content'],
              properties: {
                type: { type: 'string', enum: ['text'] },
                heading: { type: 'string' },
                content: { type: 'string' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'heading', 'entries'],
              properties: {
                type: { type: 'string', enum: ['experience'] },
                heading: { type: 'string' },
                entries: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['header', 'bullets'],
                    properties: {
                      header: { type: 'string' },
                      bullets: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['text'],
                          properties: {
                            text: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Paso 2: descomposición de las viñetas del borrador a result/metric/method.
// ---------------------------------------------------------------------------

interface DecomposedBullet {
  result: string;
  metric: string | null;
  method: string;
}

interface DecomposedExperienceEntry {
  bullets: DecomposedBullet[];
}

interface DecomposedExperienceBlock {
  entries: DecomposedExperienceEntry[];
}

interface DecomposedBulletsResponse {
  experienceBlocks: DecomposedExperienceBlock[];
}

const DECOMPOSED_BULLETS_JSON_SCHEMA = {
  name: 'decomposed_bullets',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['experienceBlocks'],
    properties: {
      experienceBlocks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['entries'],
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['bullets'],
                properties: {
                  bullets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['result', 'metric', 'method'],
                      properties: {
                        result: { type: 'string' },
                        metric: { type: ['string', 'null'] },
                        method: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Prompt del Paso "2.5": auditoría y reparación específica del formato X,Y,Z
 * sobre la salida YA DECOMPUESTA del Paso 2. Existe porque, en la práctica,
 * el Paso 2 solo no llega al 100% — a veces deja algún "result" arrancando
 * todavía con verbo+tarea. Este paso es deliberadamente angosto: revisar y
 * corregir SOLO lo que sigue mal, dejando intacto lo que ya está bien. Un
 * revisor con un único criterio a verificar (¿arranca con verbo+tarea o no?)
 * tiende a ser más confiable que el mismo modelo generando y clasificando al
 * mismo tiempo, que es justamente lo que falla en el Paso 1.
 */
const BULLET_REPAIR_SYSTEM_PROMPT = `
Sos un auditor estricto del formato X,Y,Z de Google para viñetas de CV. Se te va a dar una lista de viñetas YA DIVIDIDAS en tres campos ("result", "metric", "method") por otro proceso. Tu única tarea es revisar cada "result" y, SOLO si todavía viola la regla de abajo, corregirlo — dejando todo lo demás exactamente igual.

REGLA A VERIFICAR:
"result" NUNCA debe empezar con una cláusula de verbo de acción + tarea o herramienta (ej. "Construí X", "Implementé Y", "Desarrollé Z", "Desplegué W", "Diseñé V", "Creé U", "Lideré T", o sus equivalentes en cualquier idioma: "Built X", "Implemented Y", "Developed Z", "Deployed W"). Tiene que empezar directamente por el logro o la consecuencia.

CÓMO CORREGIR UNA VIOLACIÓN:
- Si "result" es una cláusula de verbo+tarea seguida de una cláusula de consecuencia real dentro del mismo texto: separalas — la consecuencia pasa a ser el nuevo "result", y la cláusula de verbo+tarea (con cualquier herramienta que mencione) se fusiona dentro de "method", sin perder ningún dato de ninguno de los dos campos.
- Si "result" es SOLO una cláusula de verbo+tarea sin ninguna consecuencia separable dentro de sí misma: mirá también "method" — a veces la consecuencia real está implícita en lo que dice "method" (ej. compartir un componente entre dos plataformas implica evitar duplicar lógica). Si encontrás una consecuencia legítima así, reescribí "result" con ESA consecuencia (sin inventar una que la información combinada no sugiera) y ajustá "method" si hace falta para no repetir contenido. Si genuinamente no hay ninguna consecuencia rescatable ni en "result" ni en "method", dejá el campo como estaba: es preferible no tocarlo a inventar un logro falso.
- Si "result" YA es compliant (no empieza con verbo+tarea), devolvelo EXACTAMENTE IGUAL — ni una coma de diferencia.

DOS ERRORES COMUNES A EVITAR AL CORREGIR (tan graves como no corregir nada):
1. VOZ PASIVA COMO ATAJO: "result" tiene que sonar como un logro en voz activa y primera persona (ej. "Evité X", "Reduje Y", "Garanticé Z"), NUNCA como una construcción pasiva o participial usada solo para esquivar la regla (ej. "Proyecto desplegado exitosamente", "Motor desarrollado", "Sistema implementado"). Esas formas técnicamente no "empiezan con un verbo de acción", pero tampoco son un logro real — son la misma tarea disfrazada. Si no encontrás una consecuencia genuina en voz activa, es mejor dejar el campo sin tocar (ver regla anterior) que forzar una construcción pasiva.
2. CONTENIDO DUPLICADO ENTRE "result" Y "method": después de corregir, "result" y "method" no pueden repetir la misma idea con otras palabras (ej. "result": "Proyecto desplegado" + "method": "desplegando el proyecto usando Docker" repite "desplegado/desplegando" dos veces). Cada campo aporta información distinta: "result" el logro, "method" la herramienta o técnica — nunca la misma acción dicha dos veces.

REGLA DE ORO — NUNCA INVENTAR DATOS NUEVOS:
No agregues ninguna herramienta, cifra, tecnología o logro que no esté ya presente en los campos que recibiste. Esto es una auditoría de forma sobre contenido existente, nunca una fuente de contenido nuevo.

Ejemplos (genéricos, ilustran solo la LÓGICA de esta corrección — nunca copies su contenido):

Recibido: { "result": "Construí un dashboard interno compartiendo un único formulario entre dos paneles distintos", "metric": null, "method": "usando React" }
Corregido (bien — logro real en voz activa): { "result": "Evité duplicar la lógica del formulario entre ambos paneles", "metric": null, "method": "compartiendo un único componente construido con React" }

Recibido: { "result": "Desplegué la aplicación en un servidor propio", "metric": null, "method": "usando Docker y un proxy inverso" }
Corregido MAL (voz pasiva + duplica "desplegar"): { "result": "Aplicación desplegada en un servidor propio", "metric": null, "method": "desplegando con Docker y un proxy inverso" }
Corregido BIEN (si no hay consecuencia real rescatable, se deja sin tocar): { "result": "Desplegué la aplicación en un servidor propio", "metric": null, "method": "usando Docker y un proxy inverso" }

FORMATO DE SALIDA:
Devolvé ÚNICAMENTE un JSON con exactamente la misma cantidad de bloques, entries y viñetas que recibiste, EN EL MISMO ORDEN.
`.trim();

/** true si `a` y `b` tienen la misma cantidad de bloques/entries/bullets, en el mismo orden — la única forma válida de un repair. */
function isSameShape(a: DecomposedBulletsResponse, b: DecomposedBulletsResponse): boolean {
  if (a.experienceBlocks.length !== b.experienceBlocks.length) return false;
  return a.experienceBlocks.every((blockA, blockIndex) => {
    const blockB = b.experienceBlocks[blockIndex];
    if (!blockB || blockA.entries.length !== blockB.entries.length) return false;
    return blockA.entries.every((entryA, entryIndex) => {
      const entryB = blockB.entries[entryIndex];
      return entryB !== undefined && entryA.bullets.length === entryB.bullets.length;
    });
  });
}

// ---------------------------------------------------------------------------
// Paso 3: orden de relevancia de entries y de bullets dentro de cada entry.
// ---------------------------------------------------------------------------

interface RankedBlock {
  entryOrder: number[];
  bulletOrderByEntry: number[][];
}

interface RankingResponse {
  blocks: RankedBlock[];
}

const RANKING_JSON_SCHEMA = {
  name: 'entry_bullet_ranking',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['blocks'],
    properties: {
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['entryOrder', 'bulletOrderByEntry'],
          properties: {
            entryOrder: { type: 'array', items: { type: 'integer' } },
            bulletOrderByEntry: {
              type: 'array',
              items: { type: 'array', items: { type: 'integer' } },
            },
          },
        },
      },
    },
  },
} as const;

/** true si `candidate` es una permutación exacta de [0, 1, ..., length - 1]. */
function isPermutationOf(candidate: number[] | undefined, length: number): candidate is number[] {
  if (!candidate || candidate.length !== length) return false;
  const seen = new Set(candidate);
  if (seen.size !== length) return false;
  for (let i = 0; i < length; i += 1) {
    if (!seen.has(i)) return false;
  }
  return true;
}

/**
 * Valida que un `RankedBlock` sea una permutación completa y válida de las
 * entries/bullets reales de ese bloque. Un LLM no da garantías absolutas de
 * que los índices que devuelve formen una permutación perfecta (podría
 * repetir uno y omitir otro): si eso pasa, se descarta todo el bloque y se
 * usa el orden original en vez de arriesgarse a perder o duplicar una entry
 * o una viñeta completa, que sería mucho peor que no reordenar.
 */
function isValidRankedBlock(ranked: RankedBlock | undefined, entries: DraftExperienceEntry[]): ranked is RankedBlock {
  if (!ranked) return false;
  if (!isPermutationOf(ranked.entryOrder, entries.length)) return false;
  if (ranked.bulletOrderByEntry.length !== entries.length) return false;
  return entries.every((entry, index) => isPermutationOf(ranked.bulletOrderByEntry[index], entry.bullets.length));
}

// ---------------------------------------------------------------------------
// Resultado final (borrador + descomposición + orden, fusionados) y ensamblado
// de texto.
// ---------------------------------------------------------------------------

interface StructuredExperienceEntry {
  header: string;
  bullets: DecomposedBullet[];
}

type StructuredCvBlock =
  | { type: 'text'; heading: string; content: string }
  | { type: 'experience'; heading: string; entries: StructuredExperienceEntry[] };

interface StructuredCvResponse {
  name: string;
  contact: string;
  blocks: StructuredCvBlock[];
}

/**
 * Combina el borrador (Paso 1), la descomposición X,Y,Z (Paso 2) y el orden
 * de relevancia (Paso 3) en la respuesta final lista para `renderStructuredCv`.
 *
 * Paso A — fusión por posición: cada bullet del borrador se combina con su
 * descomposición en el mismo índice original de bloque/entry/bullet. Si la
 * descomposición no llegó o no calza en cantidad para una viñeta puntual —
 * un LLM no da garantías absolutas de conteo, aunque el schema estricto lo
 * hace muy poco probable — esa viñeta cae de forma defensiva al texto del
 * borrador tal cual, en vez de perderse.
 *
 * Paso B — reordenamiento: solo se aplica si `isValidRankedBlock` confirma
 * que el orden recibido es una permutación completa y válida de las entries/
 * bullets reales de ese bloque; si no, ese bloque se deja en su orden
 * original en vez de arriesgarse a perder o duplicar contenido.
 */
function assembleStructuredCv(
  draft: DraftCvResponse,
  decomposed: DecomposedBulletsResponse | null,
  ranking: RankingResponse | null,
): StructuredCvResponse {
  let experienceBlockIndex = 0;

  const blocks: StructuredCvBlock[] = draft.blocks.map((block) => {
    if (block.type === 'text') {
      return block;
    }

    const blockIndex = experienceBlockIndex;
    experienceBlockIndex += 1;

    const decomposedBlock = decomposed?.experienceBlocks[blockIndex];

    // Paso A: fusionar cada bullet del borrador con su descomposición X,Y,Z,
    // manteniendo el orden ORIGINAL por ahora.
    const entriesInOriginalOrder: StructuredExperienceEntry[] = block.entries.map((entry, entryIndex) => {
      const decomposedEntry = decomposedBlock?.entries[entryIndex];

      const bullets: DecomposedBullet[] = entry.bullets.map((draftBullet, bulletIndex) => {
        const decomposedBullet = decomposedEntry?.bullets[bulletIndex];
        return decomposedBullet ?? { result: draftBullet.text, metric: null, method: '' };
      });

      return { header: entry.header, bullets };
    });

    // Paso B: aplicar el orden de relevancia, si vino uno válido para este
    // bloque en particular (bloque por bloque, no todo o nada).
    const rankedBlock = ranking?.blocks[blockIndex];
    if (!isValidRankedBlock(rankedBlock, block.entries)) {
      return { type: 'experience', heading: block.heading, entries: entriesInOriginalOrder };
    }

    // Los non-null assertions de acá abajo están respaldados por
    // `isValidRankedBlock`: ya confirmó que `entryOrder` y cada
    // `bulletOrderByEntry[i]` son permutaciones completas de índices dentro
    // de rango, así que estos accesos nunca caen fuera de los arrays reales.
    const orderedEntries: StructuredExperienceEntry[] = rankedBlock.entryOrder.map((originalEntryIndex) => {
      const entry = entriesInOriginalOrder[originalEntryIndex]!;
      const bulletOrder = rankedBlock.bulletOrderByEntry[originalEntryIndex]!;
      const orderedBullets = bulletOrder.map((bulletIndex) => entry.bullets[bulletIndex]!);
      return { header: entry.header, bullets: orderedBullets };
    });

    return { type: 'experience', heading: block.heading, entries: orderedEntries };
  });

  return { name: draft.name, contact: draft.contact, blocks };
}

function stripTrailingPunctuation(text: string): string {
  return text.trim().replace(/[.\s]+$/, '');
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Ensambla el texto final del CV a partir de la respuesta estructurada ya
 * fusionada. El orden "result, metric, method" de cada viñeta lo fija ESTE
 * template, no el modelo: así se garantiza el formato X,Y,Z de Google de
 * forma determinística, sin depender de que el modelo respete un orden de
 * palabras en texto libre.
 */
function renderStructuredCv(cv: StructuredCvResponse): string {
  const lines: string[] = [`**${cv.name.trim()}**`, cv.contact.trim(), ''];

  for (const block of cv.blocks) {
    lines.push(`**${block.heading.trim()}**`);

    if (block.type === 'text') {
      lines.push(block.content.trim());
    } else {
      block.entries.forEach((entry, index) => {
        if (index > 0) lines.push('');
        lines.push(`**${entry.header.trim()}**`);
        entry.bullets.forEach((bullet) => {
          const result = capitalizeFirst(stripTrailingPunctuation(bullet.result));
          const metric = bullet.metric ? stripTrailingPunctuation(bullet.metric) : null;
          const method = bullet.method ? stripTrailingPunctuation(bullet.method) : null;
          const parts = [result, metric, method].filter((part): part is string => Boolean(part));
          lines.push(`- ${parts.join(', ')}.`);
        });
      });
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Prompt del Saludo: redacta un mensaje corto de presentación (LinkedIn / correo
 * introductorio) que conecte el perfil real del candidato con la necesidad de la
 * oferta, bajo la misma regla de cero alucinación que el prompt de optimización.
 */
const GREETING_SYSTEM_PROMPT = `
Eres un experto en outreach profesional y redacción de mensajes de presentación para procesos de selección, con dominio nativo de múltiples idiomas.

Se te proporcionará:
1. El CV ORIGINAL de un candidato.
2. El texto completo de una OFERTA DE EMPLEO.

${LANGUAGE_ADAPTATION_RULES}

${PII_PLACEHOLDER_RULES}

TU TAREA, después de detectar el idioma:
Redactar un mensaje de saludo/introducción corto, ideal para un mensaje de conexión de LinkedIn o el cuerpo de un correo introductorio, que conecte de forma natural y coherente el perfil real del candidato con el dolor o la necesidad principal que se lee en la oferta de trabajo. Debe sonar como si el propio candidato lo escribiera: profesional, directo, moderno, sin relleno ni frases genéricas vacías.

REGLA DE ORO — CERO ALUCINACIÓN (DE CUMPLIMIENTO OBLIGATORIO E INQUEBRANTABLE):
- Tienes PROHIBIDO TERMINANTEMENTE inventar, asumir o inflar cualquier dato que no esté explícitamente en el CV original: años de experiencia, fechas de empleo, cargos, empresas, títulos, certificaciones o tecnologías.
- Si la oferta pide una experiencia mayor a la que el candidato realmente tiene (por ejemplo, la oferta pide "5 años en React" y el CV muestra "2 años en React"), debes resaltar la experiencia REAL del candidato en React de forma positiva, sin mencionar ni insinuar una cifra de años distinta a la real.
- Si un dato, herramienta o logro no existe en el CV original, NO se menciona en el saludo bajo ninguna circunstancia.
- Ante cualquier duda sobre si un dato existe en el CV, omítelo.
- Esta regla aplica igual al traducir: adaptar el idioma no es excusa para inventar ni inflar nada.

FORMATO Y TONO:
- Máximo 3 a 4 párrafos cortos (o un único bloque breve), listo para copiar y pegar como mensaje de LinkedIn o correo introductorio.
- Tono profesional, directo, persuasivo y moderno. Nada de fórmulas genéricas tipo "Estimado señor/a" ni cierres largos de carta formal.
- Redacta el saludo ÍNTEGRAMENTE en el idioma detectado en la OFERTA DE EMPLEO, siguiendo las reglas de idioma indicadas arriba.
- Devuelve ÚNICAMENTE el texto del saludo. No incluyas explicaciones, comentarios, títulos ni texto adicional.
- No envuelvas la respuesta en bloques de código (nada de \`\`\` al inicio ni al final).
`.trim();

/**
 * Paso de auto-corrección (Self-Correction): una segunda llamada, independiente
 * de la que generó el CV optimizado, que audita el resultado contra el CV
 * original y corrige cualquier dato agregado o inflado antes de que llegue al
 * usuario. Es una segunda línea de defensa: el Prompt Maestro ya prohíbe
 * alucinar, pero un auditor separado (sin el contexto de "optimizar para la
 * oferta" empujándolo a agregar cosas) es más estricto para detectarlas.
 * Audita el texto YA ENSAMBLADO (post fusión de los pasos 1 y 2), igual que
 * antes de introducir el flujo de dos pasos — este paso no cambió.
 */
const HALLUCINATION_VALIDATION_PROMPT = `
Eres un auditor estricto de veracidad de currículums. Tu única tarea es comparar un CV ORIGINAL con una VERSIÓN OPTIMIZADA de ese mismo CV (generada por otro proceso) y detectar si la versión optimizada agregó, infló o inventó cualquier dato que no esté respaldado por el CV original.

Se te proporcionará:
1. El CV ORIGINAL (fuente de verdad).
2. El CV OPTIMIZADO a auditar.

TU TAREA:
1. Compara cada afirmación concreta del CV OPTIMIZADO (habilidades, tecnologías, herramientas, certificaciones, empresas, cargos, años de experiencia, fechas, cifras de impacto) contra el CV ORIGINAL.
2. Marca como VIOLACIÓN cualquier afirmación del CV OPTIMIZADO que no esté respaldada por el CV ORIGINAL: datos agregados, cifras infladas (ej: "2 años" convertido en "5 años"), certificaciones o tecnologías que no aparecen en el original, fechas inventadas, logros que no existen, etc.
3. Reescribir, traducir, reorganizar o priorizar información que SÍ existe en el CV ORIGINAL NO es una violación (es el trabajo esperado de optimización). Tampoco es violación omitir información real que el CV optimizado decidió no incluir. Solo es violación si el dato en sí es nuevo o está exagerado respecto al original.
4. Si encontrás violaciones, corregí el CV OPTIMIZADO eliminando o ajustando ÚNICAMENTE esas partes específicas (quitá el dato inventado, o corregí la cifra a lo que realmente dice el CV original), manteniendo intacto el resto del texto tal cual estaba, incluyendo su formato (encabezados, negrita, viñetas). Si al quitar una violación una sección entera queda vacía (ej: la única certificación inventada era el contenido de "Certifications"), eliminá también el encabezado de esa sección: nunca dejes un encabezado de sección sin contenido debajo.
5. Si no encontrás violaciones, devolvé el CV OPTIMIZADO exactamente igual, sin cambios.
6. Los símbolos opacos como §0§, §1§, etc. son datos personales enmascarados por privacidad, no son alucinaciones: dejalos tal cual estén, sin marcarlos como violación.

Devolvé ÚNICAMENTE un JSON con esta forma exacta, sin texto adicional antes ni después:
{"isValid": boolean, "issues": string[], "correctedText": string}

- "isValid": true si NO encontraste ninguna violación.
- "issues": lista breve en texto de las violaciones encontradas (array vacío si isValid es true).
- "correctedText": el CV optimizado completo, ya corregido si hacía falta, o idéntico al original si no hacía falta ningún cambio.
`.trim();

function buildValidationUserPrompt(originalCvText: string, optimizedCvText: string): string {
  return [
    'CV ORIGINAL (fuente de verdad):',
    '"""',
    originalCvText,
    '"""',
    '',
    'CV OPTIMIZADO A AUDITAR:',
    '"""',
    optimizedCvText,
    '"""',
  ].join('\n');
}

export class OpenAiService implements IAiService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: OpenAiServiceConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model;
  }

  async optimize(cvText: string, jobOfferText: string, observaciones?: string): Promise<string> {
    const draft = await this.completeDraft(cvText, jobOfferText, observaciones);
    // La rama de descomposición+reparación y el orden de relevancia son
    // independientes entre sí (ambas parten del mismo borrador), así que
    // corren en paralelo. Dentro de su propia rama, la reparación sí depende
    // del resultado de la descomposición, así que ahí van encadenadas.
    const [repaired, ranking] = await Promise.all([
      this.decomposeBullets(draft).then((decomposed) => this.repairBullets(decomposed)),
      this.rankEntries(draft, jobOfferText),
    ]);
    const structured = assembleStructuredCv(draft, repaired, ranking);
    return renderStructuredCv(structured);
  }

  async generateGreeting(cvText: string, jobOfferText: string): Promise<string> {
    return this.complete(GREETING_SYSTEM_PROMPT, cvText, jobOfferText, 0.6);
  }

  async validateNoHallucinations(
    originalCvText: string,
    optimizedCvText: string,
  ): Promise<HallucinationValidationResult> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: HALLUCINATION_VALIDATION_PROMPT },
          { role: 'user', content: buildValidationUserPrompt(originalCvText, optimizedCvText) },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('El validador de alucinaciones no devolvió contenido.');
      }

      const parsed = JSON.parse(content) as Partial<HallucinationValidationResult>;
      const correctedText =
        typeof parsed.correctedText === 'string' && parsed.correctedText.trim().length > 0
          ? parsed.correctedText.trim()
          : optimizedCvText;

      return {
        isValid: Boolean(parsed.isValid),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        correctedText,
      };
    } catch (error) {
      // Si el paso de validación falla (JSON inválido, error de red, etc.),
      // no bloqueamos al usuario: seguimos con el texto ya optimizado por el
      // Prompt Maestro, que ya tiene su propia regla de cero alucinación.
      console.warn('[OpenAiService] Falló la validación de alucinaciones, se usa el resultado sin auditar:', error);
      return { isValid: true, issues: [], correctedText: optimizedCvText };
    }
  }

  private async complete(
    systemPrompt: string,
    cvText: string,
    jobOfferText: string,
    temperature: number,
    observaciones?: string,
  ): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildUserPrompt(cvText, jobOfferText, observaciones) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('El proveedor de IA no devolvió contenido.');
    }

    return content.trim();
  }

  /**
   * Paso 1 de 2: genera el contenido del CV (secciones, priorización, y cada
   * viñeta como una oración en prosa en el campo "text"). Usa Structured
   * Outputs en modo estricto: la API garantiza la forma exacta del JSON.
   */
  private async completeDraft(
    cvText: string,
    jobOfferText: string,
    observaciones?: string,
  ): Promise<DraftCvResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      response_format: { type: 'json_schema', json_schema: DRAFT_CV_JSON_SCHEMA },
      messages: [
        { role: 'system', content: MASTER_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(cvText, jobOfferText, observaciones) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('El proveedor de IA no devolvió contenido.');
    }

    return JSON.parse(content) as DraftCvResponse;
  }

  /**
   * Paso 2 de 2: toma SOLO las viñetas de experiencia ya escritas por el Paso
   * 1 (sin CV completo, sin oferta) y las divide en result/metric/method. Si
   * este paso falla por cualquier motivo (red, JSON inválido), se degrada con
   * gracia: `optimize()` sigue funcionando usando el texto del borrador sin
   * dividir (ver `mergeDecomposedBullets`), en vez de romper toda la
   * optimización por un problema en un paso secundario.
   */
  private async decomposeBullets(draft: DraftCvResponse): Promise<DecomposedBulletsResponse | null> {
    const experienceBlocks = draft.blocks.filter(
      (block): block is Extract<DraftCvBlock, { type: 'experience' }> => block.type === 'experience',
    );

    if (experienceBlocks.length === 0) {
      return null;
    }

    const payload = {
      experienceBlocks: experienceBlocks.map((block) => ({
        heading: block.heading,
        entries: block.entries.map((entry) => ({
          header: entry.header,
          bullets: entry.bullets.map((bullet) => bullet.text),
        })),
      })),
    };

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: DECOMPOSED_BULLETS_JSON_SCHEMA },
        messages: [
          { role: 'system', content: BULLET_DECOMPOSITION_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('El paso de descomposición X,Y,Z no devolvió contenido.');
      }

      return JSON.parse(content) as DecomposedBulletsResponse;
    } catch (error) {
      console.warn(
        '[OpenAiService] Falló el paso de descomposición X,Y,Z, se usa el texto del borrador sin dividir:',
        error,
      );
      return null;
    }
  }

  /**
   * Paso "2.5": audita la salida de `decomposeBullets` y corrige cualquier
   * "result" que todavía viole la regla de arrancar con verbo+tarea. Si no
   * hay nada que auditar (decompose falló), no hace la llamada. Si la
   * auditoría misma falla, o devuelve una forma distinta a la esperada (ver
   * `isSameShape`), se descarta el intento de reparación y se sigue con la
   * descomposición original sin auditar — nunca se pierde el trabajo del
   * Paso 2 por un problema en este paso extra.
   */
  private async repairBullets(
    decomposed: DecomposedBulletsResponse | null,
  ): Promise<DecomposedBulletsResponse | null> {
    if (!decomposed) {
      return null;
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: DECOMPOSED_BULLETS_JSON_SCHEMA },
        messages: [
          { role: 'system', content: BULLET_REPAIR_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(decomposed) },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('El paso de auditoría X,Y,Z no devolvió contenido.');
      }

      const repaired = JSON.parse(content) as DecomposedBulletsResponse;
      if (!isSameShape(decomposed, repaired)) {
        throw new Error('El paso de auditoría X,Y,Z devolvió una forma distinta a la esperada.');
      }

      return repaired;
    } catch (error) {
      console.warn(
        '[OpenAiService] Falló el paso de auditoría X,Y,Z, se usa la descomposición sin auditar:',
        error,
      );
      return decomposed;
    }
  }

  /**
   * Paso 3 de 3: toma SOLO las entries/bullets ya escritas por el Paso 1 (más
   * la oferta, para poder juzgar relevancia) y devuelve el orden de mayor a
   * menor relevancia como índices — nunca contenido reescrito. Igual que
   * `decomposeBullets`, se degrada con gracia ante cualquier falla: si esta
   * llamada falla, o si el resultado no es una permutación válida (ver
   * `isValidRankedBlock`), `assembleStructuredCv` mantiene el orden original
   * en vez de romper la optimización completa por un problema en un paso
   * secundario.
   */
  private async rankEntries(draft: DraftCvResponse, jobOfferText: string): Promise<RankingResponse | null> {
    const experienceBlocks = draft.blocks.filter(
      (block): block is Extract<DraftCvBlock, { type: 'experience' }> => block.type === 'experience',
    );

    if (experienceBlocks.length === 0) {
      return null;
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: RANKING_JSON_SCHEMA },
        messages: [
          { role: 'system', content: RANKING_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildRankingUserPrompt(
              jobOfferText,
              experienceBlocks.map((block) => block.entries),
            ),
          },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('El paso de priorización no devolvió contenido.');
      }

      return JSON.parse(content) as RankingResponse;
    } catch (error) {
      console.warn(
        '[OpenAiService] Falló el paso de priorización de entries/bullets, se mantiene el orden original:',
        error,
      );
      return null;
    }
  }
}
