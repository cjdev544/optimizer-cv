interface JobOfferInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function JobOfferInput({ value, onChange }: JobOfferInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="job-offer" className="text-xs font-medium text-gray-700">
        Oferta de empleo
      </label>
      <textarea
        id="job-offer"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Pega aquí el texto de la oferta de empleo (título, requisitos, descripción)…"
        className="h-24 w-full resize-none rounded-md border border-gray-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <p className="text-[11px] text-gray-400">
        La extensión de Chrome captura esto automáticamente de la pestaña activa. Fuera de la
        extensión, pégalo aquí manualmente.
      </p>
    </div>
  );
}
