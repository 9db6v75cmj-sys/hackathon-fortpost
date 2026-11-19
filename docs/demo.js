"use strict";

const statuses = {
  planned: "Заплановано",
  review: "На перевірці",
  revision: "Потребує доопрацювання",
  confirmed: "Підтверджено",
};

const initialMeasures = [
  {
    id: "procurement",
    name: "Моніторинг цін перед закупівлею",
    risk: "Середній",
    department: "Відділ закупівель",
    deadline: "2027-12-12",
    indicator: "Порівняння цін у пропозиціях",
    status: "planned",
  },
  {
    id: "conflict",
    name: "Перевірка конфлікту інтересів",
    risk: "Низький",
    department: "Відділ організації освітнього процесу",
    deadline: "2027-09-30",
    indicator: "Довідка за результатами перевірки",
    status: "confirmed",
  },
  {
    id: "survey",
    name: "Анкетування здобувачів",
    risk: "Середній",
    department: "Відділ організації освітнього процесу",
    deadline: "2027-12-15",
    indicator: "Звіт за результатами анкетування",
    status: "planned",
  },
  {
    id: "inventory",
    name: "Інвентаризація",
    risk: "Низький",
    department: "Господарський відділ",
    deadline: "2027-12-20",
    indicator: "Акт інвентаризації",
    status: "planned",
  },
];

const evidenceSamples = {
  initial: {
    title: "Первинне порівняння цін",
    text: "У вигаданому прикладі порівняно дві пропозиції на офісний папір. У таблиці зазначено ціни за пачку.",
  },
  revised: {
    title: "Уточнене порівняння цін",
    text: "До вигаданого порівняння додано дати пропозицій, назви джерел і примітку щодо вартості доставки.",
  },
};
const revisionComment = "Уточніть джерела цін у порівнянні";

const demoDate = document.querySelector("#demo-date").dateTime;
const dateFormatter = new Intl.DateTimeFormat("uk-UA", { dateStyle: "long", timeZone: "UTC" });
const workspace = document.querySelector("#workspace");
const resetButton = document.querySelector("#reset-demo");
const roleSelect = document.querySelector("#demo-role");
const statusFilter = document.querySelector("#status-filter");
const measureList = document.querySelector("#measure-list");
const noMatches = document.querySelector("#no-matches");
const confirmedCount = document.querySelector("#confirmed-count");
const overdueCount = document.querySelector("#overdue-count");
const feedback = document.querySelector("#demo-feedback");

let measures;
let workflowOpen;

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function isOverdue(measure) {
  return measure.status !== "confirmed" && measure.deadline < demoDate;
}

function appendField(fields, label, value) {
  const field = createElement("div");
  const description = createElement("dd");
  description.append(value);
  field.append(createElement("dt", "", label), description);
  fields.append(field);
}

function createButton(label, variant) {
  const button = createElement("button", `button button-${variant}`, label);
  button.type = "button";
  return button;
}

function announceUpdate(message) {
  renderRegistry();
  feedback.textContent = message;
  feedback.focus();
}

function canSubmit(measure) {
  return roleSelect.value === "executor" && ["planned", "revision"].includes(measure.status);
}

function renderSubmission(measure) {
  const form = createElement("form", "workflow-form");
  form.noValidate = true;

  const label = createElement("label", "", "Вигаданий доказ");
  const select = createElement("select");
  select.id = "evidence-sample";
  select.required = true;
  select.setAttribute("aria-describedby", "submission-error");
  label.htmlFor = select.id;
  select.add(new Option("Виберіть зразок", ""));
  for (const [id, sample] of Object.entries(evidenceSamples)) {
    select.add(new Option(sample.title, id));
  }
  const field = createElement("div", "field");
  field.append(label, select);

  const checkbox = createElement("input");
  checkbox.type = "checkbox";
  checkbox.required = true;
  checkbox.setAttribute("aria-describedby", "submission-error");
  const checkboxLabel = createElement("label", "checkbox");
  checkboxLabel.append(checkbox, " Додано аналіз цін");

  const error = createElement("p", "field-error");
  error.id = "submission-error";
  const submit = createButton("Подати на перевірку", "primary");
  submit.type = "submit";

  form.append(field, checkboxLabel, error, submit);
  form.addEventListener("change", () => {
    select.removeAttribute("aria-invalid");
    checkbox.removeAttribute("aria-invalid");
    error.textContent = "";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canSubmit(measure)) return;

    const evidence = evidenceSamples[select.value];
    const invalidField = !evidence ? select : !checkbox.checked ? checkbox : null;
    if (invalidField) {
      error.textContent = invalidField === select
        ? "Виберіть демонстраційний доказ."
        : "Позначте, що додано аналіз цін.";
      invalidField.setAttribute("aria-invalid", "true");
      invalidField.focus();
      return;
    }

    measure.evidence = evidence;
    delete measure.reviewComment;
    measure.status = "review";
    announceUpdate("Доказ подано. Захід на перевірці.");
  });
  return form;
}

function canReview(measure) {
  return roleSelect.value === "reviewer" && measure.status === "review";
}

function renderReviewActions(measure) {
  const actions = createElement("div", "workflow-actions");
  const approve = createButton("Підтвердити захід", "primary");
  const returnForRevision = createButton("Повернути на доопрацювання", "secondary");

  approve.addEventListener("click", () => {
    if (!canReview(measure)) return;
    measure.status = "confirmed";
    announceUpdate("Захід підтверджено.");
  });
  returnForRevision.addEventListener("click", () => {
    if (!canReview(measure)) return;
    measure.status = "revision";
    measure.reviewComment = revisionComment;
    announceUpdate("Захід повернуто на доопрацювання.");
  });
  actions.append(approve, returnForRevision);
  return actions;
}

function renderWorkflow(measure) {
  const panel = createElement("section", "workflow");
  panel.id = "procurement-workflow";
  panel.hidden = !workflowOpen;
  panel.setAttribute("aria-labelledby", "workflow-title");

  const title = createElement("h4", "", "Доказ виконання");
  title.id = "workflow-title";
  title.tabIndex = -1;
  panel.append(title);

  if (measure.reviewComment) {
    const comment = createElement("div", "evidence");
    comment.append(
      createElement("strong", "", "Коментар уповноваженого"),
      createElement("p", "", measure.reviewComment),
    );
    panel.append(comment);
  }

  if (canSubmit(measure)) {
    panel.append(renderSubmission(measure));
  } else if (measure.evidence) {
    const evidence = createElement("div", "evidence");
    evidence.append(createElement("strong", "", measure.evidence.title), createElement("p", "", measure.evidence.text));
    panel.append(evidence);
  } else {
    panel.append(createElement("p", "workflow-note", "Доказ стане доступним після подання в ролі виконавця."));
  }
  if (canReview(measure)) panel.append(renderReviewActions(measure));
  return panel;
}

function renderMeasure(measure) {
  const item = createElement("li");
  const article = createElement("article", "measure");
  article.setAttribute("aria-labelledby", `measure-${measure.id}`);

  const title = createElement("h3", "", measure.name);
  title.id = `measure-${measure.id}`;
  const tags = createElement("div", "tags");
  tags.append(createElement("span", `tag tag-${measure.status}`, statuses[measure.status]));
  if (isOverdue(measure)) {
    tags.append(createElement("span", "tag tag-overdue", "Прострочено"));
  }

  const header = createElement("div", "measure-header");
  header.append(title, tags);

  const fields = createElement("dl", "measure-fields");
  const deadline = createElement("time", "", dateFormatter.format(new Date(measure.deadline)));
  deadline.dateTime = measure.deadline;
  appendField(fields, "Рівень ризику", measure.risk);
  appendField(fields, "Підрозділ", measure.department);
  appendField(fields, "Строк", deadline);
  appendField(fields, "Індикатор", measure.indicator);

  article.append(header, fields);
  if (measure.id === "procurement" && roleSelect.value !== "observer") {
    const panel = renderWorkflow(measure);
    const toggle = createButton(workflowOpen ? "Закрити захід" : "Відкрити захід", "secondary");
    toggle.setAttribute("aria-controls", panel.id);
    toggle.setAttribute("aria-expanded", String(workflowOpen));
    toggle.addEventListener("click", () => {
      workflowOpen = !workflowOpen;
      panel.hidden = !workflowOpen;
      toggle.textContent = workflowOpen ? "Закрити захід" : "Відкрити захід";
      toggle.setAttribute("aria-expanded", String(workflowOpen));
      if (workflowOpen) panel.querySelector("h4").focus();
    });
    article.append(toggle, panel);
  }
  item.append(article);
  return item;
}

function renderRegistry() {
  const filter = statusFilter.value;
  const visible = filter === "all" ? measures : measures.filter((measure) => measure.status === filter);

  confirmedCount.textContent = measures.filter((measure) => measure.status === "confirmed").length;
  overdueCount.textContent = measures.filter(isOverdue).length;
  noMatches.hidden = visible.length > 0;
  measureList.hidden = visible.length === 0;
  measureList.replaceChildren(...visible.map(renderMeasure));
}

function resetDemo() {
  measures = initialMeasures.map((measure) => ({ ...measure }));
  workflowOpen = false;
  statusFilter.value = "all";
  roleSelect.value = "executor";
  feedback.textContent = "";
  renderRegistry();
}

statusFilter.addEventListener("change", renderRegistry);
roleSelect.addEventListener("change", renderRegistry);
resetButton.addEventListener("click", () => {
  resetDemo();
  feedback.textContent = "Початковий стан демо відновлено.";
});

resetDemo();
resetButton.hidden = false;
workspace.hidden = false;
