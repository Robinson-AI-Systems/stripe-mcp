import { mergeNamespaces } from '../core/registry.js';
import * as server from './server.js';
import * as meta from './meta.js';
export const registry = mergeNamespaces([server,meta]);
