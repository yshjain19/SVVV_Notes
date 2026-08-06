// Let Bootstrap show validation feedback before an invalid form reaches Express.
document.querySelectorAll(".needs-validation").forEach((form) =>
  form.addEventListener("submit", (event) => {
    if (!form.checkValidity()) {
      event.preventDefault();
      event.stopPropagation();
    }
    form.classList.add("was-validated");
  }),
);
// Deleting a note is irreversible, so require an explicit confirmation first.
document.querySelectorAll("form[data-confirm]").forEach((form) =>
  form.addEventListener("submit", (event) => {
    if (!confirm(form.dataset.confirm)) event.preventDefault();
  }),
);
// Flash messages are useful but should not permanently cover page content.
setTimeout(
  () =>
    document
      .querySelectorAll(".toast-stack .alert")
      .forEach((alert) => bootstrap.Alert.getOrCreateInstance(alert).close()),
  5000,
);
