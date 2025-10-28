// Категории според зададените
const CATEGORIES = ["Хамони","Кашкавали","Турони","Вино","Други хранителни","Други нехранителни"];
const LS_KEY = "inventory_v2"; // нов ключ (ако искаш да запазиш старите данни, прехвърли ги ръчно)

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
const sellBtn = document.getElementById("sellBtn");
const salesBody = document.getElementById("salesBody");

// Състояние
let state = load() || { items: [], sales: [] }; // items[], sales[]

// Помощни
function n(v){ return Number(v || 0); }
function money(v){ return n(v).toFixed(2) + " лв"; }
function nowStr(){ return new Date().toLocaleString('bg-BG', { hour12:false }); }

function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || ""); } catch { return null; } }

// Нормализиране за сравнение (за сливане на артикули)
function norm(s){ return String(s||"").trim().toLowerCase(); }

// Намира артикул по ключ: име+категория+единица
function findItemIndex(name, category, unit){
  const N = norm(name), C = norm(category), U = norm(unit);
  return state.items.findIndex(it => norm(it.name)===N && norm(it.category)===C && norm(it.unit)===U);
}

// Рендер на таблица и продажби
function render(){
  renderInventoryTable();
  renderSellOptions();
  renderSalesLog();
}

function renderInventoryTable(){
  const term = (searchEl.value || "").toLowerCase().trim();
  const cat = filterCategoryEl.value || "";

  const filtered = state.items.filter(it => {
    const matchesText = !term || it.name.toLowerCase().includes(term);
    const matchesCat = !cat || it.category === cat;
    return matchesText && matchesCat;
  });

  tbody.innerHTML = "";
  let totalValue = 0;

  filtered.forEach((it, i) => {
    const remain = n(it.qty) - n(it.sold);
    const value = remain * n(it.price);
    totalValue += value;

    const tr = document.createElement("tr");

    const tdIdx = td(i+1);
    const tdName = td(it.name);
    const tdCat = td(it.category);
    const tdUnit = td(it.unit);
    const tdPrice = td(money(it.price));
    const tdQty = td(n(it.qty).toFixed(2));
    const tdSold = td(n(it.sold).toFixed(2));
    const tdRemain = td(n(remain).toFixed(2));
    const tdValue = td(money(value));
    const tdMin = td(n(it.min || 0).toFixed(2));

    // маркиране под прага
    if (remain < n(it.min || 0)) {
      tdRemain.innerHTML = `<span class="badge-low">${tdRemain.textContent}</span>`;
    }

    // действия
    const tdActions = document.createElement("td");
    tdActions.append(
      btn("+", "action-btn action-plus", () => adjustStock(it, +1)),   // добавя наличности (бърза корекция)
      space(),
      btn("−", "action-btn action-minus", () => adjustStock(it, -1)),  // отнема наличности (бърза корекция)
      space(),
      btn("✎", "action-btn action-edit", () => editItem(it)),
      space(),
      btn("🗑", "action-btn action-del", () => delItem(it))
    );

    tr.append(tdIdx, tdName, tdCat, tdUnit, tdPrice, tdQty, tdSold, tdRemain, tdValue, tdMin, tdActions);
    tbody.appendChild(tr);
  });

  totalsEl.textContent = `Обща стойност: ${money(totalValue)}`;
}

function renderSellOptions(){
  // списък за продажби – показва името + (категория/ед.)
  sellItemSel.innerHTML = "";
  state.items
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name,'bg'))
    .forEach(it => {
      const remain = n(it.qty) - n(it.sold);
      const opt = document.createElement("option");
      opt.value = it.id;
      opt.textContent = `${it.name} — ${it.category} (${it.unit}) · останали: ${remain.toFixed(2)}`;
      sellItemSel.appendChild(opt);
    });
}

function renderSalesLog(){
  salesBody.innerHTML = "";
  // показваме последните 30 записа, най-новите отгоре
  const last = state.sales.slice(-30).reverse();
  last.forEach(rec => {
    const tr = document.createElement("tr");
    tr.append(
      td(rec.datetime),
      td(rec.name),
      td(rec.category),
      td(n(rec.qty).toFixed(2)),
      td(rec.unit),
      td(money(rec.price)),
      td(money(n(rec.qty)*n(rec.price)))
    );
    salesBody.appendChild(tr);
  });
}

function td(text){ const d=document.createElement("td"); d.textContent=String(text); return d; }
function btn(text, cls, onClick){ const b=document.createElement("button"); b.textContent=text; b.className=cls; b.onclick=onClick; return b; }
function space(){ return document.createTextNode(" "); }

// Добавяне / сливане
addBtn.addEventListener("click", () => {
  const name = (nameEl.value || "").trim();
  const category = categoryEl.value;
  const unit = unitEl.value;
  const price = parseFloat(priceEl.value);
  const addQty = parseFloat(qtyEl.value);
  const min = parseFloat(minEl.value);

  if (!name || isNaN(price) || isNaN(addQty) || addQty < 0) {
    alert("Моля, въведете валидни 'Продукт', 'Цена' и 'Количество за добавяне'.");
    return;
  }

  // търсим съществуващ артикул по ключ име+категория+единица
  const idx = findItemIndex(name, category, unit);

  if (idx >= 0) {
    // вече има такъв артикул → увеличаваме наличността и евентуално актуализираме цена/праг
    state.items[idx].qty = n(state.items[idx].qty) + n(addQty);
    if (!isNaN(min)) state.items[idx].min = n(min);     // по желание – обнови прага
    if (!isNaN(price)) state.items[idx].price = n(price); // ако се е променила цена
  } else {
    // нов артикул
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
  clearAddForm();
  render();
});
function clearAddForm(){
  nameEl.value = "";
  priceEl.value = "";
  qtyEl.value = "";
  minEl.value = "";
  nameEl.focus();
}

// Продажба / използване
sellBtn.addEventListener("click", () => {
  const id = sellItemSel.value;
  const qty = parseFloat(sellQtyEl.value);
  if (!id || isNaN(qty) || qty <= 0) {
    alert("Моля, изберете артикул и въведете валидно количество.");
    return;
  }
  const it = state.items.find(x => x.id === id);
  if (!it) return;

  const remain = n(it.qty) - n(it.sold);
  if (qty > remain) {
    if (!confirm(`Искате да продадете ${qty}, но налични са само ${remain.toFixed(2)}. Продължаваме ли?`)) {
      return;
    }
  }

  it.sold = n(it.sold) + n(qty);

  // запис в дневник
  state.sales.push({
    datetime: nowStr(),
    id: it.id,
    name: it.name,
    category: it.category,
    unit: it.unit,
    price: n(it.price),
    qty: n(qty)
  });

  save();
  sellQtyEl.value = "";
  render();
});

// Бърза корекция на наличности (+/-)
function adjustStock(it, delta){
  // delta = +1 добавя към qty (вход), delta = -1 увеличава sold (изход)
  if (delta > 0) {
    it.qty = n(it.qty) + delta;
  } else if (delta < 0) {
    const remain = n(it.qty) - n(it.sold);
    if (remain < 1 && !confirm("Няма наличност. Все пак да отчетем изход?")) return;
    it.sold = Math.max(0, n(it.sold) + Math.abs(delta));
    // дневник и за тези корекции
    state.sales.push({
      datetime: nowStr(),
      id: it.id,
      name: it.name,
      category: it.category,
      unit: it.unit,
      price: n(it.price),
      qty: 1
    });
  }
  save(); render();
}

// Редакция
function editItem(it){
  const name = prompt("Продукт:", it.name);
  if (name===null) return;

  const category = prompt("Категория (точно):", it.category);
  if (category===null) return;

  const unit = prompt("Единица (бр/кг/л):", it.unit);
  if (unit===null) return;

  const price = parseFloat(prompt("Цена (лв/ед.):", it.price));
  if (isNaN(price)) return alert("Невалидна цена.");

  const qty = parseFloat(prompt("Налични (вход):", it.qty));
  if (isNaN(qty)) return alert("Невалидно количество.");

  const sold = parseFloat(prompt("Продадени/използвани:", it.sold || 0));
  if (isNaN(sold)) return alert("Невалидни продадени.");

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

// Изтриване
function delItem(it){
  if (!confirm(`Да изтрия „${it.name}“?`)) return;
  state.items = state.items.filter(x => x.id !== it.id);
  // по желание можеш да изтриеш и свързаните продажби; тук ги оставяме като архив
  save(); render();
}

// Филтри и търсене
searchEl.addEventListener("input", render);
filterCategoryEl.addEventListener("change", render);

// Експорт към Excel (два листа: Наличности + Продажби) + CSV fallback
exportBtn.addEventListener("click", () => {
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
        "Продукт": s.name,
        "Категория": s.category,
        "Кол-во": n(s.qty),
        "Ед.": s.unit,
        "Ед. цена": n(s.price),
        "Стойност": n(s.qty)*n(s.price)
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

  const headersSales = ["#","Дата/час","Продукт","Категория","Кол-во","Ед.","Ед. цена","Стойност"];
  const linesSales = [headersSales.join(",")];
  state.sales.forEach((s, i) => {
    const row = [
      i+1, s.datetime, s.name, s.category,
      n(s.qty).toFixed(2), s.unit,
      n(s.price).toFixed(2),
      (n(s.qty)*n(s.price)).toFixed(2)
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

