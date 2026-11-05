(() => {
  const { createForm, days, faculties } = window.jobfestForms;
  createForm({
    title: "Înscriere Job Fest",
    steps: true,
    endpoint: "/api/inscriere",
    successMessage: "Înscrierea a fost salvată cu succes!",
    questions: [
      { name: "nume", label: "Nume", type: "text", required: true, maxLength: 100, autocomplete: "family-name" },
      { name: "prenume", label: "Prenume", type: "text", required: true, maxLength: 100, autocomplete: "given-name" },
      { name: "email", label: "Email", type: "email", required: true, maxLength: 254, autocomplete: "email" },
      { name: "zile", label: "La ce zile vii?", description: "Fiecare zi are speakeri pentru alte facultăți. Poți alege mai multe zile.", type: "checkbox", required: true, options: days },
      { name: "facultate", label: "Facultate", type: "checkbox", required: true, other: true, options: faculties },
      { name: "an", label: "Anul de studiu", type: "radio", required: true, options: ["1", "2", "3"] },
      { name: "sursa", label: "Cum ai aflat de Job Fest?", type: "text", maxLength: 500 },
      { name: "cv", label: "CV", type: "file", required: true, accept: ".pdf,application/pdf", maxSize: 5 * 1024 * 1024, description: "Încarcă CV-ul în format PDF, maximum 5 MB. CV-ul este obligatoriu pentru înscriere." }
    ]
  });
})();
