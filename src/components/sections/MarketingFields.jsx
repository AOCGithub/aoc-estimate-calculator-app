export function MarketingFields({ areaId, answers, fields }) {
  const { input, select } = fields;
  return (
    <>
      <h3>Connected marketing scope</h3>
      <p className="helper">
        One system can serve several channels. These counts describe its reach; there is no
        separate full build per post or channel.
      </p>
      <div className="grid">
        {input('capability_count', 'Capabilities in this connected system', 'E.g. intake, drafting, repurposing, publishing. Approximate count.', 'number')}
        {areaId === 'area7' && input('channel_count', 'Destination channels', '', 'number')}
        {areaId === 'area7' && input('format_count', 'Output formats', 'E.g. articles, text posts, images.', 'number')}
        {input('brand_count', areaId === 'area8' ? 'Websites in scope' : 'Brands in scope', '', 'number')}
        {input('language_count', 'Languages', '', 'number')}
        {areaId === 'area8' && input('market_count', 'Target markets', '', 'number')}
        {areaId === 'area8' && input('initial_pages', 'Initial pages in scope', 'Enter zero if no initial page work is included.', 'number')}
        {areaId === 'area8' && input('keyword_count', 'Topics or keywords', 'Enter zero if none are included.', 'number')}
      </div>
      {select('delivery_mode', 'What ongoing work would AOC handle?', [
        ['maintenance', 'Maintain the system; our team handles production'],
        ['managed', 'Agreed production and expert review'],
      ])}
      {answers.delivery_mode === 'managed' && (areaId === 'area8' ? (
        <div className="grid">
          {input('monthly_pages', 'Pages worked on each month', 'Zero if none.', 'number')}
          {input('monthly_articles', 'Articles produced each month', 'Zero if none.', 'number')}
        </div>
      ) : input('monthly_outputs', 'Total monthly content / deliverables', 'Specify what a deliverable means in the scope above.', 'number'))}
    </>
  );
}
