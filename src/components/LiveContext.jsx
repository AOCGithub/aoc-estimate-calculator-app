import { useEffect, useMemo, useState } from 'react';

function locationFromTimeZone(timeZone) {
  const place = timeZone.split('/').at(-1) || timeZone;
  return place.replaceAll('_', ' ').replace(/^GMT[+-]?\d*$/, 'Local');
}

export function LiveContext() {
  const [now, setNow] = useState(() => new Date());
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local',
    [],
  );
  const location = useMemo(() => locationFromTimeZone(timeZone), [timeZone]);
  const formattedDate = useMemo(
    () => new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(now),
    [now],
  );
  const formattedTime = useMemo(
    () => new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(now),
    [now],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="live-context" title={`Local time for ${timeZone}`}>
      <span className="live-context__marker" aria-hidden="true" />
      <span className="live-context__location">{location}</span>
      <span className="live-context__divider" aria-hidden="true">/</span>
      <time dateTime={now.toISOString()}>
        <span className="live-context__date">{formattedDate}</span>
        <span className="live-context__time-divider" aria-hidden="true"> · </span>
        <span className="live-context__time">{formattedTime}</span>
      </time>
    </div>
  );
}
