import React from "react";

export default function Stat({ icon, label, value, unit, color }) {
  return (
    <div className="card stat">
      <div className="stat__label">{icon && <span>{icon}</span>}{label}</div>
      <div className="stat__value" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </div>
    </div>
  );
}
