import { describe, it, expect } from 'vitest';
import { encodeMarkdownUrl, decodeMarkdownUrl, estimateUrlLength, MAX_SHAREABLE_LENGTH } from '@/lib/sharing/url-share';

describe('URL Sharing', () => {
  it('should encode and decode a simple markdown string', async () => {
    const content = '# Hello World\n\nThis is a test.';
    const url = await encodeMarkdownUrl(content, 'Test');

    expect(url).toContain('#md=');
    expect(url).toContain('title=Test');

    // Extract hash from URL
    const hash = url.split('#')[1];
    const result = await decodeMarkdownUrl(hash);

    expect(result).not.toBeNull();
    expect(result!.content).toBe(content);
    expect(result!.title).toBe('Test');
  });

  it('should handle content without title', async () => {
    const content = '# No Title';
    const url = await encodeMarkdownUrl(content);

    const hash = url.split('#')[1];
    const result = await decodeMarkdownUrl(hash);

    expect(result).not.toBeNull();
    expect(result!.content).toBe(content);
    expect(result!.title).toBeUndefined();
  });

  it('should handle unicode content', async () => {
    const content = '# こんにちは\n\n这是一个测试 🚀';
    const url = await encodeMarkdownUrl(content);

    const hash = url.split('#')[1];
    const result = await decodeMarkdownUrl(hash);

    expect(result!.content).toBe(content);
  });

  it('should handle empty/invalid hash gracefully', async () => {
    expect(await decodeMarkdownUrl('')).toBeNull();
    expect(await decodeMarkdownUrl('#foo=bar')).toBeNull();
    expect(await decodeMarkdownUrl('#md=')).toBeNull();
  });

  it('should produce URL-safe base64 (no +, /, or =)', async () => {
    const content = '# Test\n\n'.repeat(100); // enough content to produce varied base64
    const url = await encodeMarkdownUrl(content);
    const hash = url.split('#')[1];
    const params = new URLSearchParams(hash);
    const encoded = params.get('md')!;

    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toMatch(/=$/);
  });

  it('estimateUrlLength returns a positive number', () => {
    expect(estimateUrlLength('# Hello')).toBeGreaterThan(0);
    expect(estimateUrlLength('# Hello'.repeat(1000))).toBeGreaterThan(estimateUrlLength('# Hello'));
  });

  it('MAX_SHAREABLE_LENGTH is a reasonable value', () => {
    expect(MAX_SHAREABLE_LENGTH).toBeGreaterThan(1000);
    expect(MAX_SHAREABLE_LENGTH).toBeLessThan(100000);
  });

  it('should roundtrip larger content', async () => {
    const content = '# Big Document\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(200);
    const url = await encodeMarkdownUrl(content, 'Big Doc');

    const hash = url.split('#')[1];
    const result = await decodeMarkdownUrl(hash);

    expect(result!.content).toBe(content);
    expect(result!.title).toBe('Big Doc');
  });
});
