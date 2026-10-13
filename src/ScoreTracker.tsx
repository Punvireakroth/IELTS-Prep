import { SCORE_ROWS, type ScoreField, useRecords } from './records'

const FIELDS: { field: ScoreField; label: string; wide?: boolean }[] = [
  { field: 'l', label: 'L /40' },
  { field: 'r', label: 'R /40' },
  { field: 'w', label: 'W est.' },
  { field: 's', label: 'S est.' },
  { field: 'overall', label: 'Overall est.' },
  { field: 'worst_problem', label: 'Worst problem', wide: true },
]

export function ScoreTracker () {
  const { scores, notice, setScore } = useRecords()

  return (
    <div className="tool">
      <p className="hint">Paste the /40 and the band from IELTS Online Tests after each full Listening or Reading. That band is an estimate.</p>
      {notice && <p className="status warn">{notice}</p>}
      <div className="table-wrap">
        <table className="score-table">
          <thead>
            <tr>
              <th>When</th>
              {FIELDS.map((column) => (
                <th key={column.field}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCORE_ROWS.map((row) => {
              const entry = scores[row.key]
              return (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  {FIELDS.map((column) => (
                    <td key={column.field}>
                      <input
                        className={column.wide ? 'score-input wide' : 'score-input'}
                        aria-label={`${row.label} ${column.label}`}
                        value={entry?.[column.field] ?? ''}
                        onChange={(event) => setScore(row.key, column.field, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
