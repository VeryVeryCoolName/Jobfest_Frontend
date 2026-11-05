(() => {
  const config = window.jobfestConfig || {};

  async function post(endpoint, payload) {
    const controller = new AbortController();
    const multipart = payload instanceof FormData;
    const configuredTimeout = Number(config.requestTimeoutMs || 120000);
    const timeout = window.setTimeout(() => controller.abort(), Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 120000);
    const base = (config.apiBaseUrl || "").replace(/\/$/, "");
    const url = /^https?:\/\//i.test(endpoint) ? endpoint : `${base}/${endpoint.replace(/^\/+/, "")}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: multipart ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
        body: multipart ? payload : JSON.stringify(payload),
        signal: controller.signal
      });
      let result;
      try {
        result = JSON.parse(await response.text());
      } catch {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        throw new Error("Serverul nu a returnat un răspuns valid. Verifică adresa API-ului.");
      }
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("Serverul nu a returnat un răspuns valid.");
      }
      if (!response.ok || result.ok !== true) {
        throw new Error(typeof result.eroare === "string" ? result.eroare : "Datele nu au putut fi salvate. Încearcă din nou mai târziu.");
      }
      return result;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Serverul nu a răspuns la timp. Trimiterea nu a putut fi confirmată.");
      if (error instanceof TypeError) throw new Error("Conexiunea cu serverul nu a putut fi realizată. Verifică conexiunea și adresa API-ului.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  window.jobfestApi = Object.freeze({ post });
})();
