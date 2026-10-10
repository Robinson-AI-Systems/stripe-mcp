import { mergeNamespaces } from '../core/registry.js';
import * as server from './server.js';
import * as meta from './meta.js';
import * as customers from './customers.js';
import * as customerWrites from './customer-writes.js';
import * as paymentReads from './payments.js';
export const registry = mergeNamespaces([server,meta,customers,customerWrites,paymentReads]);
