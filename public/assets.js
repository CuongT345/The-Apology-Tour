const AV = {
  mood:   { label: "Apology face", opts: [["sad","Remorseful"],["crying","Crying"],["smug","Not sorry"],["shocked","Shocked"],["fake","Forced smile"]] },
  skin:   { label: "Skin", colors: ["#f6d7bd","#ecbc93","#d39a6a","#a8714a","#7a4c30","#4e3020"] },
  hair:   { label: "Hair", opts: [["short","Short"],["long","Long"],["curly","Curly"],["bun","Bun"],["mohawk","Mohawk"],["bald","Bald"]] },
  hairColor: { label: "Hair color", colors: ["#1f1a17","#5a3825","#b5793f","#e6c36a","#d9d4cc","#e2557b","#4f8fe0","#6ad18f"] },
  outfit: { label: "Outfit", opts: [["hoodie","Grey-area hoodie"],["tee","Plain tee"],["blazer","Serious blazer"],["turtleneck","Turtleneck"]] },
  outfitColor: { label: "Outfit color", colors: ["#8a919c","#3a3f4a","#f2efe6","#c84b4b","#3f7a5a","#d9a441","#6d5bd0"] },
  extra:  { label: "Extras", opts: [["none","None"],["glasses","Glasses"],["shades","Sunglasses"],["beanie","Beanie"],["cap","Cap"],["headphones","Headphones"]] },
  bg:     { label: "Backdrop", colors: ["#ffd84d","#8fd3c1","#f4a6a6","#a9b8ff","#c9c2b3","#f7a35c"] }
};
const pick = a => a[Math.floor(Math.random() * a.length)];
function randAv() {
  const av = {};
  for (const k in AV) av[k] = AV[k].colors ? pick(AV[k].colors) : pick(AV[k].opts)[0];
  return av;
}
function avatarSVG(av, size, label) {
  const INK = "#2a2410", hc = av.hairColor, sk = av.skin, oc = av.outfitColor;
  const light = c => ["#f2efe6","#d9d4cc","#e6c36a","#d9a441"].includes(c);
  let back = "", hairTop = "", outfit = "", face = "", extra = "";
  const capHidesHair = av.extra === "beanie" || av.extra === "cap";
  // hair behind head
  if (av.hair === "long") back = `<rect x="25" y="28" width="50" height="46" rx="16" fill="${hc}"/>`;
  if (av.hair === "curly") back = [ [30,34],[70,34],[27,46],[73,46] ].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${hc}"/>`).join("");
  // outfit
  const torso = `<path d="M14 100 Q14 72 50 69 Q86 72 86 100 Z" fill="${oc}"/>`;
  if (av.outfit === "hoodie") outfit = `<path d="M26 78 Q50 62 74 78 Q66 70 50 69 Q34 70 26 78Z" fill="rgba(0,0,0,.18)"/>${torso}<path d="M34 72 Q50 86 66 72" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="3"/><line x1="44" y1="80" x2="44" y2="92" stroke="${light(oc) ? INK : "#f2efe6"}" stroke-width="1.6" stroke-linecap="round"/><line x1="56" y1="80" x2="56" y2="92" stroke="${light(oc) ? INK : "#f2efe6"}" stroke-width="1.6" stroke-linecap="round"/>`;
  else if (av.outfit === "blazer") outfit = `${torso}<path d="M42 70 L50 88 L58 70 Z" fill="#f2efe6"/><path d="M40 70 L50 100 L36 100 L30 76 Z M60 70 L50 100 L64 100 L70 76 Z" fill="rgba(0,0,0,.22)"/>`;
  else if (av.outfit === "turtleneck") outfit = `${torso}<rect x="40" y="62" width="20" height="12" rx="4" fill="${oc}"/><rect x="40" y="62" width="20" height="12" rx="4" fill="rgba(0,0,0,.12)"/>`;
  else outfit = `${torso}<path d="M42 70 Q50 77 58 70" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>`;
  // hair on top
  if (!capHidesHair || av.hair === "long") {
    if (av.hair === "short" || av.hair === "long" || av.hair === "bun") hairTop = `<path d="M27 44 Q26 19 50 19 Q74 19 73 44 Q68 30 50 30 Q34 30 27 44Z" fill="${hc}"/>`;
    if (av.hair === "bun") hairTop += `<circle cx="50" cy="15" r="8" fill="${hc}"/>`;
    if (av.hair === "curly") hairTop = [ [34,26],[44,20],[56,20],[66,26],[50,24] ].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${hc}"/>`).join("");
    if (av.hair === "mohawk") hairTop = `<path d="M44 26 Q46 8 50 6 Q54 8 56 26 Z" fill="${hc}"/>`;
    if (capHidesHair && av.hair === "long") hairTop = "";
  }
  // faces
  const eyes = (r = 2.3) => `<circle cx="42" cy="46" r="${r}" fill="${INK}"/><circle cx="58" cy="46" r="${r}" fill="${INK}"/>`;
  const sadBrows = `<path d="M36 41 L45 38 M55 38 L64 41" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  const blush = `<circle cx="36" cy="53" r="3.5" fill="#ff7b7b" opacity=".35"/><circle cx="64" cy="53" r="3.5" fill="#ff7b7b" opacity=".35"/>`;
  switch (av.mood) {
    case "crying": face = sadBrows + eyes() + `<path d="M41 50 Q39 56 41 60 Q43 56 41 50Z M59 50 Q57 56 59 60 Q61 56 59 50Z" fill="#5fb6ff"/><path d="M43 60 Q46 56 50 59 Q54 56 57 60" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` + blush; break;
    case "smug": face = `<path d="M37 40 L45 40 M55 37 L64 39" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M39 47 L45 47 M55 47 L61 47" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M44 57 Q52 60 58 53" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`; break;
    case "shocked": face = `<path d="M36 38 L45 36 M55 36 L64 38" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="42" cy="46" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="58" cy="46" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="42" cy="46" r="1.4" fill="${INK}"/><circle cx="58" cy="46" r="1.4" fill="${INK}"/><ellipse cx="50" cy="58" rx="3.6" ry="4.6" fill="${INK}"/>`; break;
    case "fake": face = `<path d="M38 47 Q42 43 46 47 M54 47 Q58 43 62 47" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M40 54 Q50 64 60 54 Z" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><line x1="50" y1="55" x2="50" y2="59" stroke="${INK}" stroke-width="1"/>` + blush; break;
    default: face = sadBrows + eyes() + `<path d="M43 59 Q50 54 57 59" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  }
  // extras
  if (av.extra === "glasses") extra = `<g fill="none" stroke="${INK}" stroke-width="1.8"><circle cx="42" cy="46" r="6"/><circle cx="58" cy="46" r="6"/><path d="M48 46 L52 46"/></g>`;
  if (av.extra === "shades") extra = `<g fill="#15161a"><rect x="34" y="41" width="14" height="9" rx="3"/><rect x="52" y="41" width="14" height="9" rx="3"/></g><path d="M48 44 L52 44" stroke="#15161a" stroke-width="2"/>`;
  if (av.extra === "beanie") extra = `<path d="M26 40 Q26 14 50 14 Q74 14 74 40 Z" fill="${oc === hc ? "#c84b4b" : oc}"/><path d="M26 40 Q26 14 50 14 Q74 14 74 40 Z" fill="rgba(0,0,0,.1)"/><rect x="24" y="34" width="52" height="9" rx="4.5" fill="${oc === hc ? "#c84b4b" : oc}"/><circle cx="50" cy="12" r="5" fill="#f2efe6"/>`;
  if (av.extra === "cap") extra = `<path d="M27 38 Q27 16 50 16 Q73 16 73 38 Z" fill="${oc}"/><path d="M27 38 Q27 16 50 16 Q73 16 73 38 Z" fill="rgba(0,0,0,.12)"/><path d="M50 36 L84 38 Q86 42 80 42 L50 41 Z" fill="${oc}"/>`;
  if (av.extra === "headphones") extra = `<path d="M26 48 Q26 16 50 16 Q74 16 74 48" fill="none" stroke="#15161a" stroke-width="4"/><rect x="21" y="42" width="9" height="15" rx="4" fill="#15161a"/><rect x="70" y="42" width="9" height="15" rx="4" fill="#15161a"/>`;
  const cid = "c" + Math.random().toString(36).slice(2, 9);
  return `<svg class="av" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(label || "Avatar")}">
    <defs><clipPath id="${cid}"><circle cx="50" cy="50" r="50"/></clipPath></defs>
    <circle cx="50" cy="50" r="50" fill="${av.bg}"/>
    <g clip-path="url(#${cid})">${back}${outfit}<rect x="44" y="60" width="12" height="12" rx="3" fill="${sk}"/><rect x="44" y="64" width="12" height="6" fill="rgba(0,0,0,.12)"/>
    <circle cx="28" cy="48" r="4.5" fill="${sk}"/><circle cx="72" cy="48" r="4.5" fill="${sk}"/>
    <circle cx="50" cy="45" r="22" fill="${sk}"/>${hairTop}${face}${extra}</g></svg>`;
}


const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
