/** 3D geometry utilities */

const isAxisAlignedOverlap = (aMin, aMax, bMin, bMax) => aMin < bMax && aMax > bMin;

const packedItemsOverlap = (firstItem, secondItem) => {
  const firstMaxX = firstItem.position.x + firstItem.dimensions.length;
  const firstMaxY = firstItem.position.y + firstItem.dimensions.breadth;
  const firstMaxZ = firstItem.position.z + firstItem.dimensions.height;

  const secondMaxX = secondItem.position.x + secondItem.dimensions.length;
  const secondMaxY = secondItem.position.y + secondItem.dimensions.breadth;
  const secondMaxZ = secondItem.position.z + secondItem.dimensions.height;

  return (
    isAxisAlignedOverlap(firstItem.position.x, firstMaxX, secondItem.position.x, secondMaxX) &&
    isAxisAlignedOverlap(firstItem.position.y, firstMaxY, secondItem.position.y, secondMaxY) &&
    isAxisAlignedOverlap(firstItem.position.z, firstMaxZ, secondItem.position.z, secondMaxZ)
  );
};

const getSortedDimensions = (entity) => {
  const dims = [entity.length, entity.breadth, entity.height];
  return dims.sort((a, b) => a - b);
};

export { isAxisAlignedOverlap, packedItemsOverlap, getSortedDimensions };
