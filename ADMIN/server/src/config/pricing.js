// Precio por hora de la reserva, en Quetzales
const PRICE_PER_HOUR = { F5: 125, F7: 200 };

const getPricePerHour = (tipo) =>
  PRICE_PER_HOUR[String(tipo || '').toUpperCase()] ?? PRICE_PER_HOUR.F5;

module.exports = { PRICE_PER_HOUR, getPricePerHour };