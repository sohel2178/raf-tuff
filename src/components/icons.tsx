type P = { className?: string };
const base = (d: React.ReactNode) =>
  function Icon({ className = 'size-5' }: P) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {d}
      </svg>
    );
  };

export const IconHome = base(<><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10v9h12v-9" /></>);
export const IconBolt = base(<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />);
export const IconList = base(<><path d="M8 7h12M8 12h12M8 17h12" /><path d="M4 7h.01M4 12h.01M4 17h.01" /></>);
export const IconChart = base(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>);
export const IconUsers = base(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.3-5 6.5-5s5.7 1.6 6.5 5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5" /></>);
export const IconKey = base(<><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14.5 8.5l2 2" /></>);
export const IconCog = base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>);
export const IconLogout = base(<><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></>);
export const IconMore = base(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>);
export const IconDownload = base(<><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></>);
export const IconRefresh = base(<><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></>);
export const IconSearch = base(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>);
export const IconFilter = base(<path d="M4 5h16l-6 7.5V19l-4 1v-7.5L4 5Z" />);
export const IconCopy = base(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>);
export const IconPlus = base(<path d="M12 5v14M5 12h14" />);
export const IconStack = base(<><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" /><path d="m3 12 9 4.5 9-4.5" /><path d="m3 16.5 9 4.5 9-4.5" /></>);
export const IconUpload = base(<><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></>);
export const IconTrash = base(<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>);
export const IconPhone = base(<><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18h2" /></>);
