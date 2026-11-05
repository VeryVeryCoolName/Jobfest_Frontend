(() => {
  const element = (tag, properties = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), properties);
    node.append(...children);
    return node;
  };
  const days = [
    { value: "4 martie (CSIE, REI, FABBV)", label: "4 martie (CSIE, REI, FABBV)" },
    { value: "5 martie (Management, Marketing, FABIZ, BTS)", label: "5 martie (Management, Marketing, FABIZ, BTS)" },
    { value: "6 martie (Drept, ETA, EAM, AMP)", label: "6 martie (Drept, ETA, EAM, AMP)" }
  ];
  const faculties = ["CSIE", "Drept", "CIG", "FABIZ", "REI", "FABBV", "Management", "Marketing", "BTS", "AMP", "ETA", "EAM"];

  function createForm({ questions, title, steps = false, endpoint, successMessage }) {
    const root = document.getElementById("app");
    const card = steps ? element("div", { className: "member-card" }) : root;
    const heading = element("h2", { id: "form-title", className: "sr-only" }, title);
    const form = element("form", { noValidate: true });
    form.setAttribute("aria-labelledby", heading.id);
    const result = element("p", { hidden: true, tabIndex: -1 });
    result.setAttribute("role", "status");
    result.setAttribute("aria-live", "polite");
    result.setAttribute("aria-atomic", "true");
    const groups = [];
    const fields = new Map();
    let current = 0;
    let busy = false;

    for (const [index, question] of questions.entries()) {
      const groupIndex = steps ? Math.floor(index / 3) : 0;
      if (!groups[groupIndex]) groups[groupIndex] = element("div", { className: "registration-step" });
      const group = groups[groupIndex];
      const id = `field-${question.name}`;
      const label = question.label + (question.required ? " *" : "");
      const inputs = [];
      let other;
      let container;

      if (question.options) {
        container = element("fieldset", {}, element("legend", {}, label));
        for (const [optionIndex, option] of question.options.entries()) {
          const value = typeof option === "string" ? option : option.value;
          const text = typeof option === "string" ? option : option.label;
          const input = element("input", { type: question.type, name: question.name, id: `${id}-${optionIndex}`, value });
          inputs.push(input);
          container.append(element("label", { htmlFor: input.id }, input, text), element("br"));
        }
        if (question.other) {
          const checkbox = element("input", { type: "checkbox", name: question.name, id: `${id}-other-option`, value: "alta" });
          other = element("input", { name: `${question.name}_alta`, id: `${id}-other`, maxLength: 100 });
          other.addEventListener("input", () => { checkbox.checked = Boolean(other.value.trim()); });
          inputs.push(checkbox);
          container.append(element("label", { htmlFor: checkbox.id }, checkbox, steps ? "Alta: " : "Altă: "),
            element("label", { htmlFor: other.id, className: "sr-only" }, "Denumirea altei facultăți"), other);
        }
        if (question.type === "radio" && !question.required) {
          const clear = element("button", { type: "button" }, "Șterge selecția");
          clear.addEventListener("click", () => {
            inputs.forEach(input => { input.checked = false; });
            sync();
          });
          container.append(element("br"), clear);
        }
      } else {
        const input = element(question.type === "textarea" ? "textarea" : "input", {
          name: question.name, id, required: Boolean(question.required)
        });
        if (question.type === "textarea") input.rows = 4;
        else input.type = question.type;
        if (question.type === "file") {
          input.accept = question.accept;
          form.enctype = "multipart/form-data";
        } else input.maxLength = question.maxLength || 1000;
        if (question.autocomplete) input.autocomplete = question.autocomplete;
        inputs.push(input);
        container = element("p", {}, element("label", { htmlFor: id }, label), input);
      }
      if (question.description) {
        const description = element(question.options ? "p" : "small", { id: `${id}-description` }, question.description);
        if (question.options) container.firstElementChild.after(description);
        else container.append(element("br"), description);
        inputs.forEach(input => input.setAttribute("aria-describedby", description.id));
      }
      fields.set(question.name, { question, inputs, other, groupIndex });
      group.append(container);
    }

    const progress = element("p", { className: "sr-only" });
    progress.setAttribute("aria-live", "polite");
    const controls = element("div", { className: "registration-controls" });
    const back = element("button", { type: "button" }, "Back");
    const next = element("button", { type: "button" }, "Next");
    const submit = element("button", { type: "submit", disabled: !endpoint }, "Trimite");
    controls.append(back, next, submit);
    form.append(heading, progress, ...groups, controls);
    card.append(form, result);
    if (steps) root.append(card);

    function sync() {
      for (const { question, inputs, other } of fields.values()) {
        inputs.forEach(input => input.setCustomValidity(""));
        if (other) other.setCustomValidity("");
        if (question.options) {
          if (question.required && !inputs.some(input => input.checked)) inputs[0].setCustomValidity("Alege cel puțin o opțiune.");
          if (other && inputs.at(-1).checked && !other.value.trim()) other.setCustomValidity("Completează denumirea facultății.");
        } else if (question.type === "file") {
          const input = inputs[0];
          const file = input.files[0];
          if (!file) input.setCustomValidity("Încarcă un CV în format PDF.");
          else if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) input.setCustomValidity("CV-ul trebuie să fie în format PDF.");
          else if (!file.size) input.setCustomValidity("Fișierul CV este gol.");
          else if (file.size > question.maxSize) input.setCustomValidity("CV-ul poate avea maximum 5 MB.");
        } else {
          const input = inputs[0];
          const value = input.value.trim();
          if (question.required && !value) input.setCustomValidity("Completează acest câmp.");
          else if (value && question.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) input.setCustomValidity("Introdu o adresă de e-mail validă.");
          else if (input.value.length > input.maxLength) input.setCustomValidity(`Folosește cel mult ${input.maxLength} de caractere.`);
        }
      }
    }

    function showStep(index, focus = true) {
      current = index;
      groups.forEach((group, groupIndex) => { group.hidden = groupIndex !== current; });
      progress.hidden = !steps;
      progress.textContent = `Pasul ${current + 1} din ${groups.length}`;
      back.hidden = !steps || current === 0;
      next.hidden = !steps || current === groups.length - 1;
      submit.hidden = steps && current !== groups.length - 1;
      if (focus) {
        groups[current].querySelector("input, textarea")?.focus({ preventScroll: true });
        groups[current].scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }

    function validate(all = false) {
      sync();
      for (const { inputs, other, groupIndex } of fields.values()) {
        if (!all && groupIndex !== current) continue;
        const invalid = [...inputs, ...(other ? [other] : [])].find(input => !input.checkValidity());
        if (invalid) {
          if (groupIndex !== current) showStep(groupIndex, false);
          invalid.focus();
          invalid.reportValidity();
          return false;
        }
      }
      return true;
    }

    function serialize() {
      const data = Object.fromEntries([...fields].filter(([, field]) => field.question.type !== "file").map(([name, { question, inputs, other }]) => {
        const selected = inputs.filter(input => input.checked);
        const value = question.type === "checkbox" ? selected.map(input => input.value === "alta" ? `Altă: ${other.value.trim()}` : input.value)
          : question.type === "radio" ? (selected.length ? (question.numeric ? Number(selected[0].value) : selected[0].value) : null)
            : inputs[0].value.trim();
        return [name, value];
      }));
      const files = [...fields].filter(([, field]) => field.question.type === "file");
      if (!files.length) return data;
      const multipart = new FormData();
      multipart.append("date", JSON.stringify(data));
      for (const [name, { inputs }] of files) multipart.append(name, inputs[0].files[0]);
      return multipart;
    }

    function notify(message, state) {
      result.hidden = false;
      result.dataset.state = state;
      result.textContent = message;
    }

    back.addEventListener("click", () => { if (!busy && current > 0) showStep(current - 1); });
    next.addEventListener("click", () => { if (!busy && validate()) showStep(current + 1); });
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (busy || !endpoint) return;
      if (steps && current < groups.length - 1) {
        if (validate()) showStep(current + 1);
        return;
      }
      if (!validate(true)) return;
      const payload = serialize();
      busy = true;
      form.setAttribute("aria-busy", "true");
      const buttons = [...form.querySelectorAll("button")];
      buttons.forEach(button => { button.disabled = true; });
      const editable = [...form.querySelectorAll("input, textarea")];
      editable.forEach(input => { input.disabled = true; });
      notify("Se trimit datele…", "pending");

      try {
        const response = await window.jobfestApi.post(endpoint, payload);
        form.reset();
        sync();
        showStep(0, false);
        notify(typeof response.mesaj === "string" ? response.mesaj : successMessage, "success");
        result.focus();
      } catch (error) {
        notify(error.message || "Datele nu au putut fi trimise.", "error");
        result.focus();
      } finally {
        busy = false;
        form.removeAttribute("aria-busy");
        buttons.forEach(button => { button.disabled = false; });
        editable.forEach(input => { input.disabled = false; });
      }
    });

    showStep(0, false);
    sync();
    if (!endpoint) {
      form.before(element("p", { className: "form-notice" }, "Trimiterea feedbackului nu este disponibilă momentan. Formularul va fi activat după conectarea la server."));
      form.querySelectorAll("input, textarea, button").forEach(input => { input.disabled = true; });
    }
  }

  window.jobfestForms = Object.freeze({ createForm, days, faculties });
})();
