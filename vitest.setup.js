import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

// The plan provider autosaves to localStorage and restores on mount, so a test
// must never see what an earlier test saved. Storage may be stubbed to throw.
afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // A test replaced localStorage with one that throws; nothing to clear.
  }
});
