// Let Bootstrap show validation feedback before an invalid form reaches Express.
document.querySelectorAll(".needs-validation").forEach((form) =>
  form.addEventListener("submit", (event) => {
    if (!form.checkValidity()) {
      event.preventDefault();
      event.stopPropagation();
    } else {
      // Disable the submit button to prevent double clicks/submissions
      const submitButtons = form.querySelectorAll("button");
      submitButtons.forEach((btn) => {
        // Use setTimeout to ensure the browser has registered the submit event
        setTimeout(() => {
          btn.disabled = true;
          // Show a clean loading state if the button matches
          const btnText = btn.textContent.trim();
          if (btnText === "Create Account") {
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Creating Account...`;
          } else if (btnText === "Sign In") {
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Signing In...`;
          } else if (btnText.includes("Upload") || btnText.includes("Publish") || btnText.includes("Save")) {
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Uploading...`;
          }
        }, 10);
      });
    }
    form.classList.add("was-validated");
  }),
);

// Client-side file size & format validation (100 MB Cloudinary standard max)
document.querySelectorAll('input[type="file"][name="pdf"]').forEach((input) => {
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    const maxSizeBytes = 100 * 1024 * 1024; // 100 MB
    const allowedExts = [".pdf", ".png", ".jpg", ".jpeg"];

    if (file) {
      const fileName = file.name.toLowerCase();
      const isValidExt = allowedExts.some((ext) => fileName.endsWith(ext));

      if (!isValidExt) {
        alert("Invalid file format. Please choose a PDF or image (.pdf, .png, .jpg, .jpeg).");
        input.value = "";
        return;
      }

      if (file.size > maxSizeBytes) {
        const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
        alert(`File is too large (${sizeInMb} MB). Maximum allowed size is 100 MB.`);
        input.value = "";
        return;
      }
    }
  });
});

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
