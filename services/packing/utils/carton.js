/** Carton sizing and costing utilities */

import { HANDLING_FEE_BY_SIZE } from './constants.js';

const getCartonSizeBucket = (carton) => {
  const volume = Number(carton?.volume || 0);
  if (volume <= 18000) return 'small';
  if (volume <= 60000) return 'medium';
  return 'large';
};

const getHandlingFeePerBox = (carton) => {
  const bucket = getCartonSizeBucket(carton);
  return HANDLING_FEE_BY_SIZE[bucket] || HANDLING_FEE_BY_SIZE.medium;
};

const getCartonVolume = (carton) => {
  if (!carton) return 0;
  const { length, breadth, height } = carton;
  return (Number(length) || 0) * (Number(breadth) || 0) * (Number(height) || 0);
};

const getLargestAvailableCarton = (cartons) => {
  if (!Array.isArray(cartons) || cartons.length === 0) return null;
  return cartons.reduce((largest, current) => {
    if ((Number(current.availableQuantity) || 0) <= 0) return largest;
    const currentVolume = getCartonVolume(current);
    const largestVolume = largest ? getCartonVolume(largest) : 0;
    return currentVolume > largestVolume ? current : largest;
  }, null);
};

export { getCartonSizeBucket, getHandlingFeePerBox, getCartonVolume, getLargestAvailableCarton };
