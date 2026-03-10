// Backward compatibility layer - re-exports from unified-custom-sdk.js
// This file is kept for backward compatibility. All functionality has been merged into unified-custom-sdk.js
// New code should import directly from unified-custom-sdk.js

export {
  UnifiedEntity as CustomEntity,
  UnifiedUserEntity as UserEntity,
  createCustomClient,
  createClientFromRequest,
  setRequestAuthToken,
  clearRequestAuthToken,
  createUnifiedClient,
  customClient
} from './unified-custom-sdk.js';

// Re-export default
export { default } from './unified-custom-sdk.js';
