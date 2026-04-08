export const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(100 + Math.random() * 900);
  return `ZL-${timestamp}${random}`;
};
