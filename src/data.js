// Начальные данные. Используются только при первом запуске —
// дальше всё живёт в localStorage.
//
// Модель заправки:
//   grossTotal — стоимость топлива до скидки
//   discount   — скидка (0, если её нет)
//   paidTotal  — реально оплаченная сумма (grossTotal - discount)
//   fullTank   — заправка до полного бака
// Литры никогда не корректируются из-за скидки.

export const INITIAL_FUEL = [
  { id:1,  date:"2026-03-11", km:209834, liters:32.652, pricePerL:1.825, grossTotal:59.59, discount:0,    paidTotal:59.59, station:"Хихон", fullTank:true, note:"", consumption:5.5 },
  { id:2,  date:"2026-03-20", km:210554, liters:36.502, pricePerL:1.924, grossTotal:70.23, discount:0,    paidTotal:70.23, station:"", fullTank:true, note:"", consumption:5.4 },
  { id:3,  date:"2026-03-28", km:211058, liters:25.073, pricePerL:1.579, grossTotal:39.59, discount:0,    paidTotal:39.59, station:"", fullTank:true, note:"", consumption:5.6 },
  { id:4,  date:"2026-04-06", km:211627, liters:13.080, pricePerL:1.529, grossTotal:20.00, discount:0,    paidTotal:20.00, station:"Лангрео", fullTank:true, note:"", consumption:4.9 },
  { id:5,  date:"2026-04-17", km:212135, liters:38.40,  pricePerL:1.647, grossTotal:60.74, discount:0,    paidTotal:60.74, station:"La Ferrera-Siero", fullTank:true, note:"", consumption:4.9 },
  { id:6,  date:"2026-04-25", km:212993, liters:38.14,  pricePerL:1.645, grossTotal:58.90, discount:0,    paidTotal:58.90, station:"Хихон", fullTank:true, note:"", consumption:4.7 },
  { id:7,  date:"2026-05-02", km:213747, liters:35.87,  pricePerL:1.669, grossTotal:59.87, discount:0,    paidTotal:59.87, station:"Хихон", fullTank:true, note:"", consumption:4.7 },
  { id:8,  date:"2026-05-14", km:214503, liters:37.06,  pricePerL:1.619, grossTotal:57.00, discount:0,    paidTotal:57.00, station:"La Corredoria-Oviedo", fullTank:true, note:"", consumption:4.89 },
  { id:9,  date:"2026-05-23", km:215239, liters:33.742, pricePerL:1.419, grossTotal:47.88, discount:0,    paidTotal:47.88, station:"Alcampo Nalón, El Entrego", fullTank:true, note:"", consumption:4.58 },
  { id:10, date:"2026-06-11", km:216020, liters:36.61,  pricePerL:1.585, grossTotal:55.00, discount:0,    paidTotal:55.00, station:"La Corredoria-Oviedo (Repsol)", fullTank:true, note:"", consumption:4.69 },
  { id:11, date:"2026-06-24", km:216701, liters:32.701, pricePerL:1.529, grossTotal:50.00, discount:0,    paidTotal:50.00, station:"Овьедо", fullTank:true, note:"", consumption:4.7 },
  { id:12, date:"2026-07-04", km:217151, liters:25.49,  pricePerL:1.685, grossTotal:41.31, discount:0,    paidTotal:41.31, station:"La Ferrera-Siero (Repsol)", fullTank:true, note:"", consumption:null },
  { id:13, date:"2026-07-17", km:217701, liters:27.20,  pricePerL:1.765, grossTotal:46.74, discount:0,    paidTotal:46.74, station:"La Ferrera-Siero (Repsol)", fullTank:true, note:"", consumption:4.95 },
  { id:14, date:"2026-08-01", km:218464, liters:37.978, pricePerL:1.820, grossTotal:69.12, discount:0,    paidTotal:69.12, station:"Viella-Siero (Repsol)", fullTank:true, note:"", consumption:5.0 },
  { id:15, date:"2026-08-16", km:219225, liters:26.752, pricePerL:1.869, grossTotal:50.00, discount:0,    paidTotal:50.00, station:"Petroprin Овьедо", fullTank:false, note:"", consumption:null },
  { id:16, date:"2026-08-26", km:219763, liters:36.42,  pricePerL:1.819, grossTotal:66.25, discount:3.80, paidTotal:62.45, station:"Repsol/CAMPSA CRED SIERO, Viella", fullTank:true, note:"", consumption:4.8 },
  { id:17, date:"2026-09-04", km:220446, liters:25.316, pricePerL:1.975, grossTotal:50.00, discount:0,    paidTotal:50.00, station:"CAMPSA Vega de Valdetronco", fullTank:true, note:"", consumption:4.5 },
  { id:18, date:"2026-09-06", km:220684, liters:20.949, pricePerL:1.959, grossTotal:41.04, discount:2.54, paidTotal:38.50, station:"Repsol San Agustín de Guadalix", fullTank:true, note:"", consumption:4.8 },
];

export const INITIAL_SERVICE = [
  { id:1,  date:"2018-02-19", km:91714,  type:"Масло и фильтр", cost:0,    note:"Toyota сервис", category:"oil" },
  { id:2,  date:"2019-05-06", km:101803, type:"Масло и фильтр", cost:0,    note:"Toyota сервис", category:"oil" },
  { id:3,  date:"2020-07-09", km:112251, type:"Масло и фильтр 0W-20 5л", cost:46, note:"Самостоятельно", category:"oil" },
  { id:4,  date:"2021-02-19", km:118856, type:"Замена масла вариатора + антифриз (2 контура)", cost:215, note:"Toyota Центр Бенидорм", category:"fluid" },
  { id:5,  date:"2021-08-07", km:124000, type:"Масло и фильтр 0W-20 5л", cost:46, note:"", category:"oil" },
  { id:6,  date:"2021-11-13", km:0,      type:"Задние тормозные колодки TRW", cost:25.50, note:"AutoDoc", category:"brakes" },
  { id:7,  date:"2022-01-14", km:128277, type:"Замена 2 передних шин Yokohama Es32", cost:148, note:"AutoDoc", category:"tires" },
  { id:8,  date:"2022-05-20", km:132000, type:"Замена 2 задних шин (б/у)", cost:100, note:"", category:"tires" },
  { id:9,  date:"2022-09-01", km:135790, type:"Масло и фильтр 0W-20 5л", cost:59.69, note:"lubricantesweb.es", category:"oil" },
  { id:10, date:"2023-09-21", km:151500, type:"Масло и фильтр", cost:0,    note:"", category:"oil" },
  { id:11, date:"2024-01-25", km:155870, type:"Замена левого колеса + развал-схождение", cost:100, note:"Talleres Quique Finectrat", category:"tires" },
  { id:12, date:"2024-04-05", km:160000, type:"2 задних шины BFGoodrich", cost:229, note:"Хихон", category:"tires" },
  { id:13, date:"2024-06-08", km:164700, type:"Масло и фильтр 0W-20", cost:0, note:"lubricantesweb.es", category:"oil" },
  { id:14, date:"2024-09-25", km:174000, type:"2 передних шины Yokohama", cost:254, note:"Гараж Сотрондио", category:"tires" },
  { id:15, date:"2025-01-24", km:176540, type:"ITV Техосмотр", cost:0,    note:"Пройден", category:"inspection" },
  { id:16, date:"2025-02-14", km:178000, type:"Масло и фильтр", cost:45,  note:"Алекс, Овьедо", category:"oil" },
  { id:17, date:"2025-03-25", km:180000, type:"Передние тормозные колодки TRW", cost:72.69, note:"30€ работа + 42,69€ колодки", category:"brakes" },
  { id:18, date:"2025-04-01", km:182029, type:"Ремонт суппорта левого тормоза", cost:0, note:"Aleks Motors Oviedo", category:"brakes" },
  { id:19, date:"2025-09-09", km:0,      type:"Аккумулятор Varta B33 45Ah 330A", cost:60, note:"Установлен самостоятельно", category:"battery" },
  { id:20, date:"2025-08-08", km:192820, type:"Стойка стаб. + прокладка натяжителя + тормозная жидкость DOT4 + балансировка", cost:150, note:"Олександр Овьедо", category:"suspension" },
  { id:21, date:"2025-09-10", km:196113, type:"Масло 5W-30 + фильтр + жидкость вариатора + свечи", cost:205, note:"Олександр. Свечи Toyota 105€ + работа 100€", category:"oil" },
  { id:22, date:"2025-09-18", km:196845, type:"Замена лобового стекла", cost:0, note:"По страховке", category:"body" },
  { id:23, date:"2026-02-19", km:208188, type:"Масло 5W-30 и фильтр", cost:100, note:"Олександр, Овьедо", category:"oil" },
  { id:24, date:"2026-05-12", km:213747, type:"Замена переднего правого колеса", cost:100, note:"Yokohama BluEarth-GT AE51 205/60 R16", category:"tires" },
  { id:25, date:"2026-05-21", km:214500, type:"Замена переднего левого колеса", cost:88.49, note:"Yokohama BluEarth-GT AE51 205/60 R16", category:"tires" },
  { id:26, date:"2026-06-11", km:216000, type:"Антифриз Toyota SLLC (двигатель + инвертор)", cost:176.51, note:"Aleks Motors Овьедо. След. ~316.000 км / ~2030", category:"fluid" },
  { id:27, date:"2026-06-11", km:216000, type:"Замена пыльников передних стоек", cost:120, note:"Aleks Motors Овьедо", category:"suspension" },
  { id:28, date:"2026-06-11", km:216000, type:"Развал-схождение (geometría)", cost:50, note:"После замены пыльников и новых шин", category:"suspension" },
];

export const INITIAL_REMINDERS = [
  { id:1, title:"Моторное масло 0W-20", icon:"🔧", dueKm:221000, dueDate:"2026-09-15", priority:"upcoming", note:"Замена моторного масла 0W-20", completed:false, completedDate:null, completedKm:null },
  { id:2, title:"Тормозная жидкость DOT4", icon:"💧", dueKm:233000, dueDate:"2027-08-08", priority:"upcoming", note:"Заменена 08.08.2025 на 192 820 км", completed:false, completedDate:null, completedKm:null },
  { id:3, title:"Суппорт тормозной", icon:"🛑", dueKm:null, dueDate:null, priority:"pending", note:"Куплен (56€), не установлен", completed:false, completedDate:null, completedKm:null },
  { id:4, title:"Задние амортизаторы KYB", icon:"🚗", dueKm:null, dueDate:null, priority:"pending", note:"Куплены (66,43€), не установлены", completed:false, completedDate:null, completedKm:null },
  { id:5, title:"Антифриз (след. замена)", icon:"❄️", dueKm:316000, dueDate:"2030-06-01", priority:"info", note:"Заменён 11.06.26. След. ~316.000 км / 2030", completed:false, completedDate:null, completedKm:null },
  { id:6, title:"ITV Техосмотр", icon:"📋", dueKm:null, dueDate:"2027-01-29", priority:"info", note:"Прошёл 24.01.25 на 176.540 км", completed:false, completedDate:null, completedKm:null },
  { id:7, title:"Страховка Zurich", icon:"🛡️", dueKm:null, dueDate:"2026-11-21", priority:"info", note:"Продлена 21.11.24 (271€)", completed:false, completedDate:null, completedKm:null },
];

export const CATEGORY_COLORS = {
  oil:"#d4af37", fluid:"#4caf8a", brakes:"#e07b54",
  tires:"#7b9fd4", inspection:"#aaa", battery:"#c084fc",
  suspension:"#fb923c", body:"#94a3b8"
};

export const CATEGORY_LABELS = {
  oil:"Масло", fluid:"Жидкости", brakes:"Тормоза",
  tires:"Шины", inspection:"Осмотр", battery:"Аккумулятор",
  suspension:"Подвеска", body:"Кузов"
};

export const REMINDER_ICONS = ["🔧","💧","🛑","🚗","❄️","📋","🛡️","⚙️","🔋","🛞","🪫","📌"];

export const CAR = {
  model: "Toyota Prius+ 1.8 HSD",
  year: "2012",
  engine: "2ZR-FXE Hybrid 136 CV",
  vin: "JTDZS3EU003044352",
  color: "1G3",
  specs: [
    {
      title: "Моторное масло",
      rows: [["Тип", "Toyota 0W-20"], ["Объём с фильтром", "4.2 л"]],
    },
    {
      title: "Трансмиссия",
      rows: [["Тип", "Toyota ATF WS"], ["Объём", "3.4 л"]],
    },
    {
      title: "Антифриз",
      rows: [
        ["Тип", "Toyota Super Long Life Coolant (SLLC), розовый"],
        ["Двигатель", "примерно 7.2 л"],
        ["Инвертор", "примерно 2.1 л"],
      ],
    },
    {
      title: "Шины",
      rows: [["Размер", "215/50 R17"]],
    },
  ],
};
