const paths = {
  chevron: 'm9 5 7 7-7 7',
  download: 'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',
  chart: 'M4 4v16h16M8 15l4-5 4 2 4-7',
  layers: 'm12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  finance: 'M4 5h16v15H4V5Zm4-3v6m8-6v6M4 10h16m-11 4h6m-6 3h3',
  operations: 'M3 4h7v7H3V4Zm11 0h7v7h-7V4ZM3 15h7v6H3v-6Zm11 0h7v6h-7v-6Z',
  support: 'M4 13v-2a8 8 0 0 1 16 0v2M4 11H2v7h4v-7H4Zm16 0h2v7h-4v-7h2Zm0 7c0 3-3 3-7 3',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  store: 'M3 9h18l-2-6H5L3 9Zm1 0v12h16V9M9 21v-7h6v7M2 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 8 0',
  content: 'M5 3h10l4 4v14H5V3Zm10 0v5h4M9 12h6m-6 4h6',
  ads: 'm3 10 14-6v16L3 14v-4Zm4 6 2 5h3l-2-6M21 9v6',
  design: 'm4 20 4-1L20 7a2.12 2.12 0 0 0-3-3L5 16l-1 4Zm11-14 3 3M4 20h16',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  email: 'M3 5h18v14H3V5Zm0 0 9 8 9-8',
  other: 'M12 5v14M5 12h14',
};

export function Icon({ name, className = '' }) {
  return <svg className={`ui-icon ${className}`} width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name] || paths.layers} />
  </svg>;
}
