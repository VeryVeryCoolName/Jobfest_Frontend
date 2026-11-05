const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { implForWrapper } = require("jsdom/lib/generated/idl/utils.js");

const root = path.join(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup(page = "index.html", config = {}) {
  const dom = new JSDOM(read(page), { url: `https://example.test/jobfest/${page}`, runScripts: "outside-only" });
  const { window } = dom;
  window.matchMedia = () => ({ matches: true });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const file of ["config.js", "api.js", "formulare.js"]) window.eval(read(file));
  window.jobfestConfig = { ...window.jobfestConfig, ...config };
  window.eval(read("api.js"));
  window.eval(read(page === "index.html" ? "inscriere.js" : "feedback.js"));
  const document = window.document;
  const form = document.querySelector("form");
  const field = name => form.querySelector(`[name="${name}"]`);
  const set = (name, value) => {
    const input = field(name);
    input.value = value;
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    return input;
  };
  const check = (name, value) => {
    const input = [...form.querySelectorAll(`[name="${name}"]`)].find(input => value === undefined || input.value === value);
    input.checked = true;
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    return input;
  };
  const next = () => [...form.querySelectorAll("button")].find(button => button.textContent === "Next").click();
  const submit = () => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const step = () => [...form.querySelectorAll(".registration-step")].findIndex(group => !group.hidden);
  const upload = (name = "cv.pdf", content = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF", type = "application/pdf") => {
    const input = field("cv");
    const files = implForWrapper(input.files);
    files.length = 0;
    files.push(implForWrapper(new window.File([content], name, { type })));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  const advance = () => {
    set("nume", "  Popescu  ");
    set("prenume", " Ana ");
    set("email", "ana@example.test");
    next();
    check("zile");
    check("facultate", "CSIE");
    check("an", "2");
    next();
    upload();
  };
  return { dom, window, document, form, field, set, check, next, submit, step, advance, upload };
}

function response(data, ok = true) {
  return { ok, text: async () => JSON.stringify(data) };
}

test("spațiile și adresele de e-mail incomplete blochează primul pas cu un mesaj", () => {
  const app = setup();
  app.set("nume", "   ");
  app.set("prenume", "Ana");
  app.set("email", "ana@example.test");
  app.next();
  assert.equal(app.step(), 0);
  assert.equal(app.document.activeElement, app.field("nume"));
  assert.match(app.field("nume").validationMessage, /Completează/);
  app.set("nume", "Popescu");
  app.set("email", "ana@example");
  app.next();
  assert.equal(app.step(), 0);
  assert.match(app.field("email").validationMessage, /e-mail/);
  app.dom.window.close();
});

test("Enter avansează doar pasul curent și mută focusul fără a trimite date", () => {
  const app = setup();
  app.set("nume", "Popescu");
  app.set("prenume", "Ana");
  app.set("email", "ana@example.test");
  app.window.fetch = () => assert.fail("Nu trebuie trimise date în primul pas.");
  app.submit();
  assert.equal(app.step(), 1);
  assert.equal(app.document.activeElement, app.field("zile"));
  app.next();
  assert.equal(app.step(), 1);
  assert.match(app.field("zile").validationMessage, /opțiune/);
  app.dom.window.close();
});

test("facultatea alternativă este validată și bifată la completare", () => {
  const app = setup();
  app.set("nume", "Popescu");
  app.set("prenume", "Ana");
  app.set("email", "ana@example.test");
  app.next();
  app.check("zile");
  const other = app.check("facultate", "alta");
  app.check("an", "1");
  app.next();
  assert.equal(app.step(), 1);
  assert.equal(app.document.activeElement, app.field("facultate_alta"));
  app.set("facultate_alta", "  Arhitectură  ");
  assert.ok(other.checked);
  app.next();
  assert.equal(app.step(), 2);
  app.dom.window.close();
});

test("înscrierea trimite contractul backendului și se resetează numai după succes", async () => {
  const app = setup();
  app.advance();
  app.set("sursa", "  Instagram  ");
  let request;
  app.window.fetch = async (url, options) => {
    request = { url, options };
    return response({ ok: true, mesaj: "Înscriere salvată", id: 7 });
  };
  app.submit();
  await settle();
  assert.equal(request.url, "/api/inscriere");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["Content-Type"], undefined);
  assert.ok(request.options.body instanceof app.window.FormData);
  assert.equal(request.options.body.get("cv").name, "cv.pdf");
  assert.deepEqual(JSON.parse(request.options.body.get("date")), {
    nume: "Popescu", prenume: "Ana", email: "ana@example.test",
    zile: ["4 martie (CSIE, REI, FABBV)"], facultate: ["CSIE"], an: "2", sursa: "Instagram"
  });
  assert.equal(app.step(), 0);
  assert.equal(app.field("nume").value, "");
  assert.equal(app.document.querySelector('[role="status"]').textContent, "Înscriere salvată");
  assert.equal(app.form.getAttribute("aria-busy"), null);
  app.dom.window.close();
});

test("cererile duble sunt blocate, iar datele rămân completate la eroarea serverului", async () => {
  const app = setup();
  app.advance();
  let requests = 0;
  let finish;
  app.window.fetch = () => {
    requests++;
    return new Promise(resolve => { finish = resolve; });
  };
  app.submit();
  app.submit();
  assert.equal(requests, 1);
  assert.ok(app.form.querySelector('[type="submit"]').disabled);
  assert.ok(app.field("nume").disabled);
  finish(response({ eroare: "Eroare la salvare." }, false));
  await settle();
  assert.equal(app.field("nume").value, "  Popescu  ");
  assert.equal(app.step(), 2);
  assert.equal(app.document.querySelector('[role="status"]').dataset.state, "error");
  assert.ok(!app.form.querySelector('[type="submit"]').disabled);
  assert.ok(!app.field("nume").disabled);
  app.dom.window.close();
});

test("validarea finală redeschide pasul unui câmp invalid ascuns", () => {
  const app = setup();
  app.advance();
  app.field("nume").value = " ";
  app.window.fetch = () => assert.fail("Nu trebuie trimise date invalide.");
  app.submit();
  assert.equal(app.step(), 0);
  assert.equal(app.document.activeElement, app.field("nume"));
  app.dom.window.close();
});

test("limitele de lungime și valorile alternative respectă backendul", async () => {
  const app = setup();
  app.set("nume", "x".repeat(101));
  app.set("prenume", "Ana");
  app.set("email", "ana@example.test");
  app.next();
  assert.equal(app.step(), 0);
  app.set("nume", "Popescu");
  app.next();
  app.check("zile");
  app.set("facultate_alta", "Arhitectură");
  app.check("an", "3");
  app.next();
  let payload;
  app.window.fetch = async (url, options) => {
    payload = JSON.parse(options.body.get("date"));
    return response({ ok: true });
  };
  app.set("sursa", "x".repeat(501));
  app.submit();
  assert.equal(payload, undefined);
  app.set("sursa", "Colegi");
  app.upload();
  app.submit();
  await settle();
  assert.deepEqual(payload.facultate, ["Altă: Arhitectură"]);
  assert.equal(app.field("facultate_alta").maxLength, 100);
  assert.equal(app.field("email").maxLength, 254);
  app.dom.window.close();
});

test("feedbackul nu pretinde că salvează date când backendul nu oferă o rută", () => {
  const app = setup("pag3.html", { feedbackEndpoint: "" });
  assert.ok(app.document.querySelector(".form-notice"));
  assert.ok(app.form.querySelector('[type="submit"]').disabled);
  app.window.fetch = () => assert.fail("Nu există un endpoint de feedback configurat.");
  app.submit();
  assert.ok(app.document.querySelector('[role="status"]').hidden);
  app.dom.window.close();
});

test("feedbackul configurat păstrează anonimatul și trimite ratinguri numerice", async () => {
  const app = setup("pag3.html", { feedbackEndpoint: "/api/feedback" });
  app.check("general", "5");
  app.check("recomandare", "4");
  app.check("zile");
  let request;
  app.window.fetch = async (url, options) => {
    request = { url, data: JSON.parse(options.body) };
    return response({ ok: true });
  };
  app.submit();
  await settle();
  assert.equal(request.url, "/api/feedback");
  assert.equal(request.data.email, "");
  assert.equal(request.data.general, 5);
  assert.equal(request.data.recomandare, 4);
  assert.equal(request.data.locatie, null);
  assert.equal(app.document.querySelector('[role="status"]').dataset.state, "success");
  app.dom.window.close();
});

test("API-ul suportă o adresă separată și răspunsuri invalide sau erori de rețea", async () => {
  const app = setup("index.html", { apiBaseUrl: "http://localhost:3000/" });
  let url;
  app.window.fetch = async target => { url = target; return response({ ok: true }); };
  await app.window.jobfestApi.post("/api/inscriere", {});
  assert.equal(url, "http://localhost:3000/api/inscriere");
  app.window.fetch = async () => ({ ok: false, text: async () => "<!DOCTYPE html>" });
  await assert.rejects(app.window.jobfestApi.post("/api/inscriere", {}), /răspuns valid/);
  app.window.fetch = async () => response({ eroare: "Date invalide." });
  await assert.rejects(app.window.jobfestApi.post("/api/inscriere", {}), /Date invalide/);
  app.window.fetch = async () => { throw new app.window.TypeError("Failed to fetch"); };
  await assert.rejects(app.window.jobfestApi.post("/api/inscriere", {}), /Conexiunea/);
  app.window.fetch = async () => { throw new app.window.DOMException("Aborted", "AbortError"); };
  await assert.rejects(app.window.jobfestApi.post("/api/inscriere", {}), /nu a putut fi confirmată/);
  app.dom.window.close();
});

test("taburile asociației funcționează și cu tastatura", () => {
  const dom = new JSDOM(read("index.html"), { url: "https://example.test/index.html", runScripts: "outside-only" });
  dom.window.eval(read("navigatie.js"));
  const tabs = [...dom.window.document.querySelectorAll('[role="tab"]')];
  tabs[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(tabs[1].getAttribute("aria-selected"), "true");
  assert.equal(dom.window.document.activeElement, tabs[1]);
  assert.ok(dom.window.document.getElementById("membri").hidden);
  assert.ok(!dom.window.document.getElementById("sponsori").hidden);
  tabs[2].click();
  assert.ok(!dom.window.document.getElementById("contact").hidden);
  dom.window.close();
});

test("toate resursele locale există cu capitalizarea exactă, inclusiv într-un subdirector", () => {
  function exact(relative) {
    let directory = root;
    for (const part of relative.split("/")) {
      assert.ok(fs.readdirSync(directory).includes(part), `Resursă inexistentă: ${relative}`);
      directory = path.join(directory, part);
    }
  }
  for (const page of ["index.html", "pag2.html", "pag3.html"]) {
    const dom = new JSDOM(read(page));
    const document = dom.window.document;
    assert.equal(document.documentElement.lang, "ro");
    assert.equal(document.querySelectorAll("title").length, 1);
    assert.equal(document.querySelectorAll('meta[name="viewport"]').length, 1);
    const ids = [...document.querySelectorAll("[id]")].map(node => node.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.ok(!/\s/.test(id));
    for (const node of document.querySelectorAll("[src], [href]")) {
      const value = node.getAttribute("src") || node.getAttribute("href");
      if (/^(https?:|mailto:|tel:)/.test(value)) continue;
      if (value.startsWith("#")) {
        assert.ok(document.getElementById(value.slice(1)), `Ancoră lipsă: ${value}`);
        continue;
      }
      assert.ok(!value.startsWith("/"), `Cale absolută: ${value}`);
      const [file, fragment] = value.split("#");
      exact(decodeURIComponent(file));
      if (fragment) {
        const target = new JSDOM(read(file));
        assert.ok(target.window.document.getElementById(fragment));
        target.window.close();
      }
    }
    dom.window.close();
  }
  for (const match of read("style.css").matchAll(/url\(["']?([^"')]+)["']?\)/g)) exact(match[1]);
});

test("CV-ul este obligatoriu și respinge fișierele goale, prea mari sau de alt tip", () => {
  const app = setup();
  app.advance();
  const files = implForWrapper(app.field("cv").files);
  files.length = 0;
  assert.equal(app.field("cv").required, true);
  app.window.fetch = () => assert.fail("CV-ul invalid nu trebuie trimis.");
  app.submit();
  assert.match(app.field("cv").validationMessage, /Încarcă un CV/);
  assert.equal(app.document.activeElement, app.field("cv"));
  app.upload("cv.doc", "text", "application/msword");
  app.submit();
  assert.match(app.field("cv").validationMessage, /format PDF/);
  app.upload("cv.pdf", "");
  app.submit();
  assert.match(app.field("cv").validationMessage, /gol/);
  app.upload("cv.pdf", "x".repeat(5 * 1024 * 1024 + 1));
  app.submit();
  assert.match(app.field("cv").validationMessage, /5 MB/);
  app.dom.window.close();
});

test("eroarea serverului păstrează și CV-ul selectat", async () => {
  const app = setup();
  app.advance();
  app.window.fetch = async () => response({ eroare: "Încărcarea a eșuat." }, false);
  app.submit();
  await settle();
  assert.equal(app.field("cv").files[0].name, "cv.pdf");
  assert.equal(app.document.querySelector('[role="status"]').dataset.state, "error");
  app.dom.window.close();
});

test("timeoutul configurat anulează o singură cerere și păstrează datele formularului", async () => {
  const app = setup("index.html", { requestTimeoutMs: 5 });
  app.advance();
  let requests = 0;
  app.window.fetch = (_url, options) => {
    requests++;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new app.window.DOMException("Timeout", "AbortError")), { once: true }));
  };
  app.submit();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(requests, 1);
  assert.equal(app.field("nume").value, "  Popescu  ");
  assert.equal(app.field("cv").files[0].name, "cv.pdf");
  assert.match(app.document.querySelector('[role="status"]').textContent, /nu a putut fi confirmată/);
  assert.equal(app.form.getAttribute("aria-busy"), null);
  app.dom.window.close();
});

test("navigarea la secțiuni și linkurile vechi păstrează URL-ul fără fragment", () => {
  const dom = new JSDOM(read("index.html"), { url: "https://example.test/index.html#home", runScripts: "outside-only" });
  let destination;
  dom.window.matchMedia = () => ({ matches: true });
  dom.window.HTMLElement.prototype.scrollIntoView = function () { destination = this.id; };
  dom.window.eval(read("navigatie.js"));
  assert.equal(dom.window.location.hash, "");
  assert.equal(destination, "home");
  const link = dom.window.document.querySelector('a[href="index.html"]:not(.skip-link)');
  link.click();
  assert.equal(dom.window.location.hash, "");
  assert.equal(destination, "home");
  assert.equal(dom.window.document.activeElement.id, "home");
  dom.window.close();
});

test("navigarea între pagini transmite secțiunea prin sessionStorage, fără # în link", () => {
  const dom = new JSDOM(read("pag2.html"), { url: "https://example.test/pag2.html", runScripts: "outside-only" });
  dom.window.eval(read("navigatie.js"));
  const link = [...dom.window.document.querySelectorAll("a")].find(node => node.textContent.includes("Înscrie-te"));
  assert.equal(link.hash, "");
  link.addEventListener("click", event => event.preventDefault());
  link.click();
  assert.deepEqual(JSON.parse(dom.window.sessionStorage.getItem("jobfest-navigation")), { path: "/index.html", id: "inscriere" });
  dom.window.close();
  const next = new JSDOM(read("index.html"), { url: "https://example.test/index.html", runScripts: "outside-only" });
  next.window.sessionStorage.setItem("jobfest-navigation", JSON.stringify({ path: "/index.html", id: "inscriere" }));
  next.window.matchMedia = () => ({ matches: true });
  next.window.HTMLElement.prototype.scrollIntoView = function () {};
  next.window.eval(read("navigatie.js"));
  assert.equal(next.window.document.activeElement.id, "inscriere");
  assert.equal(next.window.location.hash, "");
  next.window.close();
});
