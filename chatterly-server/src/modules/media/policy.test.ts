import { describe, expect, it } from 'vitest';
import { validateMediaUpload } from './policy';

describe('media policy', () => {
  it('accepts jpeg within size limit', () => {
    expect(validateMediaUpload('image', 'image/jpeg', 5 * 1024 * 1024)).toBeNull();
  });

  it('rejects image exceeding 16MB', () => {
    expect(validateMediaUpload('image', 'image/jpeg', 17 * 1024 * 1024)).toBe('file_too_large');
  });

  it('rejects unsupported mime type', () => {
    expect(validateMediaUpload('image', 'application/x-msdownload', 1000)).toBe('invalid_mime_type');
  });
});
