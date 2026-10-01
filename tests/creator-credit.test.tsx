import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CreatorCredit } from '../components/creator-credit';

describe('CreatorCredit', () => {
  it('shows an accessible credit linked to BarrilitoDev with its logo', () => {
    render(<CreatorCredit />);

    const link = screen.getByRole('link', { name: 'By BarrilitoDev' });
    expect(link).toHaveAttribute('href', 'https://barrilito.dev/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('img', { name: 'BarrilitoDev logo' })).toHaveAttribute(
      'src',
      '/media/barrilitodev-icon-dark.png',
    );
  });
});
