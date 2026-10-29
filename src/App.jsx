import { useMemo, useState } from 'react';
import { estimatorBank } from './lib/domain.js';
import { useEstimator } from './hooks/useEstimator.js';
import { useAccessGate } from './hooks/useAccessGate.js';
import { createFieldProps } from './components/fields/FormFields.jsx';
import { StepNavigation } from './components/StepNavigation.jsx';
import { StepActions } from './components/StepActions.jsx';
import { EstimateSidebar } from './components/EstimateSidebar.jsx';
import { BusinessAreaSection } from './components/sections/BusinessAreaSection.jsx';
import { DescriptionSection } from './components/sections/DescriptionSection.jsx';
import { ScopeSection } from './components/sections/ScopeSection.jsx';
import { AppsSection } from './components/sections/AppsSection.jsx';
import { DataSection } from './components/sections/DataSection.jsx';
import { ValueSection } from './components/sections/ValueSection.jsx';
import { ServiceSection } from './components/sections/ServiceSection.jsx';
import { LiveContext } from './components/LiveContext.jsx';
import { RestartDialog } from './components/RestartDialog.jsx';
import { AccessGate } from './components/AccessGate.jsx';

function CurrentSection({ state, area, actions, fields, notify, onChooseArea }) {
  if (state.step === 1) {
    return <BusinessAreaSection selectedArea={state.area} onChoose={onChooseArea} />;
  }
  if (state.step === 2) {
    return (
      <DescriptionSection
        state={state}
        area={area}
        onDescriptionChange={actions.setDescription}
        onOrganize={async () => {
          const outcome = await actions.organize();
          if (outcome?.message) notify(outcome.message);
        }}
        onContinue={() => actions.goTo(3)}
      />
    );
  }
  if (state.step === 3) {
    return (
      <ScopeSection
        state={state}
        area={area}
        fields={fields}
        onToggleRoute={actions.toggleRoute}
        onAddField={actions.addVisibleField}
        onRemoveField={(field) => {
          const value = state.answers[field.id];
          const answered = Array.isArray(value) ? value.length > 0
            : value !== null && value !== undefined && value !== '';
          if (answered && !window.confirm(`Remove "${field.question}" and clear its answer? The question will return to the bank and you will need to recalculate.`)) return false;
          actions.removeVisibleField(field.id);
          notify('Question removed. You can add it again from the question bank.');
          requestAnimationFrame(() => {
            const bank = document.getElementById('scope-question-bank');
            if (!bank) return;
            bank.open = true;
            bank.querySelector('input')?.focus();
          });
          return true;
        }}
      />
    );
  }
  if (state.step === 4) return <AppsSection answers={state.answers} fields={fields} />;
  if (state.step === 5) return <DataSection answers={state.answers} fields={fields} />;
  if (state.step === 6) return <ValueSection areaId={state.area} answers={state.answers} fields={fields} />;
  return (
    <ServiceSection
      answers={state.answers}
      confirmed={state.confirmed}
      fields={fields}
      onConfirm={actions.setConfirmed}
      onMark={actions.mark}
    />
  );
}

export default function App() {
  const access = useAccessGate();
  const { state, selectedArea, actions } = useEstimator();
  const [toast, setToast] = useState('');
  const [restartOpen, setRestartOpen] = useState(false);
  const fields = useMemo(
    () => createFieldProps(state, (key, value) => {
      const valid = actions.mark(key, value);
      if (!valid) setToast('Use a nonnegative number.');
    }),
    [actions, state],
  );

  function notify(message) {
    if (!message) return;
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  }

  function restart() {
    setRestartOpen(false);
    setToast('');
    actions.restart();
  }

  function chooseArea(area) {
    if (area === state.area) return;
    if (
      state.area
      && (state.description || Object.keys(state.answers).length)
      && !window.confirm('Changing the business area clears this estimate. Continue?')
    ) return;
    actions.chooseArea(area);
  }

  async function calculate() {
    if (!state.confirmed) {
      notify('Please confirm the reviewed scope first.');
      return;
    }
    const outcome = await actions.calculate();
    if (outcome?.message) notify(outcome.message);
  }

  if (access.enabled && !access.authenticated) {
    return <AccessGate access={access} />;
  }

  return (
    <>
      <header>
        <a className="brand" href="/">Always Open Commerce<span>AI COMMERCE</span></a>
        <LiveContext />
        <button id="restart" type="button" className="quiet" onClick={() => setRestartOpen(true)}>Start over</button>
        {access.enabled && (
          <button type="button" className="quiet" onClick={async () => {
            const outcome = await access.logout();
            if (outcome?.message) notify(outcome.message);
          }}>End session</button>
        )}
      </header>
      <main>
        {state.step === 1 ? (
          <>
            <div className="intro">
          <div className="eyebrow">A BETTER WAY TO WORK</div>
          <h1>Start with the work.<br /><span>We’ll help connect the pieces.</span></h1>
          <p>
            Tell us what you want to improve. Review the details we collect, then explore the build,
            support and potential value—without needing to know the technology.
          </p>
        </div>
            <div className="preview-note">
          <strong>About your estimate.</strong> Prices are indicative calculations and are not an
          approved quote. {access.enabled ? 'Access is limited to AOC-approved participants. ' : ''}
          Don’t enter passwords or private customer records.
        </div>
          </>
        ) : (
          <details className="journey-context">
            <summary>About this estimate</summary>
            <p>
              Tell us what you want to improve. Review the details we collect, then explore the build,
              support and potential value without needing to know the technology.
            </p>
            <p>
              <strong>Estimate notice.</strong> Prices are indicative calculations and are not an
              approved quote. {access.enabled ? 'Access is limited to AOC-approved participants. ' : ''}
              Do not enter passwords or private customer records.
            </p>
          </details>
        )}
        <div className="workspace">
          <StepNavigation currentStep={state.step} hasArea={Boolean(state.area)} onNavigate={actions.goTo} />
          <div id="mainPanel">
            <section className="panel">
              <div key={state.step} className="section-transition">
                <div className="section-kicker">
                  SECTION {state.step} OF 7 · {selectedArea?.label || 'AI COMMERCE'}
                </div>
                <CurrentSection
                  state={state}
                  area={selectedArea}
                  actions={actions}
                  fields={fields}
                  notify={notify}
                  onChooseArea={chooseArea}
                />
                {state.step !== 2 && (
                  <StepActions
                    step={state.step}
                    hasArea={Boolean(state.area)}
                    onBack={() => actions.goTo(state.step - 1)}
                    onNext={() => actions.goTo(state.step + 1)}
                    onCalculate={calculate}
                    calculating={state.calculating}
                  />
                )}
              </div>
            </section>
          </div>
          <EstimateSidebar state={state} area={selectedArea || { label: 'AI Commerce' }} />
        </div>
        <footer>
          <span>Always Open Commerce · USD · Estimates only</span>
          <span>{estimatorBank.version}</span>
        </footer>
      </main>
      <RestartDialog open={restartOpen} onCancel={() => setRestartOpen(false)} onConfirm={restart} />
      {toast && <div id="toast" role="status" className="visible">{toast}</div>}
    </>
  );
}
