document.querySelectorAll('[data-review-form]').forEach((form) => {
  const submitButton = form.querySelector('[type="submit"]');
  const status = form.querySelector('[role="status"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    status.textContent = 'Sending your review…';
    const fields = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch('https://formsubmit.co/ajax/lemanuelmwesh@gmail.com', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: JSON.stringify(fields)
      });
      const result = await response.json();
      if (!response.ok || result.success === false || result.success === 'false') throw new Error('Submission was not accepted');
      form.reset();
      status.textContent = 'Thank you — your review has been submitted.';
    } catch (_) {
      status.textContent = 'We couldn’t send it just now. Please check your connection and try again.';
    } finally {
      submitButton.disabled = false;
    }
  });
});
