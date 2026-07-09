import { useSyncExternalStore } from "react";

/**
 * City-skyline silhouette rendered at the bottom of select pages in dark mode
 * only. New cities can be added by extending SkylineCity and the SVG map.
 */
export type SkylineCity = "london" | "paris";

let currentCity: SkylineCity = "london";
const listeners = new Set<() => void>();

export function setSkylineCity(next: SkylineCity): void {
  if (next === currentCity) return;
  currentCity = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): SkylineCity => currentCity;

const FILL = "#1B1D21";

function ParisSkyline() {
  return (
    <svg
      viewBox="0 0 680 110"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className="w-full h-full"
    >
      <g fill={FILL}>
        <rect x="0" y="72" width="46" height="38" />
        <rect x="8" y="64" width="6" height="8" />
        <rect x="50" y="80" width="40" height="30" />
        <rect x="62" y="72" width="5" height="8" />
        <path d="M104 110 Q128 62 136 36 L136 28 Q138 16 141 6 L143 0 L145 6 Q148 16 150 28 L150 35 Q158 62 182 110 H164 Q150 76 143 50 Q136 76 122 110 Z" />
        <rect x="124" y="48" width="38" height="5" />
        <rect x="132" y="26" width="22" height="4" />
        <rect x="188" y="76" width="34" height="34" />
        <rect x="196" y="68" width="6" height="8" />
        <rect x="230" y="78" width="11" height="32" />
        <rect x="259" y="78" width="11" height="32" />
        <rect x="230" y="68" width="40" height="13" />
        <rect x="276" y="82" width="30" height="28" />
        <path d="M312 110 L338 72 L364 110 Z" />
        <rect x="370" y="74" width="44" height="36" />
        <rect x="382" y="66" width="5" height="8" />
        <rect x="424" y="24" width="26" height="86" />
        <path d="M470 110 v-26 q0 -20 16 -20 q16 0 16 20 v26 Z" />
        <rect x="484" y="54" width="3" height="12" />
        <path d="M508 110 v-16 q0 -10 8 -10 q8 0 8 10 v16 Z" />
        <rect x="530" y="76" width="42" height="34" />
        <rect x="542" y="68" width="6" height="8" />
        <rect x="576" y="84" width="36" height="26" />
        <rect x="616" y="70" width="30" height="40" />
        <rect x="624" y="62" width="5" height="8" />
        <rect x="650" y="80" width="30" height="30" />
      </g>
    </svg>
  );
}

function LondonSkyline() {
  return (
    <svg
      viewBox="0 0 680 110"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className="w-full h-full"
    >
      <g fill={FILL}>
        <rect x="0" y="55" width="34" height="55" />
        <rect x="38" y="35" width="26" height="75" />
        <rect x="42" y="26" width="8" height="10" />
        <rect x="70" y="62" width="40" height="48" />
        <path d="M118 110 V38 L138 12 L158 38 V110 Z" />
        <rect x="162" y="50" width="30" height="60" />
        <path d="M200 110 V52 Q200 20 222 16 Q244 20 244 52 V110 Z" />
        <rect x="250" y="42" width="22" height="68" />
        <rect x="276" y="66" width="46" height="44" />
        <rect x="328" y="30" width="30" height="80" />
        <rect x="336" y="20" width="6" height="12" />
        <rect x="362" y="58" width="36" height="52" />
        <path d="M404 110 V46 L420 34 L436 46 V110 Z" />
        <rect x="440" y="70" width="52" height="40" />
        <rect x="496" y="38" width="26" height="72" />
        <rect x="526" y="56" width="38" height="54" />
        <rect x="568" y="28" width="24" height="82" />
        <rect x="574" y="18" width="5" height="12" />
        <rect x="596" y="64" width="44" height="46" />
        <rect x="644" y="44" width="36" height="66" />
      </g>
    </svg>
  );
}

export function SkylineBackdrop() {
  const city = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <div
      aria-hidden="true"
      data-testid="skyline-backdrop"
      className="hidden dark:block absolute bottom-0 left-0 w-full h-[110px] pointer-events-none z-0 opacity-[0.65]"
    >
      {city === "paris" ? <ParisSkyline /> : <LondonSkyline />}
    </div>
  );
}
