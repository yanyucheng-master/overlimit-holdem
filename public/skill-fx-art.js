(function initSkillFxArt(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OverlimitSkillFxArt = api;
  if (root?.document) api.mountEndgame(root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSkillFxArt() {
  "use strict";

  // Geometry is authored locally. Only the vapor's alpha texture is raster art.
  // Recipes accept public, already-sanitized identity, never game/card data.
  const NS = "http://www.w3.org/2000/svg";
  let serial = 0;
  const group = (name, body, attrs = "") => {
    // Motion origin belongs to an outer group. An authored translate/rotate
    // must keep SVG's default origin or a mirrored blade drifts off the stage.
    if (attrs && ["fx-form", "fx-left", "fx-right", "fx-orbit", "fx-back", "fx-fragments"].includes(name)) {
      return '<g class="' + name + '"><g ' + attrs + ">" + body + "</g></g>";
    }
    return '<g class="' + name + '" ' + attrs + ">" + body + "</g>";
  };
  const path = (d, kind = "metal", attrs = "") => '<path class="fx-' + kind + '" d="' + d + '" ' + attrs + "/>";
  const edge = (d, attrs = "") => path(d, "edge", attrs);
  const thread = (d, attrs = "") => path(d, "thread", attrs);
  const shard = (x, y, width, height, angle = 0, name = "fx-piece") => group(name,
    path("M0 " + (-height / 2) + " L" + width / 2 + " -2 L0 " + height / 2 + " L" + -width / 2 + " 2Z", "crystal")
      + path("M0 " + (-height / 2) + " L0 " + height / 2 + " L" + -width / 2 + " 2Z", "facet")
      + edge("M0 " + -height / 2 + " L" + width / 2 + " -2 L0 " + height / 2),
    'transform="translate(' + x + " " + y + ") rotate(" + angle + ')"');
  const gem = (x = 120, y = 100, radius = 23) => group("fx-gem",
    path("M0 -" + radius + " L" + radius * .76 + " " + -radius * .48 + " L" + radius + " " + radius * .26
      + " L0 " + radius + " L" + -radius + " " + radius * .26 + " L" + -radius * .76 + " " + -radius * .48 + "Z", "crystal")
    + path("M0 -" + radius + " L0 " + radius + " L" + -radius + " " + radius * .26 + "Z", "facet")
    + edge("M0 -" + radius + " L" + radius * .76 + " " + -radius * .48 + " L0 " + radius + " M" + -radius * .76 + " " + -radius * .48 + " L" + radius + " " + radius * .26),
    'transform="translate(' + x + " " + y + ')"');
  const coin = (x, y, radius = 22) => group("fx-coin",
    '<ellipse class="fx-shadow" cx="2" cy="6" rx="' + radius + '" ry="' + radius * .74 + '"/>'
      + '<ellipse class="fx-metal" rx="' + radius + '" ry="' + radius * .74 + '"/>'
      + '<ellipse class="fx-thread" rx="' + radius * .74 + '" ry="' + radius * .52 + '"/>'
      + edge("M-8 0L0 -7L8 0L0 7Z") + thread("M-14 -6L-17 -8M14 6L17 8M-14 6L-17 8M14 -6L17 -8"),
    'transform="translate(' + x + " " + y + ')"');
  const leaf = (angle, radius = 63, name = "fx-petal") => group(name,
    path("M120 " + (100 - radius) + " C" + (138 + radius * .12) + " " + (109 - radius) + " 145 77 120 95 C102 78 105 " + (110 - radius) + " 120 " + (100 - radius) + "Z", "crystal")
      + thread("M120 " + (105 - radius) + "Q128 68 120 92"),
    'transform="rotate(' + angle + ' 120 100)"');
  const card = (x, y, angle = 0, name = "fx-card-piece") => group(name,
    path("M-20 -34Q-23 -34 -23 -30V30Q-23 34 -19 34H19Q23 34 23 30V-30Q23 -34 19 -34Z", "metal")
      + path("M-17 -27H17V27H-17Z", "shade")
      + thread("M-16 -25L16 25M16 -25L-16 25M-13 -26L17 15M-17 -15L13 26")
      + gem(0, 0, 10) + edge("M-20 -27V-30H-12M12 31H20V24"),
    'transform="translate(' + x + " " + y + ") rotate(" + angle + ')"');
  const blade = (name = "fx-blade", mirror = false) => group(name,
    path("M24 142C63 79 122 55 214 53C132 67 78 95 52 125L64 131L21 158L24 142Z", "crystal")
      + path("M24 142C89 74 145 62 214 53C131 70 74 101 21 158Z", "facet")
      + edge("M24 142C63 79 122 55 214 53"),
    mirror ? 'transform="translate(240 200) rotate(180)"' : "");
  const curls = () => group("fx-orbit",
    path("M21 101C9 45 97 7 160 39C198 59 192 109 147 121C174 99 178 73 151 57C107 29 32 60 21 101Z", "silk")
      + path("M219 111C220 165 145 189 86 164C52 149 49 111 77 88C65 116 75 139 102 146C153 162 205 146 219 111Z", "silk")
      + thread("M26 76C70 21 168 23 179 78M212 139C173 174 83 172 68 131"));
  const halo = () => group("fx-back",
    path("M37 97C39 47 88 17 139 24C183 30 211 60 207 105C195 63 177 45 136 40C92 34 57 52 37 97Z", "haze")
      + path("M204 110C193 162 125 182 77 153C59 141 44 128 40 108C62 137 91 144 124 142C164 142 187 129 204 110Z", "haze"));
  const lock = () => group("fx-form",
    path("M72 82L120 64L168 82L161 137L120 158L79 137Z")
      + path("M82 86L120 75L158 86L151 128L120 146L89 128Z", "shade")
      + path("M94 77V57C94 24 146 24 146 57V77L136 73V58C136 37 104 37 104 58V73Z", "crystal")
      + edge("M76 86L120 70L164 86M87 128L120 146L153 128")
      + path("M120 92A9 9 0 1 1 114 108L111 124H129L126 108A9 9 0 0 1 120 92Z", "void"));
  const shield = () => group("fx-form",
    path("M120 23C145 41 165 39 184 45C184 107 166 145 120 174C73 145 55 106 56 45C76 39 96 41 120 23Z", "crystal")
      + path("M120 23V174C73 145 55 106 56 45C76 39 96 41 120 23Z", "facet")
      + path("M120 42C139 52 153 54 166 57C163 103 150 130 120 151C91 130 77 103 74 57C89 54 104 52 120 42Z", "shade")
      + edge("M120 25C145 42 166 40 182 46M59 48C59 108 78 145 120 171")
      + thread("M120 49V136M91 81L120 104L149 81") + gem(120, 96, 15));
  const eye = (open = true) => group("fx-form",
    path("M27 104C60 62 95 43 125 48C163 48 190 68 214 101C179 133 148 149 115 145C79 143 46 125 27 104Z", "silk")
      + edge("M27 104C70 48 163 23 214 101M28 105C87 158 157 160 214 101")
      + path("M87 100A33 33 0 1 0 153 100A33 33 0 1 0 87 100Z", "crystal")
      + path(open ? "M119 70Q99 101 119 132Q137 103 119 70Z" : "M101 88L136 110L121 117Z", "void")
      + thread("M67 79L75 84M171 78L165 85M56 114L65 111M181 118L173 113")
      + path("M108 80Q122 73 130 84Q119 82 112 96Z", "glint"));
  const petals = (count, radius = 67) => Array.from({ length: count }, (_, i) => leaf(i * 360 / count, radius)).join("");
  const scatter = () => group("fx-fragments",
    shard(50, 59, 8, 18, -31) + shard(188, 50, 6, 16, 28) + shard(196, 148, 7, 19, 46)
      + shard(55, 155, 5, 14, -43) + shard(133, 24, 4, 11, 12));

  const RECIPES = Object.freeze({
    breath: { motion: "inhale", impact: "return", body: () => curls() + group("fx-form", gem(120, 100, 21)
      + path("M110 84Q120 73 130 84Q138 105 120 121Q101 105 110 84Z", "glint")) },
    recycle: { motion: "assemble", impact: "return", body: () => group("fx-orbit", petals(3, 82))
      + group("fx-form", gem(120, 100, 26)) + scatter() },
    intimidation: { motion: "press", impact: "pressure", body: () => halo() + group("fx-form",
      path("M42 65L78 86L91 43L119 73L147 33L160 85L201 57L179 122L120 154L61 122Z")
      + path("M60 89L78 106L95 78L119 96L145 72L154 108L180 85L168 122L120 142L73 122Z", "shade")
      + edge("M43 65L61 122L120 154L179 122L201 57") + gem(120, 113, 22)) },
    desperation: { motion: "ignite", impact: "flare", body: () => halo() + group("fx-form",
      shard(120, 76, 36, 111, 0) + shard(79, 123, 25, 92, -42) + shard(162, 123, 25, 92, 42)
      + path("M105 88L121 104L113 116L133 129", "void")) + scatter() },
    blood: { motion: "clash", impact: "flare", body: () => halo() + blade("fx-left") + blade("fx-right", true)
      + group("fx-form", coin(120, 101, 27) + gem(120, 100, 11)) },
    defense: { motion: "shield", impact: "shield", body: () => halo() + shield()
      + group("fx-orbit", edge("M43 63Q44 144 107 181M198 63Q195 140 137 181")) },
    perception: { motion: "read", impact: "scan", body: () => group("fx-orbit",
      path("M29 138C57 46 182 34 212 121C178 77 80 80 29 138Z", "silk")
      + thread("M22 150Q69 31 174 63M61 155Q123 53 213 123"))
      + group("fx-form", gem(120, 107, 17) + edge("M57 110Q116 91 183 105"))
      + group("fx-fragments", shard(58, 112, 6, 13, 35) + shard(181, 104, 6, 13, -35)) },
    intel: { motion: "iris", impact: "scan", body: () => group("fx-orbit", petals(6, 85))
      + group("fx-form", gem(120, 100, 29) + path("M114 79H126L123 116H117Z", "glint")) },
    "top-secret": { motion: "seal", impact: "lock", body: () => halo() + lock()
      + group("fx-left", path("M31 58L59 71L59 138L32 121Z", "crystal"))
      + group("fx-right", path("M209 58L181 71L181 138L208 121Z", "crystal")) },
    counter: { motion: "cut", impact: "fracture", body: () => group("fx-back",
      path("M56 49C106 79 135 109 180 155L163 163C114 117 93 85 51 65Z", "silk"))
      + blade("fx-form") + group("fx-fragments", shard(93, 97, 14, 36, -36) + shard(144, 112, 13, 35, -31)) },
    fairness: { motion: "balance", impact: "balance", body: () => halo() + group("fx-form",
      path("M117 37H123L128 136H149L155 149H85L91 136H112Z")
      + path("M59 61Q120 88 181 61L179 72Q121 99 61 72Z", "crystal")
      + edge("M69 72L45 115H92L69 72M171 72L148 115H195L171 72")
      + path("M43 115Q69 151 95 115Z") + path("M146 115Q171 151 197 115Z")
      + gem(120, 59, 11)) },
    cheat: { motion: "exchange", impact: "cards", body: () => curls()
      + card(90, 96, -18, "fx-left") + card(154, 106, 18, "fx-right")
      + group("fx-form", path("M69 55L98 47L94 59M171 143L143 152L145 139", "edge")) },
    "dead-end": { motion: "gate", impact: "lock", body: () => halo()
      + group("fx-left", path("M49 28L111 46V154L49 176L68 98Z") + path("M82 51L101 61V145L80 151L91 98Z", "crystal"))
      + group("fx-right", path("M191 28L129 46V154L191 176L172 98Z") + path("M158 51L139 61V145L160 151L149 98Z", "crystal"))
      + group("fx-form", gem(120, 101, 17) + thread("M117 41L124 57L117 74M121 127L115 143L122 159")) },
    clairvoyance: { motion: "eye", impact: "scan", body: () => halo() + eye()
      + group("fx-orbit", path("M45 47Q84 3 133 25L114 31Q84 30 45 47Z", "silk")
        + path("M180 160Q146 187 98 171L119 166Q151 169 180 160Z", "silk")) },
    nullification: { motion: "collapse", impact: "collapse", body: () => curls()
      + group("fx-form", path("M81 96A39 39 0 1 0 159 96A39 39 0 1 0 81 96Z", "void")
        + path("M73 107C54 64 99 23 135 41L124 52C99 46 70 71 73 107Z", "crystal")
        + path("M166 74C194 115 146 158 110 145L126 133C154 131 171 100 166 74Z", "crystal"))
      + scatter() },
    fortune: { motion: "converge", impact: "flare", body: () => group("fx-orbit",
      path("M27 43Q81 123 118 98Q91 125 53 83Z", "silk")
        + path("M211 40Q179 121 123 104Q173 121 185 64Z", "silk")
        + path("M61 173Q98 143 120 100Q111 154 78 183Z", "silk"))
      + group("fx-form", petals(4, 49) + gem(120, 100, 20)) },
    destiny: { motion: "crown", impact: "lock", body: () => halo() + group("fx-orbit", petals(5, 83))
      + group("fx-form", path("M81 102L100 115L120 77L140 115L160 102L149 145H91Z")
        + path("M98 132H142V143H98Z", "crystal") + gem(120, 92, 12))
      + group("fx-fragments", shard(120, 22, 8, 20) + shard(53, 64, 5, 15, -51) + shard(187, 64, 5, 15, 51)) },
    loan: { motion: "transfer", impact: "return", body: (variant) => curls()
      + group("fx-left", variant === "energy" ? gem(80, 92, 21) : coin(78, 94, 27))
      + group("fx-right", variant === "energy" ? gem(159, 108, 26) : coin(160, 111, 31))
      + group("fx-form", edge("M104 111Q119 119 139 98M132 98L139 98L138 106")) },
    alert: { motion: "pulse", impact: "scan", body: () => group("fx-form",
      path("M158 39C111 17 62 54 70 103C76 145 114 165 153 149C122 149 97 125 96 98C95 69 119 43 158 39Z", "crystal")
      + gem(133, 97, 11)) + group("fx-orbit", edge("M154 62Q179 92 163 123M173 46Q213 97 182 146")) },
    retreat: { motion: "return", impact: "return", body: () => group("fx-orbit",
      path("M200 50C174 36 110 38 80 77C59 108 86 144 123 142L120 160C65 162 25 112 61 67C95 22 164 13 201 37Z", "silk")
      + path("M132 126L109 147L131 168L125 149Z", "crystal"))
      + group("fx-form", coin(155, 91, 30) + coin(164, 121, 25)) },
    restart: { motion: "shuffle", impact: "cards", body: () => curls()
      + card(82, 101, -23, "fx-left") + card(158, 101, 23, "fx-right") + card(120, 94, 0, "fx-form") },
    probe: { motion: "probe", impact: "pressure", body: () => group("fx-orbit",
      path("M50 137Q23 73 91 41C61 68 64 99 84 111Z", "silk"))
      + group("fx-form", path("M59 150L166 43L157 79L182 71L82 152L90 134Z", "crystal")
        + edge("M61 148L162 48") + gem(148, 91, 11)) },
    disguise: { motion: "veil", impact: "veil", body: () => curls()
      + group("fx-left", path("M41 62Q84 40 128 73L111 133Q62 146 41 62Z")
        + path("M54 74Q73 64 91 80Q78 98 63 88Z", "void") + thread("M69 115Q88 108 100 115"))
      + group("fx-right", path("M114 74Q157 35 201 58Q190 144 139 137Z", "crystal")
        + path("M148 82Q163 66 185 74L176 90Q163 99 148 82Z", "void") + thread("M149 118Q164 110 179 115")) },
    result: { motion: "result", impact: "result", body: () => group("fx-form",
      path("M64 98L99 130L172 59L184 72L101 151L52 110Z", "crystal")
      + edge("M63 99L100 135L177 65")) },
    protocol: { motion: "award", impact: "award", body: (_, key) => protocolBody(key) },
  });

  const PROTOCOLS = Object.freeze({
    PROTOCOL_HIGH_CARD: [1], PROTOCOL_PAIR: [2], PROTOCOL_TWO_PAIR: [2, 2],
    PROTOCOL_TRIPS: [3], PROTOCOL_STRAIGHT: [1, 1, 1, 1, 1], PROTOCOL_FLUSH: [5],
    PROTOCOL_FULL_HOUSE: [3, 2], PROTOCOL_QUADS: [4], PROTOCOL_STRAIGHT_FLUSH: [5],
  });
  function protocolBody(key) {
    const groups = PROTOCOLS[key] || [2];
    const count = groups.reduce((sum, number) => sum + number, 0);
    let emblems = "";
    if (key === "PROTOCOL_FLUSH" || key === "PROTOCOL_STRAIGHT_FLUSH") {
      emblems = petals(5, 72);
      if (key === "PROTOCOL_STRAIGHT_FLUSH") emblems += path("M94 72L106 87L120 51L136 87L148 71L143 104H99Z", "metal");
    } else {
      for (let i = 0; i < count; i++) {
        const gap = groups.length === 2 && i >= groups[0] ? 10 : 0;
        const x = 120 + (i - (count - 1) / 2) * 24 + gap - (groups.length === 2 ? 5 : 0);
        const h = key === "PROTOCOL_STRAIGHT" ? 43 + i * 10 : 62;
        emblems += shard(x, 101 - (h - 62) / 2, 21, h, (i - (count - 1) / 2) * 3);
      }
    }
    return halo() + group("fx-form", path("M57 120Q77 164 120 170Q163 164 183 120L165 132Q144 152 120 156Q96 152 75 132Z")
      + emblems + edge("M76 143Q120 176 164 143"));
  }
  function recipeFor(family, skillId) {
    // Unknown identities get the same neutral confirmation, never a private fallback.
    const safeFamily = Object.hasOwn(RECIPES, family) ? family : "result";
    const key = safeFamily === "protocol" && Object.hasOwn(PROTOCOLS, skillId) ? skillId : safeFamily;
    return { ...RECIPES[safeFamily], key, family: safeFamily };
  }
  function defs(id) {
    return '<defs><linearGradient id="' + id + '-metal" x1="0" y1="0" x2=".85" y2="1">'
      + '<stop class="fx-stop-light" offset="0"/><stop class="fx-stop-accent" offset=".19"/>'
      + '<stop class="fx-stop-dark" offset=".49"/><stop class="fx-stop-secondary" offset=".74"/><stop class="fx-stop-dark" offset="1"/></linearGradient>'
      + '<linearGradient id="' + id + '-crystal" x1=".1" y1="0" x2=".85" y2="1">'
      + '<stop class="fx-stop-light" offset="0" stop-opacity=".86"/><stop class="fx-stop-accent" offset=".32" stop-opacity=".55"/>'
      + '<stop class="fx-stop-secondary" offset=".78" stop-opacity=".28"/><stop class="fx-stop-accent" offset="1" stop-opacity=".72"/></linearGradient>'
      + '<linearGradient id="' + id + '-silk" x1="0" y1=".9" x2="1" y2=".1">'
      + '<stop class="fx-stop-secondary" offset="0" stop-opacity="0"/><stop class="fx-stop-accent" offset=".42" stop-opacity=".2"/>'
      + '<stop class="fx-stop-light" offset=".68" stop-opacity=".68"/><stop class="fx-stop-accent" offset="1" stop-opacity="0"/></linearGradient>'
      + '<radialGradient id="' + id + '-haze"><stop class="fx-stop-accent" stop-opacity=".32"/>'
      + '<stop class="fx-stop-secondary" offset=".7" stop-opacity=".14"/><stop class="fx-stop-secondary" offset="1" stop-opacity="0"/></radialGradient></defs>';
  }
  function svg(body, className) {
    const id = "fxm-" + ++serial;
    const node = document.createElementNS(NS, "svg");
    node.setAttribute("viewBox", "0 0 240 200");
    node.setAttribute("class", className);
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("focusable", "false");
    node.style.setProperty("--fx-metal-fill", "url(#" + id + "-metal)");
    node.style.setProperty("--fx-crystal-fill", "url(#" + id + "-crystal)");
    node.style.setProperty("--fx-silk-fill", "url(#" + id + "-silk)");
    node.style.setProperty("--fx-haze-fill", "url(#" + id + "-haze)");
    node.innerHTML = defs(id) + body;
    return node;
  }
  function createCore({ family, skillId, variant = "default", status = "success" }) {
    const recipe = recipeFor(family, skillId);
    const node = document.createElement("div");
    node.className = "fx-art";
    node.dataset.artKey = recipe.key;
    node.dataset.motion = recipe.motion;
    if (recipe.family !== "result") {
      const vapor = document.createElement("i");
      vapor.className = "fx-vapor";
      node.appendChild(vapor);
    }
    const failed = ["failed", "countered"].includes(status);
    const body = failed && recipe.family === "result"
      ? group("fx-form", blade() + shard(92, 84, 12, 32, -32) + shard(153, 119, 10, 30, 38))
      : recipe.body(variant, recipe.key);
    node.appendChild(svg(body, "fx-art-svg"));
    return node;
  }

  const IMPACTS = {
    return: () => path("M18 133C62 150 103 144 118 113C119 140 88 166 51 158Z", "silk")
      + path("M222 133C182 148 148 146 125 115C128 145 160 166 194 158Z", "silk")
      + shard(82, 150, 5, 12, 65) + shard(161, 150, 5, 12, -65),
    shield: () => path("M27 41L39 47Q36 139 120 180Q204 139 201 47L213 41Q221 149 120 193Q19 149 27 41Z", "crystal")
      + edge("M39 64Q43 137 106 168M201 64Q197 137 134 168"),
    pressure: () => path("M17 62L43 74L33 128L61 150L24 140Z", "crystal")
      + path("M223 62L197 74L207 128L179 150L216 140Z", "crystal"),
    flare: () => shard(25, 43, 9, 40, -35) + shard(214, 40, 8, 31, 31)
      + shard(24, 155, 8, 30, 35) + shard(216, 152, 8, 40, -31)
      + path("M41 163Q118 180 197 159Q132 204 41 163Z", "silk"),
    fracture: () => path("M8 148Q86 107 233 48Q92 127 28 175Z", "silk")
      + shard(40, 80, 10, 30, -34) + shard(194, 143, 11, 34, -36),
    collapse: () => group("fx-collapse-fragments", shard(25, 46, 11, 36, -39)
      + shard(213, 65, 8, 29, 32) + shard(55, 158, 7, 28, 29) + shard(196, 151, 11, 34, -39)),
    lock: () => path("M20 33L44 28L39 48L28 55V145L42 155L39 176L17 163Z")
      + path("M220 33L196 28L201 48L212 55V145L198 155L201 176L223 163Z")
      + gem(120, 181, 11),
    scan: () => edge("M12 128Q65 160 122 151Q187 144 228 116")
      + path("M15 131Q109 182 226 120Q153 180 56 163Z", "silk"),
    balance: () => path("M11 72L30 86V139L19 148Z", "crystal")
      + path("M229 72L210 86V139L221 148Z", "crystal") + edge("M36 162Q120 178 204 162"),
    cards: () => path("M26 22L43 17L43 30L33 34V161L46 168L43 179L23 172Z", "crystal")
      + path("M212 30L199 23L199 35L209 40V160L195 169L199 180L219 171Z", "crystal"),
    veil: () => path("M18 28Q50 48 34 109Q21 158 54 182Q3 174 13 107Q24 55 18 28Z", "silk")
      + path("M219 20Q190 56 213 104Q236 158 195 182Q239 136 215 106Q186 63 219 20Z", "silk"),
    award: () => path("M17 102Q52 171 120 187Q188 171 223 102L202 121Q170 158 120 171Q70 158 38 121Z")
      + shard(120, 182, 11, 26),
    result: () => path("M94 170L112 183L146 157L153 165L112 197L87 178Z", "crystal"),
  };
  function createImpact({ family, skillId, status = "success" }) {
    const recipe = recipeFor(family, skillId);
    const impactKey = status === "countered" ? "fracture" : status === "failed" ? "collapse" : recipe.impact;
    const node = svg(group("fx-impact-form", (IMPACTS[impactKey] || IMPACTS.result)()), "fx-impact-art");
    node.setAttribute("preserveAspectRatio", "none");
    node.dataset.impactArt = impactKey;
    return node;
  }
  function createRoute() {
    const node = svg(path("M0 102Q116 20 240 102Q119 48 0 102Z", "silk")
      + edge("M0 102Q116 33 240 102"), "fx-route-art");
    node.setAttribute("viewBox", "0 0 240 140");
    node.setAttribute("preserveAspectRatio", "none");
    return node;
  }
  function createEndgame(execution = false) {
    const body = execution
      ? group("fx-execution-blade", blade() + path("M30 172Q105 129 213 46Q132 154 30 172Z", "silk")) + scatter()
      : halo() + group("fx-orbit", petals(8, 91))
        + group("fx-form", path("M56 72L83 93L95 51L120 80L146 48L158 92L185 69L168 134L120 158L73 134Z")
          + path("M79 111L120 129L162 110L157 129L120 146L84 129Z", "crystal")
          + gem(120, 108, 17)) + scatter();
    const node = document.createElement("div");
    node.className = "fx-endgame-art";
    node.dataset.cinematic = execution ? "execution" : "declare";
    const mist = document.createElement("i");
    mist.className = "fx-vapor";
    node.append(mist, svg(body, "fx-art-svg"));
    return node;
  }
  function mountEndgame(scope = document) {
    scope.querySelectorAll(".endgame-fx").forEach((node) => {
      if (node.querySelector(".fx-endgame-art")) return;
      node.appendChild(createEndgame(node.classList.contains("endgame-kill")));
    });
  }
  return Object.freeze({ RECIPES, PROTOCOLS, recipeFor, createCore, createImpact, createRoute, createEndgame, mountEndgame });
});
