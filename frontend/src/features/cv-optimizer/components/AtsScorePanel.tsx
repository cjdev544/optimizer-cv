interface ScoreBarProps {
  label: string;
  score: number;
  barClassName: string;
}

function ScoreBar({ label, score, barClassName }: ScoreBarProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] text-gray-600">
        <span>{label}</span>
        <span className="font-semibold text-gray-800">{score}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClassName}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

interface AtsScorePanelProps {
  beforeScore: number;
  afterScore: number;
}

export function AtsScorePanel({ beforeScore, afterScore }: AtsScorePanelProps) {
  const improvement = afterScore - beforeScore;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Score de Coincidencia ATS</h2>
        {improvement > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            +{improvement}%
          </span>
        )}
      </div>

      <ScoreBar label="Antes" score={beforeScore} barClassName="bg-gray-400" />
      <ScoreBar
        label="Después"
        score={afterScore}
        barClassName="bg-gradient-to-r from-indigo-500 to-violet-500"
      />

      <p className="text-[10px] text-gray-400">
        Estimación basada en palabras clave de la oferta presentes en el CV. No reemplaza el
        scoring real de un ATS.
      </p>
    </section>
  );
}
