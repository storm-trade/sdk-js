// Buffer polyfill
import { Buffer as BufferPolyfill } from 'buffer';

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Buffer = window.Buffer || BufferPolyfill;

  // Add other polyfills needed for TON libraries
  window.process = window.process || { env: {} };
}
