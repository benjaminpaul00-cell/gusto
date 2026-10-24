// Gabarit HTML unique pour le PDF : utilisé sur le web (impression) et sur mobile (expo-print).
// Identité Gusto : cobalt, citron, rose, marine ; logo « mon gusto » chargé depuis le site.
import { MEALS, STORES, type ListItem, type PlanResponse } from "../../../../shared/options";

type Plan = Extract<PlanResponse, { ok: true }>;
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const money = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const SITE = (process.env.EXPO_PUBLIC_SITE_URL || "https://mongusto.ca").replace(/\/$/, "");
const LOGO = `<img class="logo" src="${SITE}/logo.png" alt="mon gusto">`;

export function buildPdfHtml(plan: Plan, opts: { list: boolean; recipes: boolean }): string {
  const storeName = (id: string) => STORES.find((s) => s.id === id)?.label ?? id;
  const names = (plan.request.stores?.length ? plan.request.stores : [plan.request.store]).map(storeName);
  const store = names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0];
  const people = `${plan.request.people} personne${plan.request.people > 1 ? "s" : ""}`;
  const weeks = `${plan.weeks.length} semaine${plan.weeks.length > 1 ? "s" : ""}`;
  const parts: string[] = [];

  parts.push(`<header>
    ${LOGO}
    <div class="head">
      <div><p class="eyebrow">Ton menu</p><h1>${esc(store)}</h1><p class="sub">${people} · ${weeks}</p></div>
      <div class="tag"><span class="hole"></span><div><b>${money(plan.total)}</b><small>sur un budget de ${money(plan.request.budget)}</small></div></div>
    </div>
  </header>`);
  if (plan.notices?.length) parts.push(`<div class="notice">${plan.notices.map((n) => `<p>${esc(n)}</p>`).join("")}</div>`);

  const rows = (items: ListItem[]) => {
    let section = "";
    return items.map((i) => {
      const head = i.section !== section ? `<tr class="sec"><td colspan="3">${esc((section = i.section))}</td></tr>` : "";
      const badges = `${i.discounted ? '<span class="b sale">rabais</span>' : ""}${i.estimated ? '<span class="b est">prix estimé</span>' : ""}`;
      return `${head}<tr><td class="box"><span></span></td><td>${i.packages} × ${esc(i.product)} <small>${esc(i.size)}</small>${badges}</td><td class="r">${money(i.total)}</td></tr>`;
    }).join("");
  };

  if (opts.recipes) {
    const menu = plan.weeks.map((w) => `${plan.weeks.length > 1 ? `<h3>Semaine ${w.week}</h3>` : ""}<table class="menu">${w.days.map((d) => `<tr><td class="day">${DAYS[d.day - 1]}</td><td>${d.meals.map((m) => `<span class="meal">${MEALS.find((x) => x.id === m.meal)?.label}</span> ${esc(plan.recipes[m.recipeId].name)}`).join("<br>")}</td></tr>`).join("")}</table>`).join("");
    parts.push(`<section class="block"><h2>Le menu</h2>${menu}</section>`);
  }

  if (opts.list) {
    for (const w of plan.weeks) {
      parts.push(`<section class="block page"><h2>Liste d’épicerie${plan.weeks.length > 1 ? ` · semaine ${w.week}` : ""} <span class="sum">${money(w.total)}</span></h2>
        ${w.estimated ? '<p class="note">Estimation au prix régulier : les rabais de cette semaine ne sont pas encore publiés.</p>' : ""}
        ${(() => {
          // Plusieurs épiceries : une liste par magasin, avec son sous-total
          const used = STORES.map((x) => x.id as string).filter((id) => w.list.some((i) => i.store === id));
          if (used.length <= 1) return `<table class="list">${rows(w.list)}</table>`;
          return used.map((id) => {
            const items = w.list.filter((i) => i.store === id);
            return `<h3>Chez ${esc(storeName(id))} · ${money(items.reduce((n, i) => n + i.total, 0))}</h3><table class="list">${rows(items)}</table>`;
          }).join("");
        })()}
        ${w.pantry.length ? `<h3>À vérifier dans ton garde-manger</h3><p class="note">${w.pantryIncluded === false ? "Non inclus dans le total : on suppose que tu les as déjà." : "Déjà inclus dans le total. Retire ce que tu as déjà."}</p><table class="list">${rows(w.pantry)}</table>` : ""}
        ${w.specialty.length ? `<h3>À acheter dans une épicerie spécialisée</h3><p class="note">Prix maximal estimé.</p><table class="list">${rows(w.specialty)}</table>` : ""}
      </section>`);
    }
  }

  if (opts.recipes) {
    const order: string[] = [];
    for (const w of plan.weeks) for (const d of w.days) for (const m of d.meals) if (!order.includes(m.recipeId)) order.push(m.recipeId);
    for (const id of order) {
      const r = plan.recipes[id];
      parts.push(`<article>
        ${r.image ? `<img src="${esc(r.image)}" alt="">` : ""}
        <p class="eyebrow">${esc(MEALS.find((m) => m.id === r.meal)?.label ?? "")}</p>
        <h2>${esc(r.name)}</h2>
        <p class="sub">${r.servings} portions · ${Math.round(r.kcal)} kcal et ${Math.round(r.protein)} g de protéines par portion · ${money(r.costPerPortion)} par portion</p>
        <div class="cols">
          <div><h3>Ingrédients</h3><ul>${r.ingredients.map((i) => `<li>${esc(i.display)}</li>`).join("")}</ul></div>
          <div><h3>Préparation</h3><ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
        </div>
        ${r.homemade.map((h) => `<div class="tip"><h3>${esc(h.name)} maison</h3><ul>${h.ingredients.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><ol>${h.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>`).join("")}
        ${r.specialty.map((s) => `<p class="note">${esc(s.name)} : à trouver dans une ${esc(s.where)}, environ ${money(s.priceMax)} au maximum.</p>`).join("")}
      </article>`);
    }
  }

  parts.push(`<footer>Prix indicatifs fournis par épiceries.ca, basés sur les prix en ligne de la bannière ; ils peuvent varier selon la succursale. Recettes et images générées par IA. gusto</footer>`);

  return `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><title>Gusto · ${esc(store)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
  @page{margin:14mm}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:"Plus Jakarta Sans",-apple-system,"Segoe UI",Roboto,sans-serif;color:#0E1030;font-size:10.5pt;line-height:1.5;margin:0}
  .logo{height:56px;width:auto}
  header{border-bottom:3px solid #0E1030;padding-bottom:14px;margin-bottom:8px}
  .head{display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px}
  h1{font-size:28pt;line-height:1.05;margin:2px 0 0;font-weight:800;letter-spacing:-1px}
  h2{font-size:16pt;margin:22px 0 8px;font-weight:800;letter-spacing:-.4px;display:flex;justify-content:space-between;align-items:baseline}
  h3{font-size:10.5pt;margin:14px 0 4px;font-weight:800;color:#2B44FF;text-transform:uppercase;letter-spacing:.6px}
  .eyebrow{display:inline-block;margin:0;font-size:8.5pt;font-weight:800;text-transform:uppercase;letter-spacing:1px;background:#FF5FA2;border:1.5px solid #0E1030;border-radius:99px;padding:1px 8px}
  .sub{margin:4px 0 0;color:#585D82}
  .tag{display:flex;align-items:center;gap:10px;background:#FFE14D;border:2px solid #0E1030;border-radius:10px;padding:8px 14px;box-shadow:4px 4px 0 #0E1030;transform:rotate(-2deg)}
  .tag b{display:block;font-size:20pt;font-weight:800;letter-spacing:-.5px;line-height:1.1}.tag small{font-size:8.5pt;font-weight:600}
  .hole{width:10px;height:10px;border-radius:50%;background:#FF5FA2;border:2px solid #0E1030}
  .sum{background:#FFE14D;border:2px solid #0E1030;border-radius:8px;padding:0 8px;font-size:13pt}
  table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px solid #E2E4F4;vertical-align:top}
  td.r{text-align:right;white-space:nowrap;font-weight:600}td.box{width:20px}td.box span{display:inline-block;width:11px;height:11px;border:1.5px solid #0E1030;border-radius:3px;margin-top:3px}
  tr.sec td{font-weight:800;padding-top:12px;border:0;color:#2B44FF;font-size:9pt;text-transform:uppercase;letter-spacing:.6px}
  table.menu td{padding:6px 0}td.day{width:95px;font-weight:800}.meal{font-size:8.5pt;font-weight:800;color:#2B44FF;text-transform:uppercase;margin-right:4px}
  small{color:#585D82}.b{font-size:7.5pt;font-weight:800;border-radius:99px;padding:0 6px;margin-left:6px;border:1px solid #0E1030}
  .sale{background:#FF5FA2}.est{background:#F3F4FF}
  .note{color:#585D82;font-size:9pt;margin:2px 0}
  .page{break-before:page}
  article{break-before:page}article img{width:100%;max-height:240px;object-fit:cover;border-radius:12px;border:2px solid #0E1030;margin-bottom:10px}
  article h2{font-size:20pt;margin:6px 0 0}
  .cols{display:grid;grid-template-columns:1fr 1.6fr;gap:22px}ul,ol{padding-left:18px;margin:4px 0}li{margin:2px 0}
  .tip{background:#FFF7CC;border:2px solid #0E1030;border-radius:10px;padding:4px 14px 8px;margin-top:12px}
  .notice{background:#FFF7CC;border:2px solid #0E1030;border-radius:10px;padding:6px 14px;margin:12px 0}.notice p{margin:4px 0;font-size:9.5pt}
  footer{margin-top:28px;padding-top:10px;border-top:1px solid #E2E4F4;color:#585D82;font-size:8.5pt}
  </style></head><body>${parts.join("\n")}</body></html>`;
}
