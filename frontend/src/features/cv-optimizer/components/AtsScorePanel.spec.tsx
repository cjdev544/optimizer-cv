import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AtsScorePanel } from './AtsScorePanel';

describe('AtsScorePanel', () => {
  it('shows both the before and after scores', () => {
    render(<AtsScorePanel beforeScore={40} afterScore={85} />);

    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('shows the improvement badge when the score increased', () => {
    render(<AtsScorePanel beforeScore={40} afterScore={85} />);

    expect(screen.getByText('+45%')).toBeInTheDocument();
  });

  it('does not show an improvement badge when the score did not increase', () => {
    render(<AtsScorePanel beforeScore={85} afterScore={85} />);

    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('does not show an improvement badge when the score decreased', () => {
    render(<AtsScorePanel beforeScore={85} afterScore={40} />);

    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
