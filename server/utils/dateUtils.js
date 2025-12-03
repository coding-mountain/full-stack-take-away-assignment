const isValidDateStr = (token) => {
  if (!/^\d{8}$/.test(token)) return false;
  const year = parseInt(token.substring(0, 4));
  const month = parseInt(token.substring(4, 6));
  const day = parseInt(token.substring(6, 8));
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
};

const parseDateStr = (token) => {
  const year = token.substring(0, 4);
  const month = token.substring(4, 6);
  const day = token.substring(6, 8);
  return new Date(`${year}-${month}-${day}`);
};

module.exports = {
  isValidDateStr,
  parseDateStr,
};
