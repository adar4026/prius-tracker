import React from "react";

/**
 * Фон Главной: дорога на рассвете, уходящая к горизонту
 * (public/images/road-background.jpg; исходник-референс — в design/, вне сборки).
 *
 * Пейзаж занимает только hero-зону (шапка, пробег, показатели) и снизу
 * растворяется в фон страницы, так что к карточкам дороги уже нет. Сцена
 * держит пропорции снимка и выставлена так, что солнце стоит за пробегом,
 * а изгибы дороги уходят к горизонту под ним; солнце и туман положены в
 * процентах сцены и всегда совпадают со снимком. Вуаль — для читаемости hero.
 * Событий не перехватывает (pointer-events: none), aria-hidden.
 */
const ROAD_IMG = `${process.env.PUBLIC_URL}/images/road-background.jpg`;

export default function RoadBackground() {
  return (
    <div className="home-road" aria-hidden="true" style={{ "--road-img": `url("${ROAD_IMG}")` }}>
      <div className="home-road__scene">
        <span className="home-road__mist" />
        <span className="home-road__sun" />
      </div>
      <span className="home-road__veil" />
    </div>
  );
}
