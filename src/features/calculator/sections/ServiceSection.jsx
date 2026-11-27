import { simplifiedRules } from '../../../lib/domain.js';

export function ServiceSection({ confirmed, onConfirm }) {
  const support = simplifiedRules.launchSupport;
  return (
    <>
      <h2>Your fixed-price next step.</h2>
      <p>
        This free calculator gives a provisional estimate. It does not confirm technical
        feasibility or make a final project quote.
      </p>
      <div className="subtle">
        <strong>{simplifiedRules.freeServiceName}</strong>
        <p>
          Review your answers, estimated build range, planning ROI, and possible external usage
          costs. Detailed technical checks happen later.
        </p>
      </div>
      <div className="subtle">
        <strong>{simplifiedRules.paidServiceName}</strong>
        <p>
          If you choose to proceed, AOC reviews the workflow, apps, data, and requirements, then
          prepares an implementation plan and fixed-price proposal. The estimated fee is 15% of
          the one-time build estimate; any eligible credit is applied once and confirmed by AOC.
        </p>
      </div>
      <div className="subtle">
        <strong>Separate costs and proposed launch help</strong>
        <p>
          Make usage and other software or AI-provider costs are separate from the build. The
          estimate includes a proposed ${support.amount} one-time Launch Support allowance for
          up to {support.days} days or {support.requests} requests, whichever comes first. This
          proposal is not finalized; AOC confirms any support terms before purchase.
        </p>
      </div>
      <label className={`check ${!confirmed ? 'check--missing-required' : ''}`}>
        <input
          type="checkbox"
          checked={confirmed}
          required
          aria-invalid={!confirmed ? 'true' : undefined}
          onChange={event => onConfirm(event.target.checked)}
        />
        I’ve reviewed the description and answers. Unknown items and assumptions remain subject to validation.
        {!confirmed && <span className="required-indicator">Required</span>}
      </label>
    </>
  );
}
