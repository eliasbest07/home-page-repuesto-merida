const header = document.querySelector("[data-header]");
const menuButton = document.querySelector(".nav-toggle");
const menu = document.querySelector(".site-nav");
const surveyButton = document.querySelector("[data-survey-trigger]");
const surveyStatus = document.querySelector("#survey-status");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function updateHeader() {
  header?.classList.toggle("scrolled", window.scrollY > 24);
}

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  menu?.classList.toggle("open", !isOpen);
});

menu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuButton?.setAttribute("aria-expanded", "false");
    menu?.classList.remove("open");
  });
});

surveyButton?.addEventListener("click", () => {
  surveyStatus?.removeAttribute("hidden");
});

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

const revealItems = document.querySelectorAll(".reveal");

if (reduceMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("visible"));
} else {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      currentObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%", threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
}
