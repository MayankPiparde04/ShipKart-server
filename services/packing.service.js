/**
 * Packing Service - Thin wrapper around modular packing components
 * Provides backward compatibility for controllers while using modular architecture
 * 
 * Note: This was originally 1482 lines of duplicate code. 
 * All implementation now lives in /services/packing/ modular structure.
 */

// Import from modular structure
import { calculateOptimalPacking, Product, Carton, Position3D, PackedItem } from './packing/index.js';

// Re-export for backward compatibility with controllers
export { calculateOptimalPacking, Product, Carton, Position3D, PackedItem };
