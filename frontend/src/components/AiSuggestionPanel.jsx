import { formatEnumLabel } from '../utils/findingWorkflow.js'

export function AiSuggestionPanel({ suggestion, onUse }) {
  if (!suggestion) return null

  return (
    <section className="ai-suggestion" aria-labelledby="ai-suggestion-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Assistant output</p>
          <h2 id="ai-suggestion-title">AI Suggested Finding</h2>
        </div>
        <button className="button button--secondary button--fit" type="button" onClick={onUse}>Use Suggestion</button>
      </div>
      <p className="ai-suggestion__notice">Review this suggestion carefully. It is not saved and may be edited before creating the final finding.</p>
      <dl className="suggestion-grid">
        <div><dt>Area</dt><dd>{formatEnumLabel(suggestion.area)}</dd></div>
        <div><dt>Category</dt><dd>{formatEnumLabel(suggestion.category)}</dd></div>
        <div><dt>Severity</dt><dd><span className={`severity severity--${suggestion.severity.toLowerCase()}`}>{suggestion.severity}</span></dd></div>
        <div className="suggestion-grid__wide"><dt>Issue</dt><dd>{suggestion.issue}</dd></div>
        <div className="suggestion-grid__wide"><dt>Description</dt><dd>{suggestion.description}</dd></div>
        <div className="suggestion-grid__wide"><dt>Recommended action</dt><dd>{suggestion.recommendedAction}</dd></div>
      </dl>
    </section>
  )
}
