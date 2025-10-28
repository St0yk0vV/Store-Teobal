// Категории според зададените
const CATEGORIES = ["Хамони","Кашкавали","Турони","Вино","Други хранителни","Други нехранителни"];
const LS_KEY = "inventory_v1";

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

// Състояние
let items = load() || [];

// Полезни
function n(v){ return Number(v || 0); }
function money(v){ return n(v).toFixed(2) + " лв"; }
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(items)); }
function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY)||"[]"); } catch { return []; } }

// Рендер таблица
function render(){
  const term = (searchEl.value || "").toLowerCase().trim();
  const cat = filterCategoryEl.value || "";

  const filtered = items.filter(it => {
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
      btn("+", "action-btn action-plus", () => adjustSold(it, -1)), // -1 sold = добавяме наличност чрез корекция
      space(),
      btn("−", "action-btn action-minus", () => adjustSold(it, +1)), // +1 sold = изход
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

function td(text){ const d=document.createElement("td"); d.textContent=String(text); return d; }
function btn(text, cls, onClick){ const b=document.createElement("button"); b.textContent=text; b.className=cls; b.onclick=onClick; return b; }
function space(){ return document.createTextNode(" "); }

// Добавяне
addBtn.addEventListener("click", () => {
  const name = (nameEl.value || "").trim();
  const category = categoryEl.value;
  const unit = unitEl.value;
  const price = parseFloat(priceEl.value);
  const qty = parseFloat(qtyEl.value);
  const min = parseFloat(minEl.value);

  if (!name || isNaN(price) || isNaN(qty)) {
    alert("Моля, въведете валидни 'Продукт', 'Цена' и 'Налични'.");
    return;
  }
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
    name, category, unit,
    price: n(price), qty: n(qty),
    sold: 0,
    min: isNaN(min) ? 0 : n(min)
  };
  items.push(item);
  save();
  clearForm();
  render();
});
function clearForm(){
  nameEl.value = "";
  priceEl.value = "";
  qtyEl.value = "";
  minEl.value = "";
  nameEl.focus();
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
  const min = parseFloat(prompt("Мин. праг:", it.min || 0)); // може да е празно

  it.name = name.trim();
  it.category = category.trim();
  it.unit = unit.trim();
  it.price = n(price);
  it.qty = n(qty);
  it.min = isNaN(min) ? 0 : n(min);
  save(); render();
}

// Изтриване
function delItem(it){
  if (!confirm(`Да изтрия „${it.name}“?`)) return;
  items = items.filter(x => x.id !== it.id);
  save(); render();
}

// Корекция продадени/използвани
function adjustSold(it, delta){
  const newSold = n(it.sold) + delta;
  if (newSold < 0) return; // не допускаме отрицателни
  if (newSold > n(it.qty)) {
    if (!confirm("Продаденото надхвърля първоначално наличното. Все пак ли?")) return;
  }
  it.sold = newSold;
  save(); render();
}

// Филтри
searchEl.addEventListener("input", render);
filterCategoryEl.addEventListener("change", render);

// Експорт към Excel (+ CSV fallback)
exportBtn.addEventListener("click", () => {
  try {
    if (typeof XLSX !== "undefined" && XLSX?.utils) {
      const rows = items.map((it, i) => {
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
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Наличности");
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
  const headers = ["#","Продукт","Категория","Ед.","Цена","Налични","Продадени","Останали","Стойност","Мин. праг"];
  const lines = [headers.join(",")];
  items.forEach((it, i) => {
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
    lines.push(row.map(csvEscape).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function csvEscape(v){
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}

// Изчистване на всичко
clearAllBtn.addEventListener("click", () => {
  if (!confirm("Сигурни ли сте, че искате да изтриете всички артикули?")) return;
  items = []; save(); render();
});

// Първоначално
render();
