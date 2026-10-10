import { mergeNamespaces } from '../core/registry.js';
// A-1 intentionally has no Stripe tools. A-5 registers the first real tools.
export const registry = mergeNamespaces([]);
