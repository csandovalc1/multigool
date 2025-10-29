export function monthMatrix(year, month /* 0-based */) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  const startDay = (first.getDay() + 6) % 7 // Monday=0
  start.setDate(first.getDate() - startDay)
  const grid = []
  for (let w = 0; w < 6; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(start))
      start.setDate(start.getDate() + 1)
    }
    grid.push(week)
  }
  return grid
}
