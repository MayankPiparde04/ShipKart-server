/** Validation utilities for packing constraints */

import { getSortedDimensions } from './geometry.js';

const canFitInAnyOrientation = (product, carton) => {
  if (!product || !carton) return false;
  const productDims = getSortedDimensions(product);
  const cartonDims = getSortedDimensions(carton);
  return (
    productDims[0] <= cartonDims[0] &&
    productDims[1] <= cartonDims[1] &&
    productDims[2] <= cartonDims[2]
  );
};

const canFitProductInCarton = (product, carton) => {
  if (!product || !carton) return false;
  if (Number(product.weightPerUnitKg || 0) > Number(carton.maxWeight || 0)) return false;
  return canFitInAnyOrientation(product, carton);
};

export { canFitInAnyOrientation, canFitProductInCarton };

