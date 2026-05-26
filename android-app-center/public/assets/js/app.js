document.addEventListener('DOMContentLoaded', () => {
  const carousel = document.querySelector('#screenshotCarousel');
  if (carousel && typeof bootstrap !== 'undefined') {
    new bootstrap.Carousel(carousel, { interval: 5000, wrap: true });
  }
  document.querySelectorAll('[data-confirm]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (!confirm(el.getAttribute('data-confirm'))) e.preventDefault();
    });
  });
});
