// Fichier calendrier .ics — compatible Google Agenda, Calendrier Apple et Outlook.
import { MEALS, type PlanResponse } from "../../../../shared/options";

type Plan = Extract<PlanResponse, { ok: true }>;

const MEAL_TIME: Record<string, [number, number, number]> = {
  dejeuner: [7, 30, 30],
  diner: [12, 0, 45],
  souper: [17, 30, 60],
};

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Les lignes de plus de 75 octets doivent être repliées (RFC 5545).
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function event(uid: string, start: Date, minutes: number, title: string, description: string): string[] {
  const end = new Date(start.getTime() + minutes * 60_000);
  return ["BEGIN:VEVENT", `UID:${uid}@gusto`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`, "END:VEVENT"];
}

export function buildIcs(plan: Plan, opts: { start: Date; shopping: boolean; meals: boolean }): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gusto//Menus//FR", "CALSCALE:GREGORIAN"];
  const id = plan.generatedAt.replace(/\W/g, "");

  plan.weeks.forEach((w, wi) => {
    const weekStart = new Date(opts.start);
    weekStart.setDate(weekStart.getDate() + wi * 7);

    if (opts.shopping) {
      const at = new Date(weekStart);
      at.setHours(9, 0, 0, 0);
      const items = [...w.list, ...w.pantry, ...w.specialty].map((i) => `☐ ${i.packages} × ${i.product} (${i.size})`).join("\n");
      lines.push(...event(`${id}-courses-${w.week}`, at, 60, `Épicerie — semaine ${w.week}`, items));
    }

    if (opts.meals) {
      for (const d of w.days) {
        for (const m of d.meals) {
          const r = plan.recipes[m.recipeId];
          const [h, min, dur] = MEAL_TIME[m.meal];
          const at = new Date(weekStart);
          at.setDate(at.getDate() + d.day - 1);
          at.setHours(h, min, 0, 0);
          const label = MEALS.find((x) => x.id === m.meal)?.label ?? m.meal;
          const body = [
            `${r.servings} portions`,
            "",
            "Ingrédients :",
            ...r.ingredients.map((i) => `• ${i.display}`),
            ...r.homemade.flatMap((h) => ["", `${h.name} maison :`, ...h.ingredients.map((x) => `• ${x}`), ...h.steps.map((s, i) => `${i + 1}. ${s}`)]),
            "",
            "Préparation :",
            ...r.steps.map((s, i) => `${i + 1}. ${s}`),
          ].join("\n");
          lines.push(...event(`${id}-${w.week}-${d.day}-${m.meal}`, at, dur, `${label} : ${r.name}`, body));
        }
      }
    }
  });

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
