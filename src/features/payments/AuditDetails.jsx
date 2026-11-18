export function AuditDetails({ service }) {
  if (!service) return null;
  return <div className="g2-purchase__service">
    <h3>What your audit includes</h3>
    <ul>{service.included.map(item => <li key={item}>{item}</li>)}</ul>
    <p className="helper">{service.excluded}</p>
    <details>
      <summary>Timing, audit credit and refunds</summary>
      <dl className="g2-purchase__terms">
        <div><dt>Delivery target</dt><dd>{service.delivery}</dd></div>
        <div><dt>Credit toward your build</dt><dd>{service.credit}</dd></div>
        <div><dt>Refund</dt><dd>{service.refund}</dd></div>
      </dl>
    </details>
  </div>;
}
