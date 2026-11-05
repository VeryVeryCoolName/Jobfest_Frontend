(() => {
  const { createForm, days, faculties } = window.jobfestForms;
  const ratings = ["1", "2", "3", "4", "5"];
  const rating = (name, label, description = "1 = nemulțumit, 5 = foarte mulțumit") => ({ name, label, description, type: "radio", numeric: true, options: ratings });
  createForm({
    title: "Feedback Job Fest",
    endpoint: window.jobfestConfig?.feedbackEndpoint || "",
    successMessage: "Feedbackul a fost salvat. Îți mulțumim!",
    questions: [
      { name: "email", label: "Email", description: "Doar dacă vrei să te contactăm. Fără email, feedbackul rămâne anonim.", type: "email", maxLength: 254, autocomplete: "email" },
      { ...rating("general", "Cum a fost Job Fest, în general?", "1 = slab, 5 = excelent"), required: true },
      rating("recomandare", "Ai recomanda Job Fest unui coleg?", "1 = sigur nu, 5 = sigur da"),
      { name: "bine", label: "Ce ți-a plăcut cel mai mult?", type: "textarea", maxLength: 1000 },
      { name: "zile", label: "La ce zile ai fost?", description: "Poți alege mai multe zile.", type: "checkbox", required: true, options: days },
      rating("locatie", "Locația (Casa de Cultură)"),
      rating("speakeri", "Speakerii și workshopurile"),
      rating("program", "Programul și pauzele"),
      rating("standuri", "Standurile de cafea și gustări"),
      rating("promovare", "Promovarea evenimentului"),
      { name: "schimbat", label: "Ce ar trebui să schimbăm?", type: "textarea", maxLength: 1000 },
      { name: "facultate", label: "Facultate", type: "checkbox", other: true, options: faculties }
    ]
  });
})();
