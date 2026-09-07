import React from "react";
import Modal from "./Modal";
import { CAR } from "../data";

export default function CarModal({ onClose }) {
  return (
    <Modal title="Паспорт автомобиля" onClose={onClose}>
      <dl className="card">
        <div className="spec"><dt>Марка</dt><dd>{CAR.model}</dd></div>
        <div className="spec"><dt>Год</dt><dd>{CAR.year}</dd></div>
        <div className="spec"><dt>Двигатель</dt><dd>{CAR.engine}</dd></div>
        <div className="spec"><dt>VIN</dt><dd>{CAR.vin}</dd></div>
        <div className="spec"><dt>Цвет</dt><dd>{CAR.color}</dd></div>
      </dl>

      {CAR.specs.map((block) => (
        <React.Fragment key={block.title}>
          <div className="section-title">{block.title}</div>
          <dl className="card">
            {block.rows.map(([label, value]) => (
              <div className="spec" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </React.Fragment>
      ))}
    </Modal>
  );
}
