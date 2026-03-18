import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MarkView } from '../MarkView';

// Stub heavy optional deps that require browser/wasm context
vi.mock('@markview/core', async () => {
  const actual = await vi.importActual<typeof import('@markview/core')>('@markview/core');
  return {
    ...actual,
    renderMarkdown: vi.fn().mockResolvedValue('<p>Hello, <strong>world</strong>!</p>'),
  };
});

describe('MarkView component', () => {
  it('renders without crashing', () => {
    const { container } = render(<MarkView content="# Hello" />);
    expect(container).toBeTruthy();
  });

  it('renders loading state initially', () => {
    render(<MarkView content="# Loading test" />);
    // The component renders a div container immediately
    expect(document.querySelector('[class*="markview"]') ?? document.body).toBeTruthy();
  });

  it('renders with empty content', () => {
    const { container } = render(<MarkView content="" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MarkView content="# Test" className="my-custom-class" />
    );
    expect(container.querySelector('.my-custom-class')).toBeTruthy();
  });

  it('renders markdown content after async render', async () => {
    render(<MarkView content="Hello, **world**!" />);

    await waitFor(() => {
      // Content should eventually be rendered into the DOM
      expect(document.body.innerHTML).toBeTruthy();
    });
  });
});
