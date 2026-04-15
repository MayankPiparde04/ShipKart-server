/** Export all utilities */
import { clamp, toFixedNumber, safeSum } from './numbers.js';
import { isAxisAlignedOverlap, packedItemsOverlap, getSortedDimensions } from './geometry.js';
import { HANDLING_FEE_BY_SIZE, FRAGILE_HANDLING_SURCHARGE } from './constants.js';
import { getCartonSizeBucket, getHandlingFeePerBox, getCartonVolume, getLargestAvailableCarton } from './carton.js';
import { canFitInAnyOrientation, canFitProductInCarton } from './validation.js';

export {
  clamp,
  toFixedNumber,
  safeSum,
  isAxisAlignedOverlap,
  packedItemsOverlap,
  getSortedDimensions,
  HANDLING_FEE_BY_SIZE,
  FRAGILE_HANDLING_SURCHARGE,
  getCartonSizeBucket,
  getHandlingFeePerBox,
  getCartonVolume,
  getLargestAvailableCarton,
  canFitInAnyOrientation,
  canFitProductInCarton,
};
