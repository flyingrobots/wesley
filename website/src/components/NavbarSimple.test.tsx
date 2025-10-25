import { render, screen } from '@testing-library/react';
import React from 'react';
import { NavbarSimple } from './NavbarSimple';

describe('NavbarSimple', () => {
  it('renders footer actions as buttons with accessible names', () => {
    render(<NavbarSimple />);
    expect(screen.getByRole('button', { name: /change account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });
});

