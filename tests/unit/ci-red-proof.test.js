// Temporary A-1 proof: CI must turn red on a deliberately failing assertion.
import { it, expect } from 'vitest';
it('intentionally proves the unit gate fails closed', () => expect(2).toBe(3));
