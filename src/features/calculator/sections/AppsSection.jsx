import { estimatorBank } from '../../../lib/domain.js';

export function AppsSection({ answers, fields }) {
  return (
    <>
      <h2>Your apps and account context.</h2>
      <p>
        List only the apps or products this process needs to connect to. Mentioning an app or
        account does not by itself make it a priced connection.
      </p>
      {fields.input('systems', 'Which apps or products must connect?', 'Enter required products separated by commas. Enter “None” if no app connection is needed, or “Not sure” if this needs review.', 'text', { list: 'appNames' })}
      <datalist id="appNames">
        {estimatorBank.appNames.map((name) => <option key={name} value={name} />)}
      </datalist>
      {fields.select('workspace_context', 'Which business workspace/account do you use?', [
        ['google_workspace', 'Google Workspace'],
        ['microsoft_365', 'Microsoft 365'],
        ['other', 'Another business workspace'],
        ['none', 'No shared business workspace'],
        ['unknown', 'Not sure'],
      ])}
      {fields.select('ai_account_context', 'Which AI account setup do you use or expect to use?', [
        ['chatgpt_personal', 'ChatGPT personal/free'],
        ['chatgpt_business', 'ChatGPT Business/Enterprise'],
        ['claude_personal', 'Claude personal/free'],
        ['claude_team', 'Claude Team/Enterprise'],
        ['gemini', 'Gemini'],
        ['other', 'Another AI setup'],
        ['none', 'None'],
        ['unknown', 'Not sure'],
      ], 'Do not enter passwords, API keys, or private account details. Technical connection checks happen during paid discovery.')}
      <p className="helper">AOC confirms required actions, permissions, and connection feasibility during paid discovery.</p>
    </>
  );
}
