import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

function palette() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    line: dark ? '#3987e5' : '#2a78d6',
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    axis: '#898781',
    surface: dark ? '#1c1c1e' : '#ffffff',
    text: dark ? '#ffffff' : '#0b0b0b',
  };
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const c = palette();
  const item = payload[0].payload;
  return (
    <div style={{ background: c.surface, color: c.text, padding: '8px 10px', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.15)', fontSize: 13 }}>
      <div style={{ color: '#898781' }}>{label} haftasi</div>
      <b>{item.score ?? "Ma'lumot yo'q"}</b> ball · {item.tasks} vazifa
    </div>
  );
}

export default function TrendChart({ data }) {
  const c = palette();
  const rows = data.map((w) => ({ ...w, label: w.week.slice(0, 5) }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <ReferenceLine y={75} stroke={c.grid} strokeDasharray="4 4" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: c.grid }} />
          <Line type="monotone" dataKey="score" stroke={c.line} strokeWidth={2} dot={{ r: 4, fill: c.line, strokeWidth: 2, stroke: c.surface }} activeDot={{ r: 6 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
