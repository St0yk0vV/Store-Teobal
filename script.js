// Категории
const CATEGORIES = ["Хамони","Кашкавали","Турони","Вино","Други хранителни","Други нехранителни"];
const LS_KEY = "inventory_v3"; // нов ключ за съвместимост със старите версии

// DOM
const searchEl = document.getElementById("search");
const filterCategoryEl = document.getElementById("filterCategory");

const nameEl = document.getElementById("name");
const categoryEl = document.getElementById("category");
const unitEl = document.getElementById("unit");
const priceEl = document.getElementById("price");
const qtyEl = document.getElementById("qty");
const minEl = document.getElementById("min");
const addBtn = document.getElementById("addBtn");

const tbody = document.getElementById("tbody");
const totalsEl = document.getElementById("totals");
const exportBtn = document.getElementById("exportExcel");
const clearAllBtn = document.getElementById("clearAll");

// Продажби
const sellItemSel = document.getElementById("sellItem");
const sellQtyEl = document.getElementById("sellQty");
const sellDiscountEl = document.getElementById("sellDiscount");
const sellClientEl = document.getElementById("sellClient");
const sellBtn = document.getElementById("sellBtn");
const salesBody = document.getElementById("salesBody");

// Състояние
let state = load() || { items: [], sales: [] }; // items[], sales[]

// Помощни
const n      = (v)=> Number(v || 0);
const money  = (v)=> n(v).toFixed(2) + " лв";
const nowStr = ()=> new Date().toLocaleString('bg-BG', { hour12:false });
const save   = ()=> localStorage.setItem(LS_KEY, JSON.stringify(state));
function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || ""); } catch { return null; } }

// Нормализиране
const norm = (s)=> String(s||"").trim().toLowerCase();

// Ключ за сливане: име + категория + единица + цена
function findItemIndex(name, category, unit, price){
  const N = norm(name), C = norm(category), U = norm(unit), P = n(price);
  return state.items.findIndex(it =>
    norm(it.name)===N && norm(it.category)===C && norm(it.unit)===U && n(it.price)===P
  );
}

// Рендер
function render(){
  renderInventoryTable();
  renderSellOptions();
  renderSalesLog();
}

function renderInventoryTable(){
  const term = (searchEl.value || "").toLowerCase().trim();
  const cat  = filterCategoryEl.value || "";
  const filtered = state.items.filter(it => {
    const matchesText = !term || it.name.toLowerCase().includes(term);
    const matchesCat  = !cat || it.category === cat;
    return matchesText && matchesCat;
  });

  tbody.innerHTML = "";
  let totalValue = 0;

  filtered.forEach((it, i) => {
    const remain = n(it.qty) - n(it.sold);
    const value  = remain * n(it.price);
    totalValue  += value;

    const tr = document.createElement("tr");
    const td = (t)=>{ const d=document.createElement("td"); d.textContent=String(t); return d; };
    const btn=(t,cls,fn)=>{ const b=document.createElement("button"); b.textContent=t; b.className=cls; b.onclick=fn; return b; };
    const space=()=>document.createTextNode(" ");

    const tdRemain = td(n(remain).toFixed(2));
    if (remain < n(it.min || 0)) tdRemain.innerHTML = `<span class="badge-low">${tdRemain.textContent}</span>`;

    const tdActions = document.createElement("td");
    tdActions.append(
      btn("+", "action-btn action-plus",  ()=> adjustStock(it, +1)), // вход (корекция)
      space(),
      btn("−", "action-btn action-minus", ()=> adjustStock(it, -1)), // изход (корекция 1 бр.)
      space(),
      btn("✎", "action-btn action-edit",  ()=> editItem(it)),
      space(),
      btn("🗑", "action-btn action-del",   ()=> delItem(it))
    );

    tr.append(
      td(i+1), td(it.name), td(it.category), td(it.unit),
      td(money(it.price)), td(n(it.qty).toFixed(2)), td(n(it.sold).toFixed(2)),
      tdRemain, td(money(value)), td(n(it.min||0).toFixed(2)), tdActions
    );
    tbody.appendChild(tr);
  });

  totalsEl.textContent = `Обща стойност: ${money(totalValue)}`;
}

function renderSellOptions(){
  sellItemSel.innerHTML = "";
  // ако има няколко реда със същото име, но различна цена — показваме и цената
  state.items
    .slice()
    .sort((a,b)=> a.name.localeCompare(b.name,'bg') || n(a.price)-n(b.price))
    .forEach(it => {
      const remain = n(it.qty) - n(it.sold);
      const opt = document.createElement("option");
      opt.value = it.id;
      opt.textContent = `${it.name} — ${it.category} (${it.unit}) · цена: ${n(it.price).toFixed(2)} · останали: ${remain.toFixed(2)}`;
      sellItemSel.appendChild(opt);
    });
}

function renderSalesLog(){
  salesBody.innerHTML = "";
  const last = state.sales.slice(-50).reverse();
  last.forEach(s => {
    const tr = document.createElement("tr");
    const td = (t)=>{ const d=document.createElement("td"); d.textContent=String(t); return d; };
    tr.append(
      td(s.datetime),
      td(s.client || "—"),
      td(s.name),
      td(s.category),
      td(n(s.qty).toFixed(2)),
      td(s.unit),
      td(n(s.price).toFixed(2)),
      td(n(s.discountPerUnit || 0).toFixed(2)),
      td(n(s.finalUnitPrice).toFixed(2)),
      td(n(s.total).toFixed(2))
    );
    salesBody.appendChild(tr);
  });
}

// Добавяне / сливане (само ако цената е еднаква)
addBtn.addEventListener("click", () => {
  const name = (nameEl.value || "").trim();
  const category = categoryEl.value;
  const unit = unitEl.value;
  const price = parseFloat(priceEl.value);
  const addQty = parseFloat(qtyEl.value);
  const min = parseFloat(minEl.value);

  if (!name || isNaN(price) || isNaN(addQty) || addQty < 0) {
    alert("Моля, въведете валидни 'Продукт', 'Цена' и 'Количество'.");
    return;
  }

  // търсим ред със същото име+категория+единица+цена
  const idx = findItemIndex(name, category, unit, price);

  if (idx >= 0) {
    // същата цена → сливане
    state.items[idx].qty = n(state.items[idx].qty) + n(addQty);
    // по желание може да се актуализира и праг
    if (!isNaN(min)) state.items[idx].min = n(min);
  } else {
    // различна цена или напълно нов артикул → нов ред
    state.items.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
      name, category, unit,
      price: n(price),
      qty: n(addQty),
      sold: 0,
      min: isNaN(min) ? 0 : n(min)
    });
  }

  save();
  nameEl.value = ""; priceEl.value = ""; qtyEl.value = ""; minEl.value = "";
  nameEl.focus();
  render();
});

// Продажба / използване (с отстъпка/бр. и клиент)
sellBtn.addEventListener("click", () => {
  const id = sellItemSel.value;
  const qty = parseFloat(sellQtyEl.value);
  const disc = parseFloat(sellDiscountEl.value);
  const client = (sellClientEl.value || "").trim();

  if (!id || isNaN(qty) || qty <= 0) {
    alert("Моля, изберете артикул и въведете валидно количество.");
    return;
  }
  const it = state.items.find(x => x.id === id);
  if (!it) return;

  const remain = n(it.qty) - n(it.sold);
  if (qty > remain) {
    if (!confirm(`Искате да продадете ${qty}, но налични са ${remain.toFixed(2)}. Продължаваме ли?`)) return;
  }

  const discountPerUnit = isNaN(disc) || disc < 0 ? 0 : n(disc);
  const finalUnitPrice = Math.max(0, n(it.price) - discountPerUnit);
  const total = n(qty) * finalUnitPrice;

  // приспадаме от наличностите
  it.sold = n(it.sold) + n(qty);

  // запис в дневник
  state.sales.push({
    datetime: nowStr(),
    id: it.id,
    name: it.name,
    category: it.category,
    unit: it.unit,
    price: n(it.price),
    qty: n(qty),
    discountPerUnit,
    finalUnitPrice,
    total,
    client: client || ""
  });

  save();
  sellQtyEl.value = ""; sellDiscountEl.value = ""; sellClientEl.value = "";
  render();
});

// Бързи корекции по таблицата (+/-) – без отстъпки, просто вход/изход 1 ед.
function adjustStock(it, delta){
  if (delta > 0) {
    it.qty = n(it.qty) + delta; // вход
  } else if (delta < 0) {
    const remain = n(it.qty) - n(it.sold);
    if (remain < 1 && !confirm("Няма наличност. Все пак да отчетем изход?")) return;
    it.sold = Math.max(0, n(it.sold) + 1); // изход 1 ед.
    // запис в дневник (без отстъпка, без клиент)
    state.sales.push({
      datetime: nowStr(),
      id: it.id,
      name: it.name,
      category: it.category,
      unit: it.unit,
      price: n(it.price),
      qty: 1,
      discountPerUnit: 0,
      finalUnitPrice: n(it.price),
      total: n(it.price),
      client: ""
    });
  }
  save(); render();
}

// Редакция / Изтриване
function editItem(it){
  const name = prompt("Продукт:", it.name); if (name===null) return;
  const category = prompt("Категория (точно):", it.category); if (category===null) return;
  const unit = prompt("Единица (бр/кг/л):", it.unit); if (unit===null) return;

  const price = parseFloat(prompt("Цена (лв/ед.):", it.price)); if (isNaN(price)) return alert("Невалидна цена.");
  const qty = parseFloat(prompt("Налични (вход):", it.qty)); if (isNaN(qty)) return alert("Невалидно количество.");
  const sold = parseFloat(prompt("Продадени/използвани:", it.sold || 0)); if (isNaN(sold)) return alert("Невалидни продадени.");
  const min = parseFloat(prompt("Мин. праг:", it.min || 0));

  it.name = name.trim();
  it.category = category.trim();
  it.unit = unit.trim();
  it.price = n(price);
  it.qty = n(qty);
  it.sold = n(sold);
  it.min = isNaN(min) ? 0 : n(min);
  save(); render();
}
function delItem(it){
  if (!confirm(`Да изтрия „${it.name}“ (цена ${n(it.price).toFixed(2)} лв)?`)) return;
  state.items = state.items.filter(x => x.id !== it.id);
  save(); render();
}

// Филтри/търсене
searchEl.addEventListener("input", render);
filterCategoryEl.addEventListener("change", render);

// Експорт към Excel (два листа, с отстъпка и клиент)
document.getElementById("exportExcel").addEventListener("click", () => {
  try {
    if (typeof XLSX !== "undefined" && XLSX?.utils) {
      const rowsInv = state.items.map((it, i) => {
        const remain = n(it.qty) - n(it.sold);
        return {
          "#": i+1,
          "Продукт": it.name,
          "Категория": it.category,
          "Ед.": it.unit,
          "Цена": n(it.price),
          "Налични": n(it.qty),
          "Продадени": n(it.sold),
          "Останали": n(remain),
          "Стойност": n(remain * n(it.price)),
          "Мин. праг": n(it.min || 0)
        };
      });
      const wsInv = XLSX.utils.json_to_sheet(rowsInv);

      const rowsSales = state.sales.map((s, i) => ({
        "#": i+1,
        "Дата/час": s.datetime,
        "Клиент": s.client || "",
        "Продукт": s.name,
        "Категория": s.category,
        "Кол-во": n(s.qty),
        "Ед.": s.unit,
        "Ед. цена": n(s.price),
        "Отстъпка/бр.": n(s.discountPerUnit || 0),
        "Крайна/бр.": n(s.finalUnitPrice),
        "Общо": n(s.total)
      }));
      const wsSales = XLSX.utils.json_to_sheet(rowsSales.length ? rowsSales : [{ "Дата/час":"—" }]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsInv, "Наличности");
      XLSX.utils.book_append_sheet(wb, wsSales, "Продажби");
      XLSX.writeFile(wb, "inventory.xlsx");
    } else {
      exportCSV();
    }
  } catch(e){
    console.error(e);
    exportCSV();
  }
});

function exportCSV(filename="inventory.csv"){
  const headersInv = ["#","Продукт","Категория","Ед.","Цена","Налични","Продадени","Останали","Стойност","Мин. праг"];
  const linesInv = [headersInv.join(",")];
  state.items.forEach((it, i) => {
    const remain = n(it.qty) - n(it.sold);
    const row = [
      i+1, it.name, it.category, it.unit,
      n(it.price).toFixed(2),
      n(it.qty).toFixed(2),
      n(it.sold).toFixed(2),
      n(remain).toFixed(2),
      (remain * n(it.price)).toFixed(2),
      n(it.min || 0).toFixed(2)
    ];
    linesInv.push(row.map(csvEscape).join(","));
  });

  const headersSales = ["#","Дата/час","Клиент","Продукт","Категория","Кол-во","Ед.","Ед. цена","Отстъпка/бр.","Крайна/бр.","Общо"];
  const linesSales = [headersSales.join(",")];
  state.sales.forEach((s, i) => {
    const row = [
      i+1, s.datetime, s.client || "", s.name, s.category,
      n(s.qty).toFixed(2), s.unit,
      n(s.price).toFixed(2),
      n(s.discountPerUnit || 0).toFixed(2),
      n(s.finalUnitPrice).toFixed(2),
      n(s.total).toFixed(2)
    ];
    linesSales.push(row.map(csvEscape).join(","));
  });

  const csv = [
    "НАЛИЧНОСТИ", ...linesInv, "",
    "ПРОДАЖБИ", ...linesSales
  ].join("\n");

  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v){
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}

// Старт
render();


