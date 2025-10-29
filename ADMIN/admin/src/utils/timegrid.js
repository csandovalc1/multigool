function pad2(n){ return String(n).padStart(2,'0'); }
const toMin = (hhmm) => {
  const [h,m] = String(hhmm).split(':').map(Number);
  return h*60 + m;
};
const fromMin = (min) => `${pad2(Math.floor(min/60))}:${pad2(min%60)}`;

exports.buildDaySlots = (open='07:00', close='22:00', step=60) => {
  const o = toMin(open), c = toMin(close);
  const out = [];
  for (let cur=o; cur+step<=c; cur+=step) {
    out.push({
      inicio: fromMin(cur),
      fin: fromMin(cur+step)
    });
  }
  return out;
};