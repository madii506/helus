// docs: highlight the section you're reading in the contents.
const links = [...document.querySelectorAll('.toc a')];
const spy = () => { let on = links[0]; for (const a of links) { const el = document.querySelector(a.getAttribute('href')); if (el && el.getBoundingClientRect().top < innerHeight * 0.3) on = a; } links.forEach(a => a.classList.toggle('on', a === on)); };
addEventListener('scroll', spy, { passive: true }); spy();
