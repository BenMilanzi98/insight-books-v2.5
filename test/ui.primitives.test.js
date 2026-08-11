import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Badge, { StatusBadge } from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import Card, { SummaryCard } from '../components/ui/Card.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import ClickableStatCard from '../components/ui/ClickableStatCard.jsx';
import FormField, { Input } from '../components/ui/FormField.jsx';

describe('UI primitives', () => {
  it('Badge renders readable text with tone classes', () => {
    const html = renderToStaticMarkup(React.createElement(Badge, { tone: 'success' }, 'Paid'));
    expect(html).toContain('Paid');
    expect(html).toContain('bg-emerald-50');
  });

  it('StatusBadge maps statuses to tones and keeps text', () => {
    const paid = renderToStaticMarkup(React.createElement(StatusBadge, { status: 'paid' }));
    const overdue = renderToStaticMarkup(React.createElement(StatusBadge, { status: 'overdue' }));
    expect(paid).toContain('paid');
    expect(paid).toContain('bg-emerald-50');
    expect(overdue).toContain('overdue');
    expect(overdue).toContain('bg-red-50');
  });

  it('Button supports loading and disabled', () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { loading: true }, 'Save')
    );
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Save');
  });

  it('EmptyState exposes title and optional action', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        title: 'No clients',
        description: 'Add your first client',
        actionLabel: 'Add client',
        onAction: () => {},
      })
    );
    expect(html).toContain('No clients');
    expect(html).toContain('Add your first client');
    expect(html).toContain('Add client');
  });

  it('DataTable renders desktop table and mobile cards', () => {
    const columns = [
      { key: 'name', header: 'Name' },
      { key: 'amount', header: 'Amount', align: 'right' },
    ];
    const rows = [{ id: 1, name: 'Acme', amount: '100' }];
    const html = renderToStaticMarkup(
      React.createElement(DataTable, { columns, rows })
    );
    expect(html).toContain('hidden');
    expect(html).toContain('md:block');
    expect(html).toContain('md:hidden');
    expect(html).toContain('Acme');
    expect(html).toContain('<table');
  });

  it('DataTable empty state when no rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataTable, {
        columns: [{ key: 'a', header: 'A' }],
        rows: [],
        emptyTitle: 'Nothing yet',
      })
    );
    expect(html).toContain('Nothing yet');
  });

  it('Card and SummaryCard render content', () => {
    const card = renderToStaticMarkup(React.createElement(Card, null, 'Body'));
    const summary = renderToStaticMarkup(
      React.createElement(SummaryCard, { title: 'Revenue', value: '1,000' })
    );
    expect(card).toContain('Body');
    expect(summary).toContain('Revenue');
    expect(summary).toContain('1,000');
  });

  it('StatCard static mode renders a div without click hints', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCard, { label: 'Paid', value: 'MWK 1,000' })
    );
    expect(html).toContain('Paid');
    expect(html).toContain('MWK 1,000');
    expect(html).toContain('rounded-2xl');
    expect(html).toContain('break-words');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Click to open');
  });

  it('StatCard interactive mode renders a button with hint', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCard, {
        label: 'Pending',
        value: 'MWK 500',
        interactive: true,
        onClick: () => {},
      })
    );
    expect(html).toContain('<button');
    expect(html).toContain('Click to open');
  });

  it('ClickableStatCard delegates to interactive StatCard', () => {
    const html = renderToStaticMarkup(
      React.createElement(ClickableStatCard, {
        label: 'Overdue',
        value: 'MWK 200',
        onClick: () => {},
      })
    );
    expect(html).toContain('<button');
    expect(html).toContain('Overdue');
    expect(html).toContain('rounded-2xl');
  });

  it('SummaryCard uses invoice chrome via StatCard', () => {
    const html = renderToStaticMarkup(
      React.createElement(SummaryCard, { title: 'Revenue', value: '1,000', subtitle: 'MTD' })
    );
    expect(html).toContain('Revenue');
    expect(html).toContain('1,000');
    expect(html).toContain('MTD');
    expect(html).toContain('rounded-2xl');
    expect(html).not.toContain('<button');
  });

  it('StatCard helper prop renders without click hints', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCard, {
        label: 'Receipts',
        value: '12',
        helper: 'All statuses',
      })
    );
    expect(html).toContain('All statuses');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Click to open');
  });

  it('FormField associates label with control id', () => {
    const html = renderToStaticMarkup(
      React.createElement(FormField, { label: 'Email', htmlFor: 'email-1' }, (props) =>
        React.createElement(Input, { ...props, name: 'email' })
      )
    );
    expect(html).toContain('for="email-1"');
    expect(html).toContain('id="email-1"');
    expect(html).toContain('Email');
  });
});
