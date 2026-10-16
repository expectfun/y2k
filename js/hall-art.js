// Rough hall art for the display cases: small inline SVGs, one per exhibit.

function abacus() {
  const rows = [3, 7, 0, 5, 10, 2];
  let beads = '';
  rows.forEach((n, r) => {
    const y = 18 + r * 12;
    beads += `<line x1="9" y1="${y}" x2="111" y2="${y}" stroke="#4a4038" stroke-width="1.4"/>`;
    for (let b = 0; b < 10; b++) {
      const x = b < n ? 14 + b * 8.4 : 106 - (9 - b) * 8.4;
      const dark = b === 4 || b === 5;
      beads += `<ellipse cx="${x.toFixed(1)}" cy="${y}" rx="4" ry="5.2" fill="${dark ? '#2a2420' : '#d9bb7d'}" stroke="${dark ? '#000' : '#8a6a30'}" stroke-width=".8"/>`;
    }
  });
  return `<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg">${beads}
    <rect x="4.5" y="4.5" width="111" height="87" rx="4" fill="none" stroke="#7a5030" stroke-width="7"/></svg>`;
}

function phone() {
  let keys = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) keys += `<ellipse cx="${20 + c * 12}" cy="${68 + r * 11}" rx="4.6" ry="3.6" fill="#d9dee5"/>`;
  }
  return `<svg viewBox="0 0 64 120" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="3" width="52" height="114" rx="20" fill="#2f3b4d"/>
    <rect x="25" y="9" width="14" height="2.4" rx="1.2" fill="#151b24"/>
    <rect x="13" y="16" width="38" height="29" rx="4" fill="#0f141b"/>
    <rect x="16" y="19" width="32" height="23" rx="1" fill="#a6c37b"/>
    <rect x="18" y="22" width="9" height="2" fill="#1e2a14"/><rect x="38" y="22" width="8" height="2" fill="#1e2a14"/>
    <rect x="18" y="27" width="24" height="2" fill="#1e2a14"/><rect x="18" y="31" width="18" height="2" fill="#1e2a14"/>
    <rect x="18" y="37" width="8" height="2" fill="#1e2a14"/><rect x="38" y="37" width="8" height="2" fill="#1e2a14"/>
    <rect x="13" y="51" width="13" height="5" rx="2.5" fill="#b9c2cd"/><rect x="38" y="51" width="13" height="5" rx="2.5" fill="#b9c2cd"/>
    <circle cx="32" cy="54" r="4" fill="#b9c2cd"/>${keys}</svg>`;
}

function dialup() {
  let leds = '';
  for (let i = 0; i < 7; i++) leds += `<circle cx="${46 + i * 8}" cy="103" r="1.8" fill="${[2, 3, 5].includes(i) ? '#ff4433' : '#6a2a22'}"/>`;
  return `<svg viewBox="0 0 140 112" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="3" width="100" height="78" rx="8" fill="#ddd5c3" stroke="#b8ae98" stroke-width="2"/>
    <rect x="30" y="11" width="80" height="58" rx="3" fill="#2f7f7c"/>
    <rect x="42" y="17" width="62" height="44" fill="#c3c3c3"/>
    <rect x="42" y="17" width="62" height="6" fill="#0a246a"/>
    <rect x="45" y="27" width="56" height="31" fill="#fff"/>
    <rect x="48" y="31" width="30" height="2" fill="#000"/><rect x="48" y="36" width="44" height="2" fill="#777"/>
    <rect x="48" y="41" width="38" height="2" fill="#777"/><rect x="48" y="46" width="41" height="2" fill="#777"/>
    <rect x="33" y="44" width="6" height="6" fill="#fff" opacity=".85"/>
    <path d="M55 81h30l6 9H49z" fill="#cfc6b2"/>
    <rect x="34" y="96" width="72" height="13" rx="3" fill="#e6dfcf" stroke="#b8ae98"/>${leds}</svg>`;
}

export const HALL_ART = { abacus: abacus(), phone: phone(), dialup: dialup() };
