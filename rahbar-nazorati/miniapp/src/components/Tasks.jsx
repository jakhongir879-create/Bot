import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api.js';
import { TaskCard, Spinner, Empty } from './ui.jsx';
import { haptic } from '../telegram.js';

const FILTERS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'new', label: 'Yangi' },
  { key: 'progress', label: 'Jarayonda' },
  { key: 'overdue', label: "Muddati o'tgan" },
  { key: 'done', label: 'Bajarilgan' },
];

export default function Tasks({ me, filter, onFilter, onOpenTask, onNewTask, refreshKey }) {
  const canAssign = me.canAssign;
  const [scope, setScope] = useState('mine');
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.tasks(scope, filter);
      setTasks(data.tasks);
    } catch (e) {
      setError(e.message);
    }
  }, [scope, filter]);

  useEffect(() => {
    setTasks(null);
    load();
  }, [load, refreshKey]);

  return (
    <>
      <div className="page-title">Vazifalar</div>
      {canAssign && (
        <div className="segmented">
          {[
            ['mine', 'Menga berilgan'],
            ['given', 'Men bergan'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={scope === key ? 'active' : ''}
              onClick={() => {
                haptic('light');
                setScope(key);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              onFilter(f.key);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <div className="card tone-red">{error}</div>}
      {!tasks && !error && <Spinner />}
      {tasks && !tasks.length && <Empty>Bu bo'limda vazifa yo'q</Empty>}
      {tasks?.map((t) => (
        <TaskCard key={t.id} task={t} onClick={() => onOpenTask(t.id)} showAssignee={scope === 'given'} showAssigner={scope === 'mine'} />
      ))}
      {canAssign && (
        <button className="fab" onClick={onNewTask}>
          <Plus size={18} strokeWidth={2.2} /> Yangi vazifa
        </button>
      )}
    </>
  );
}
