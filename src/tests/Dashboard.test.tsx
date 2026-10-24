import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '../views/Dashboard';
import { useAppStore } from '../store/appStore';

// Reset store between tests
beforeEach(() => {
  useAppStore.setState({
    currentView: 'dashboard',
    ollamaStatus: { running: false, models: [] },
    selectedFolder: null,
    scannedFiles: [],
    suggestions: [],
    history: [],
  });
});

describe('Dashboard', () => {
  it('renders the main heading', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Your files are a mess/i)).toBeInTheDocument();
  });

  it('renders the Select Folder button', () => {
    render(<Dashboard />);
    expect(screen.getByRole('button', { name: /select folder/i })).toBeInTheDocument();
  });

  it('shows Ollama offline when not running', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Not detected/i)).toBeInTheDocument();
  });

  it('shows Ollama connected when running', () => {
    useAppStore.setState({ ollamaStatus: { running: true, models: ['qwen2.5:3b'] } });
    render(<Dashboard />);
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });

  it('shows zero stats when no files scanned', () => {
    render(<Dashboard />);
    // All stats should be 0
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
  });

  it('shows install guide when Ollama is offline', () => {
    render(<Dashboard />);
    expect(screen.getByText(/ollama pull/i)).toBeInTheDocument();
  });

  it('shows workflow steps', () => {
    render(<Dashboard />);
    expect(screen.getByText('Select Folder')).toBeInTheDocument();
    expect(screen.getByText('Scan Files')).toBeInTheDocument();
    expect(screen.getByText('AI Analysis')).toBeInTheDocument();
    expect(screen.getByText('Review & Apply')).toBeInTheDocument();
  });

  it('shows privacy notice', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Privacy First/i)).toBeInTheDocument();
  });

  it('calls selectFolder when button clicked', async () => {
    const mockSelect = vi.fn();
    useAppStore.setState({ selectFolder: mockSelect });
    render(<Dashboard />);
    await userEvent.click(screen.getByRole('button', { name: /select folder/i }));
    expect(mockSelect).toHaveBeenCalled();
  });
});
